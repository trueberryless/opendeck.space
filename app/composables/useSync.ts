import type { CardView } from '~/composables/useDecks'
import type { ProgressRecord } from '~/composables/useStudy'
import { getDb, type OutboxProgress } from '~/utils/db'
import type { ProgressValue } from '~/utils/fsrs'

export function useSync() {
  const online = useOnline()
  const pending = useState('opendeck-outbox-pending', () => 0)
  const flushing = useState('opendeck-flushing', () => false)

  async function refreshPending() {
    try {
      pending.value = await getDb().outboxProgress.count()
    } catch {
      pending.value = 0
    }
  }

  async function enqueueProgress(entry: Omit<OutboxProgress, 'queuedAt'>) {
    await getDb().outboxProgress.put({ ...entry, queuedAt: new Date().toISOString() })
    await refreshPending()
  }

  async function flush(): Promise<void> {
    if (!online.value || flushing.value) return
    const airspace = useAirspace()
    if (!airspace) return
    flushing.value = true
    try {
      const { ensure } = useSpacesSupport()
      const inVault = await ensure()
      const entries = await getDb().outboxProgress.toArray()
      for (const e of entries) {
        try {
          if (e.progressRkey) {
            if (inVault) await airspace.vault.progress.put(e.progressRkey, e.value)
            else await airspace.progress.put(e.progressRkey, e.value)
          } else if (inVault) {
            await airspace.vault.progress.create(e.value)
          } else {
            await airspace.progress.create(e.value)
          }
          await getDb().outboxProgress.delete(e.cardUri)
        } catch (err) {
          console.error('[opendeck] failed to sync a grade', err)
        }
      }
    } finally {
      flushing.value = false
      await refreshPending()
    }
  }

  async function cacheCards(deckUri: string, cards: CardView[]) {
    const db = getDb()
    const rows = cards.map((c) => ({ uri: c.uri, deckUri, rkey: c.rkey, cid: c.cid, value: c.value }))
    await db.transaction('rw', db.cards, async () => {
      await db.cards.where('deckUri').equals(deckUri).delete()
      await db.cards.bulkPut(rows)
    })
  }

  async function getCachedCards(deckUri: string): Promise<CardView[]> {
    const rows = await getDb().cards.where('deckUri').equals(deckUri).toArray()
    return rows.map((r) => ({ uri: r.uri, cid: r.cid, rkey: r.rkey, value: r.value }))
  }

  async function cacheProgressMap(map: Map<string, ProgressRecord>) {
    const rows = [...map.entries()].map(([cardUri, rec]) => ({ cardUri, rkey: rec.rkey, value: rec.value }))
    await getDb().progress.bulkPut(rows)
  }

  async function getCachedProgressMap(): Promise<Map<string, ProgressRecord>> {
    const rows = await getDb().progress.toArray()
    const map = new Map<string, ProgressRecord>()
    for (const r of rows) map.set(r.cardUri, { rkey: r.rkey, value: r.value })
    const queued = await getDb().outboxProgress.toArray()
    for (const q of queued) map.set(q.cardUri, { rkey: q.progressRkey ?? '', value: q.value })
    return map
  }

  async function cacheProgress(cardUri: string, rkey: string | null, value: ProgressValue) {
    await getDb().progress.put({ cardUri, rkey: rkey ?? '', value })
  }

  return {
    online,
    pending,
    flushing,
    refreshPending,
    enqueueProgress,
    flush,
    cacheCards,
    getCachedCards,
    cacheProgressMap,
    getCachedProgressMap,
    cacheProgress,
  }
}
