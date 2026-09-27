import type { DeckView } from '~/composables/useDecks'
import { cidFromBlob } from 'airspace'
import { getDb } from '~/utils/db'
import { normalizeProgress, normalizeSession } from '~/utils/records'

export type OfflineMode = 'recent' | 'all' | 'chosen'
export const OFFLINE_MODES: OfflineMode[] = ['recent', 'all', 'chosen']

export type OfflineStatus = 'ready' | 'downloading' | 'off'

const RECENT_MS = 30 * 24 * 60 * 60 * 1000

let running: Promise<void> | null = null
let rerun = false

async function recentDeckRkeys(): Promise<Set<string>> {
  const db = getDb()
  const since = Date.now() - RECENT_MS
  const recent = new Set<string>()
  for (const s of [...(await db.sessions.toArray()), ...(await db.outboxSessions.toArray())]) {
    const value = normalizeSession(s.value)
    if (value.deck && new Date(value.endedAt).getTime() >= since) recent.add(value.deck)
  }
  for (const p of await db.progress.toArray()) {
    const value = normalizeProgress(p.value)
    if (value.deck && new Date(value.lastReviewedAt).getTime() >= since) recent.add(value.deck)
  }
  return recent
}

function mediaOf(value: { image?: unknown; audio?: unknown }): [string, unknown][] {
  const out: [string, unknown][] = []
  for (const blob of [value.image, value.audio]) {
    const cid = cidFromBlob(blob)
    if (cid) out.push([cid, blob])
  }
  return out
}

export function useOfflineDecks() {
  const mode = useLocalStorage<OfflineMode>('opendeck-offline-mode', 'recent')
  const choices = useState<Record<string, boolean>>('opendeck-offline-choices', () => ({}))
  const status = useState<Record<string, OfflineStatus>>('opendeck-offline-status', () => ({}))
  const usage = useState<number | null>('opendeck-offline-usage', () => null)

  async function loadChoices() {
    const rows = await getDb().offlineChoices.toArray()
    choices.value = Object.fromEntries(rows.map((r) => [r.deckUri, r.keep]))
  }

  function isKept(deck: DeckView, recent: Set<string>): boolean {
    const choice = choices.value[deck.uri]
    if (choice !== undefined) return choice
    if (mode.value === 'all') return true
    return mode.value === 'recent' && recent.has(deck.rkey)
  }

  async function run(): Promise<void> {
    const did = useAuthUser().value?.did
    if (!did) return
    await loadChoices()
    const db = getDb()
    const decks = await useSync().getCachedDecks(did)
    const recent = await recentDeckRkeys()
    const needed = new Map<string, unknown>()
    const deckMedia = new Map<string, string[]>()

    for (const deck of decks) {
      const kept = isKept(deck, recent)
      const cids: string[] = []
      for (const card of await db.cards.where('deckUri').equals(deck.uri).toArray()) {
        for (const [cid, blob] of mediaOf(card.value)) {
          cids.push(cid)
          if (kept) needed.set(cid, blob)
        }
      }
      deckMedia.set(deck.uri, kept ? cids : [])
    }

    const saved = new Set(await db.media.toCollection().primaryKeys())
    const unused = [...saved].filter((cid) => !needed.has(cid))
    await db.media.bulkDelete(unused)
    for (const cid of unused) saved.delete(cid)

    const publish = () => {
      status.value = Object.fromEntries(
        decks.map((d) => {
          const kept = isKept(d, recent)
          const missing = deckMedia.get(d.uri)!.some((cid) => !saved.has(cid))
          return [d.uri, kept ? (missing ? 'downloading' : 'ready') : 'off']
        }),
      )
    }
    publish()

    const airspace = useAirspace()
    const { online } = useSync()
    if (!airspace) return
    for (const [cid, blob] of needed) {
      if (saved.has(cid)) continue
      if (!online.value) break
      try {
        const url = await airspace.blobs.url(blob)
        const res = url ? await fetch(url) : null
        if (!res?.ok) continue
        await db.media.put({ cid, blob: await res.blob() })
        saved.add(cid)
        publish()
      } catch (err) {
        console.error('[opendeck] failed to download media for offline use', err)
      }
    }
    await measure()
  }

  async function syncMedia(): Promise<void> {
    if (running) {
      rerun = true
      return running
    }
    running = (async () => {
      try {
        do {
          rerun = false
          await run()
        } while (rerun)
      } catch (err) {
        console.error('[opendeck] failed to update offline decks', err)
      } finally {
        running = null
      }
    })()
    return running
  }

  async function refreshLibrary(): Promise<void> {
    await useStats().load()
    await syncMedia()
  }

  async function setKept(deck: DeckView, keep: boolean) {
    choices.value = { ...choices.value, [deck.uri]: keep }
    status.value = { ...status.value, [deck.uri]: keep ? 'downloading' : 'off' }
    await getDb().offlineChoices.put({ deckUri: deck.uri, keep })
    if (keep) void persistStorage()
    await syncMedia()
  }

  async function setMode(next: OfflineMode) {
    mode.value = next
    if (next === 'all') void persistStorage()
    await syncMedia()
  }

  async function measure() {
    try {
      usage.value = (await navigator.storage?.estimate?.())?.usage ?? null
    } catch {
      usage.value = null
    }
  }

  return { mode, status, usage, syncMedia, refreshLibrary, setKept, setMode, measure }
}

export async function persistStorage(): Promise<void> {
  try {
    if (!(await navigator.storage?.persisted?.())) await navigator.storage?.persist?.()
  } catch {}
}
