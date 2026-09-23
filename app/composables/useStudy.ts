import type { CardView } from '~/composables/useDecks'
import type { Grade } from 'ts-fsrs'
import {
  directionKey,
  gradeCard,
  isDue,
  progressDirection,
  type ProgressValue,
  type StudyDirection,
} from '~/utils/fsrs'

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

const BATCH_SIZE = 10

async function inBatches(rkeys: string[], run: (chunk: string[]) => Promise<unknown>) {
  for (let i = 0; i < rkeys.length; i += BATCH_SIZE) await run(rkeys.slice(i, i + BATCH_SIZE))
}

export function useStudy() {
  const { supported, ensure } = useSpacesSupport()

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
      for (const r of pub) map.set(keyOf(r.value as ProgressValue), { rkey: r.rkey, value: r.value as ProgressValue })

      if (await ensure()) {
        try {
          const priv = await airspace.vault.progress.list()
          for (const r of priv)
            map.set(keyOf(r.value as ProgressValue), { rkey: r.rkey, value: r.value as ProgressValue })
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

  async function saveProgress(rkey: string | null, value: ProgressValue): Promise<string> {
    const airspace = requireAirspace()
    const inVault = await ensure()
    if (rkey) {
      if (inVault) await airspace.vault.progress.put(rkey, value)
      else await airspace.progress.put(rkey, value)
      return rkey
    }
    const res = inVault ? await airspace.vault.progress.create(value) : await airspace.progress.create(value)
    return res.rkey
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
      const da = a.progress ? new Date(a.progress.due).getTime() : 0
      const db = b.progress ? new Date(b.progress.due).getTime() : 0
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
    await inBatches(pub, (rkeys) =>
      airspace.batch((b) => {
        for (const rkey of rkeys) b.progress.delete(rkey)
      }),
    )
    if (await ensure()) {
      const priv = matching(await airspace.vault.progress.list())
      await inBatches(priv, (rkeys) =>
        airspace.vault.batch((b) => {
          for (const rkey of rkeys) b.progress.delete(rkey)
        }),
      )
    }
  }

  async function grade(item: StudyItem, g: Grade): Promise<ProgressValue> {
    const next = gradeCard(item.card.uri, item.progress, g, item.card.value.deck, item.direction)
    const sync = useSync()
    const cacheKey = directionKey(item.card.uri, item.direction)

    if (sync.online.value) {
      try {
        item.progressRkey = await saveProgress(item.progressRkey, next)
      } catch (err) {
        console.error('[opendeck] write failed, queuing offline', err)
        await sync.enqueueProgress({
          cardUri: cacheKey,
          cardRkey: item.card.rkey,
          progressRkey: item.progressRkey,
          value: next,
        })
      }
    } else {
      await sync.enqueueProgress({
        cardUri: cacheKey,
        cardRkey: item.card.rkey,
        progressRkey: item.progressRkey,
        value: next,
      })
    }

    await sync.cacheProgress(cacheKey, item.progressRkey, next)
    item.progress = next
    return next
  }

  return { spacesSupported: supported, loadProgressMap, saveProgress, buildQueue, dueCount, grade, resetProgress }
}
