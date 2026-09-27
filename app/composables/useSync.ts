import { useI18n } from 'vue-i18n'
import type { CardView, DeckView } from '~/composables/useDecks'
import type { ProgressRecord } from '~/composables/useStudy'
import { getDb, toPlain, type OutboxProgress, type OutboxSession } from '~/utils/db'
import { directionKey } from '~/utils/fsrs'
import {
  normalizeCard,
  normalizeDeck,
  normalizeProgress,
  normalizeSession,
  type ProgressValue,
  type SessionValue,
} from '~/utils/records'
import { nextTid } from '~/utils/tid'

const ABANDONED_SESSION_MS = 30 * 60 * 1000
const MIN_RETRY_MS = 5 * 1000
const MAX_RETRY_MS = 5 * 60 * 1000

let retryTimer: ReturnType<typeof setTimeout> | undefined
let retryDelay = MIN_RETRY_MS

function isSendable(s: OutboxSession, now = Date.now()): boolean {
  return !s.open || now - new Date(s.value.endedAt).getTime() > ABANDONED_SESSION_MS
}

export type SyncStatus = 'offline' | 'saved' | 'syncing' | 'failed'

const SYNC_ICONS: Record<SyncStatus, string> = {
  offline: 'i-lucide-cloud-off',
  saved: 'i-lucide-cloud-check',
  syncing: 'i-lucide-refresh-cw',
  failed: 'i-lucide-cloud-alert',
}

export function useSyncStatus() {
  const { online, pending, syncFailed } = useSync()
  const { t } = useI18n()

  const status = computed<SyncStatus>(() => {
    if (!online.value) return 'offline'
    if (pending.value === 0) return 'saved'
    return syncFailed.value ? 'failed' : 'syncing'
  })
  const icon = computed(() => SYNC_ICONS[status.value])
  const syncing = computed(() => t('offline.syncing', { count: pending.value }, pending.value))
  const detail = computed(() => {
    if (status.value === 'offline') return t('offline.message')
    if (status.value === 'failed') return t('study.syncRetrying')
    if (status.value === 'syncing') return syncing.value
    return t('study.synced')
  })

  return { status, icon, syncing, detail }
}

