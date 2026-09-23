import type { CardView } from '~/composables/useDecks'
import type { Grade } from 'ts-fsrs'
import { directionKey, gradeCard, isDue, progressDirection, type ShortTermPreset } from '~/utils/fsrs'
import { normalizeProgress, type ProgressValue, type StudyDirection } from '~/utils/records'
import { nextTid } from '~/utils/tid'

export interface StudyItem {
  card: CardView
  progress: ProgressValue | null
  progressRkey: string | null
  direction: StudyDirection
}

export interface ProgressRecord {
  rkey: string
  value: ProgressValue
}

export function useStudy() {
  const { ensure } = useSpacesSupport()

  function keyOf(value: ProgressValue): string {
    return directionKey(value.card, progressDirection(value))
  }

  async function loadProgressMap(): Promise<Map<string, ProgressRecord>> {
    const sync = useSync()
    if (!sync.online.value) return sync.getCachedProgressMap()

    try {
      const airspace = requireAirspace()
      const map = new Map<string, ProgressRecord>()

      const pub = await airspace.progress.list()
      for (const r of pub) {
        const value = normalizeProgress(r.value)
        map.set(keyOf(value), { rkey: r.rkey, value })
      }

      if (await ensure()) {
        try {
          const priv = await airspace.vault.progress.list()
          for (const r of priv) {
            const value = normalizeProgress(r.value)
            map.set(keyOf(value), { rkey: r.rkey, value })
          }
        } catch (err) {
          console.error('[opendeck] failed to load private progress', err)
        }
      }

      await sync.cacheProgressMap(map)
      const cached = await sync.getCachedProgressMap()
      return cached.size >= map.size ? cached : map
    } catch (err) {
      console.error('[opendeck] falling back to cached progress', err)
      return sync.getCachedProgressMap()
    }
  }

  function buildQueue(
    cards: CardView[],
    map: Map<string, ProgressRecord>,
    direction: StudyDirection,
    dueOnly = true,
  ): StudyItem[] {
    const now = new Date()
    const items = cards.map((card) => {
      const rec = map.get(directionKey(card.uri, direction))
      return { card, progress: rec?.value ?? null, progressRkey: rec?.rkey ?? null, direction }
    })
    const queue = dueOnly ? items.filter((i) => isDue(i.progress, now)) : items
    return queue.sort((a, b) => {
      const da = a.progress ? new Date(a.progress.dueAt).getTime() : 0
      const db = b.progress ? new Date(b.progress.dueAt).getTime() : 0
      return da - db
    })
  }

  function dueCount(cards: CardView[], map: Map<string, ProgressRecord>, direction: StudyDirection): number {
    const now = new Date()
    return cards.reduce(
      (n, card) => n + (isDue(map.get(directionKey(card.uri, direction))?.value ?? null, now) ? 1 : 0),
      0,
    )
  }

  async function resetProgress(cardUris: string[]): Promise<void> {
    const airspace = requireAirspace()
    const uris = new Set(cardUris)
    const matching = (records: { rkey: string; value: unknown }[]) =>
      records.filter((r) => uris.has((r.value as ProgressValue).card)).map((r) => r.rkey)

    await useSync().forgetProgress(cardUris)

    const pub = matching(await airspace.progress.list())
    for (const rkeys of chunks(pub)) {
      await airspace.batch((b) => {
        for (const rkey of rkeys) b.progress.delete(rkey)
      })
    }
    if (await ensure()) {
      const priv = matching(await airspace.vault.progress.list())
      for (const rkeys of chunks(priv)) {
        await airspace.vault.batch((b) => {
          for (const rkey of rkeys) b.progress.delete(rkey)
        })
      }
    }
  }

  async function grade(item: StudyItem, g: Grade, preset?: ShortTermPreset): Promise<ProgressValue> {
    const next = gradeCard(item.card.uri, item.progress, g, item.card.value.deck, item.direction, preset)
    const sync = useSync()
    const cacheKey = directionKey(item.card.uri, item.direction)
    item.progressRkey ||= nextTid()
    item.progress = next

    await sync.enqueueProgress({
      cardUri: cacheKey,
      cardRkey: item.card.rkey,
      progressRkey: item.progressRkey,
      value: next,
    })
    await sync.cacheProgress(cacheKey, item.progressRkey, next)
    void sync.flush()
    return next
  }

  return { loadProgressMap, buildQueue, dueCount, grade, resetProgress }
}
