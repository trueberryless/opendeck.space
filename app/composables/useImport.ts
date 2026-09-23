import type { CardInput, Visibility } from '~/composables/useDecks'
import type { ParsedDeck } from '~/utils/import/types'
import { totalCards, totalMedia } from '~/utils/import/types'

export interface ImportProgress {
  status: 'idle' | 'running' | 'paused' | 'done' | 'error' | 'cancelled'
  totalDecks: number
  doneDecks: number
  totalCards: number
  doneCards: number
  totalMedia: number
  doneMedia: number
  currentDeck: string
  pauseSeconds: number
  errors: string[]
  created: { title: string; rkey: string; actor: string }[]
}

const POINT_BUDGET = 4500
const WINDOW_MS = 3_600_000
const CREATE_POINTS = 3
const BLOB_POINTS = 3
const BATCH_SIZE = 10

function freshProgress(): ImportProgress {
  return {
    status: 'idle',
    totalDecks: 0,
    doneDecks: 0,
    totalCards: 0,
    doneCards: 0,
    totalMedia: 0,
    doneMedia: 0,
    currentDeck: '',
    pauseSeconds: 0,
    errors: [],
    created: [],
  }
}

class Cancelled extends Error {}

export function useImport() {
  const progress = useState<ImportProgress>('opendeck-import', freshProgress)
  const cancelled = useState('opendeck-import-cancel', () => false)
  const decks = useDecks()
  const media = useMedia()
  const authUser = useAuthUser()

  let windowStart = Date.now()
  let pointsUsed = 0

  function cancel() {
    cancelled.value = true
  }

  async function spend(points: number) {
    const now = Date.now()
    if (now - windowStart > WINDOW_MS) {
      windowStart = now
      pointsUsed = 0
    }
    if (pointsUsed + points > POINT_BUDGET) {
      await pauseFor(windowStart + WINDOW_MS - now)
      windowStart = Date.now()
      pointsUsed = 0
    }
    pointsUsed += points
  }

  async function pauseFor(ms: number) {
    const until = Date.now() + ms
    progress.value.status = 'paused'
    while (Date.now() < until) {
      if (cancelled.value) throw new Cancelled()
      progress.value.pauseSeconds = Math.ceil((until - Date.now()) / 1000)
      await sleep(Math.min(1000, until - Date.now()))
    }
    progress.value.pauseSeconds = 0
    progress.value.status = 'running'
  }

  async function withRetry<T>(fn: () => Promise<T>, points: number): Promise<T> {
    if (cancelled.value) throw new Cancelled()
    await spend(points)
    for (;;) {
      if (cancelled.value) throw new Cancelled()
      try {
        return await fn()
      } catch (err) {
        const wait = retryAfterMs(err)
        if (wait == null) throw err
        await pauseFor(wait)
      }
    }
  }

  async function batchCreateCards(values: CardInput[], visibility: Visibility) {
    const airspace = requireAirspace()
    if (visibility === 'private') {
      await airspace.vault.batch((b) => {
        for (const v of values) b.card.create(v)
      })
    } else {
      await airspace.batch((b) => {
        for (const v of values) b.card.create(v)
      })
    }
  }

  async function runImport(source: ParsedDeck[], visibility: Visibility): Promise<void> {
    cancelled.value = false
    windowStart = Date.now()
    pointsUsed = 0
    const p = freshProgress()
    p.status = 'running'
    p.totalDecks = source.length
    p.totalCards = totalCards(source)
    p.totalMedia = totalMedia(source)
    progress.value = p
    const actor = authUser.value?.handle || authUser.value?.did || ''

    try {
      for (const deck of source) {
        if (cancelled.value) break
        progress.value.currentDeck = deck.title

        const created = await withRetry(
          () =>
            decks.createDeck(
              {
                title: deck.title,
                summary: deck.summary,
                sourceLang: deck.sourceLang,
                targetLang: deck.targetLang,
                readingMode: deck.readingMode,
                tags: deck.tags,
              },
              visibility,
            ),
          CREATE_POINTS,
        )
        progress.value.created.push({ title: deck.title, rkey: created.rkey, actor })

        let order = 0
        for (let i = 0; i < deck.cards.length; i += BATCH_SIZE) {
          if (cancelled.value) break
          const chunk = deck.cards.slice(i, i + BATCH_SIZE)
          const values: CardInput[] = []

          for (const card of chunk) {
            let image: unknown
            let audio: unknown
            if (card.image) {
              image = (await withRetry(() => media.uploadImage(card.image!.bytes, card.image!.mime), BLOB_POINTS)).blob
              progress.value.doneMedia++
            }
            if (card.audio) {
              audio = (await withRetry(() => media.uploadAudio(card.audio!.bytes, card.audio!.mime), BLOB_POINTS)).blob
              progress.value.doneMedia++
            }
            values.push({
              deck: created.rkey,
              front: card.front,
              back: card.back,
              hint: card.hint,
              phonetic: card.phonetic,
              phoneticFront: card.phoneticFront,
              examples: card.examples,
              image,
              audio,
              order: order++,
              createdAt: new Date().toISOString(),
            } as CardInput)
          }

          await withRetry(() => batchCreateCards(values, visibility), CREATE_POINTS * values.length)
          progress.value.doneCards += values.length
        }
        progress.value.doneDecks++
      }
      progress.value.status = cancelled.value ? 'cancelled' : 'done'
    } catch (err) {
      if (err instanceof Cancelled) {
        progress.value.status = 'cancelled'
      } else {
        console.error('[opendeck] import failed', err)
        progress.value.errors.push(String((err as Error)?.message ?? err))
        progress.value.status = 'error'
      }
    }
  }

  function reset() {
    progress.value = freshProgress()
    cancelled.value = false
  }

  return { progress, runImport, cancel, reset }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function retryAfterMs(err: unknown): number | null {
  const e = err as any
  const status = e?.status ?? e?.statusCode ?? e?.cause?.status
  const msg = String(e?.message ?? '')
  const isRate = status === 429 || /rate ?limit|too many requests|\b429\b/i.test(msg)
  if (!isRate) return null
  const headers = e?.headers ?? e?.cause?.headers ?? {}
  const reset = Number(headers['ratelimit-reset'])
  if (reset > 0) return Math.max(1000, reset * 1000 - Date.now())
  const ra = Number(headers['retry-after'])
  if (ra > 0) return ra * 1000
  return 60_000
}