export function useSync() {
  const online = useOnline()
  const pending = useState('opendeck-outbox-pending', () => 0)
  const flushing = useState('opendeck-flushing', () => false)
  const syncFailed = useState('opendeck-sync-failed', () => false)

  async function refreshPending() {
    try {
      pending.value = await getDb().outboxProgress.count()
    } catch {
      pending.value = 0
    }
  }

  async function enqueueProgress(entry: Omit<OutboxProgress, 'queuedAt'>) {
    await getDb().outboxProgress.put({ ...entry, queuedAt: `${new Date().toISOString()}#${nextTid()}` })
    await refreshPending()
  }

  async function flush(): Promise<void> {
    if (!online.value || flushing.value) return
    const airspace = useAirspace()
    if (!airspace) return
    flushing.value = true
    clearTimeout(retryTimer)
    let failed = false
    try {
      const { ensure } = useSpacesSupport()
      const inVault = await ensure()
      const db = getDb()
      let entries = await db.outboxProgress.toArray()
      while (entries.length > 0 && !failed) {
        for (const e of entries) {
          try {
            const value = normalizeProgress(e.value)
            if (e.progressRkey) {
              if (inVault) await airspace.vault.progress.put(e.progressRkey, value)
              else await airspace.progress.put(e.progressRkey, value)
            } else if (inVault) {
              await airspace.vault.progress.create(value)
            } else {
              await airspace.progress.create(value)
            }
            await db.transaction('rw', db.outboxProgress, async () => {
              const latest = await db.outboxProgress.get(e.cardUri)
              if (latest?.queuedAt === e.queuedAt) await db.outboxProgress.delete(e.cardUri)
            })
            await refreshPending()
          } catch (err) {
            console.error('[opendeck] failed to sync a grade', err)
            failed = true
            break
          }
        }
        if (!failed) entries = await db.outboxProgress.toArray()
      }

      const sessions = await db.outboxSessions.toArray()
      for (const s of sessions) {
        if (failed || !isSendable(s)) continue
        try {
          const value = normalizeSession(s.value)
          if (inVault) await airspace.vault.session.put(s.rkey, value)
          else await airspace.session.put(s.rkey, value)
          await db.outboxSessions.delete(s.rkey)
        } catch (err) {
          console.error('[opendeck] failed to sync a study session', err)
          failed = true
        }
      }
    } finally {
      flushing.value = false
      syncFailed.value = failed
      await refreshPending()
      if (failed) {
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS)
        retryTimer = setTimeout(() => void flush(), retryDelay)
      } else {
        retryDelay = MIN_RETRY_MS
        if (pending.value > 0) void flush()
      }
    }
  }

  async function cacheDecks(author: string, decks: DeckView[]) {
    const db = getDb()
    const rows = decks.map((d) => toPlain(d))
    const keep = new Set(rows.map((d) => d.uri))
    await db.transaction('rw', db.decks, db.cards, db.offlineChoices, async () => {
      const gone = (await db.decks.where('author').equals(author).primaryKeys()).filter((uri) => !keep.has(uri))
      await db.decks.bulkDelete(gone)
      await db.cards.where('deckUri').anyOf(gone).delete()
      await db.offlineChoices.bulkDelete(gone)
      await db.decks.bulkPut(rows)
    })
  }

  async function cacheDeck(deck: DeckView) {
    await getDb().decks.put(toPlain(deck))
  }

  async function getCachedDecks(author: string): Promise<DeckView[]> {
    const rows = await getDb().decks.where('author').equals(author).toArray()
    for (const r of rows) r.value = normalizeDeck(r.value)
    return rows.sort((a, b) => (b.value.createdAt || '').localeCompare(a.value.createdAt || ''))
  }

  async function getCachedDeck(uri: string): Promise<DeckView | null> {
    const row = await getDb().decks.get(uri)
    return row ? { ...row, value: normalizeDeck(row.value) } : null
  }

  async function cacheCards(deckUri: string, cards: CardView[]) {
    const db = getDb()
    const rows = cards.map((c) => ({ uri: c.uri, deckUri, rkey: c.rkey, cid: c.cid, value: toRaw(c.value) }))
    await db.transaction('rw', db.cards, async () => {
      await db.cards.where('deckUri').equals(deckUri).delete()
      await db.cards.bulkPut(rows)
    })
  }

  async function getCachedCards(deckUri: string): Promise<CardView[]> {
    const rows = await getDb().cards.where('deckUri').equals(deckUri).toArray()
    return rows.map((r) => ({ uri: r.uri, cid: r.cid, rkey: r.rkey, value: normalizeCard(r.value) }))
  }

  async function cacheProgressMap(map: Map<string, ProgressRecord>) {
    const db = getDb()
    const rows = [...map.entries()].map(([cardUri, rec]) => ({ cardUri, rkey: rec.rkey, value: rec.value }))
    await db.transaction('rw', db.progress, async () => {
      await db.progress.clear()
      await db.progress.bulkPut(rows)
    })
  }

  async function forgetProgress(cardUris: string[]) {
    const db = getDb()
    const keys = cardUris.flatMap((uri) => [directionKey(uri, 'forward'), directionKey(uri, 'reverse')])
    await db.transaction('rw', db.progress, db.outboxProgress, async () => {
      await db.progress.bulkDelete(keys)
      await db.outboxProgress.bulkDelete(keys)
    })
    await refreshPending()
  }

  async function getCachedProgressMap(): Promise<Map<string, ProgressRecord>> {
    const rows = await getDb().progress.toArray()
    const map = new Map<string, ProgressRecord>()
    for (const r of rows) map.set(r.cardUri, { rkey: r.rkey, value: normalizeProgress(r.value) })
    const queued = await getDb().outboxProgress.toArray()
    for (const q of queued) map.set(q.cardUri, { rkey: q.progressRkey ?? '', value: normalizeProgress(q.value) })
    return map
  }

  async function cacheProgress(cardUri: string, rkey: string | null, value: ProgressValue) {
    await getDb().progress.put({ cardUri, rkey: rkey ?? '', value })
  }

  async function saveSessionDraft(session: OutboxSession) {
    await getDb().outboxSessions.put(session)
  }

  async function closeSessionDrafts(keep?: string) {
    await getDb()
      .outboxSessions.filter((s) => s.open && s.rkey !== keep)
      .modify({ open: false })
  }

  async function getQueuedSessions(): Promise<OutboxSession[]> {
    return getDb().outboxSessions.toArray()
  }

  async function cacheSessions(sessions: Map<string, SessionValue>) {
    const db = getDb()
    const rows = [...sessions.entries()].map(([rkey, value]) => ({ rkey, value }))
    await db.transaction('rw', db.sessions, async () => {
      await db.sessions.clear()
      await db.sessions.bulkPut(rows)
    })
  }

  async function getCachedSessions(): Promise<Map<string, SessionValue>> {
    const rows = await getDb().sessions.toArray()
    return new Map(rows.map((r) => [r.rkey, normalizeSession(r.value)]))
  }

  return {
    online,
    pending,
    syncFailed,
    refreshPending,
    enqueueProgress,
    flush,
    cacheDecks,
    cacheDeck,
    getCachedDecks,
    getCachedDeck,
    cacheCards,
    getCachedCards,
    cacheProgressMap,
    getCachedProgressMap,
    cacheProgress,
    forgetProgress,
    saveSessionDraft,
    closeSessionDrafts,
    getQueuedSessions,
    cacheSessions,
    getCachedSessions,
  }
}
