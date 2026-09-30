import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Rating } from 'ts-fsrs'
import type { CardView } from '~/composables/useDecks'
import type { ProgressValue } from '~/utils/records'
import { signIn } from '../support/session'

const card = (rkey: string): CardView => ({
  uri: `at://did:plc:me/space.opendeck.card/${rkey}`,
  cid: 'c',
  rkey,
  value: { deck: 'd1', front: rkey, back: 'b', createdAt: '' },
})

const progress = (cardUri: string, dueAt: string, over: Partial<ProgressValue> = {}): ProgressValue => ({
  card: cardUri,
  dueAt,
  stability: '1',
  difficulty: '1',
  repetitions: 1,
  lapses: 0,
  state: 'review',
  lastReviewedAt: '2026-06-01T00:00:00Z',
  ...over,
})

describe('useStudy queue', () => {
  it('puts due cards first, oldest due date first, and skips future cards', () => {
    const study = useStudy()
    const [a, b, c] = [card('a'), card('b'), card('c')]
    const map = new Map([
      [a.uri, { rkey: 'pa', value: progress(a.uri, '2020-01-02T00:00:00Z') }],
      [b.uri, { rkey: 'pb', value: progress(b.uri, '2020-01-01T00:00:00Z') }],
    ])
    const future = card('future')
    map.set(future.uri, { rkey: 'pf', value: progress(future.uri, '2999-01-01T00:00:00Z') })
    const queue = study.buildQueue([a, b, c, future], map, 'forward')
    expect(queue.map((i) => i.card.rkey)).toEqual(['c', 'b', 'a'])
    expect(queue[0]).toMatchObject({ progress: null, progressRkey: null, direction: 'forward' })
    expect(study.buildQueue([a, b, c, future], map, 'forward', false)).toHaveLength(4)
  })

  it('tracks each direction separately', () => {
    const study = useStudy()
    const a = card('a')
    const map = new Map([
      [`${a.uri}#reverse`, { rkey: 'p', value: progress(a.uri, '2999-01-01T00:00:00Z', { direction: 'reverse' }) }],
    ])
    expect(study.buildQueue([a], map, 'forward')).toHaveLength(1)
    expect(study.buildQueue([a], map, 'reverse')).toHaveLength(0)
    expect(study.dueCount([a], map, 'forward')).toBe(1)
    expect(study.dueCount([a], map, 'reverse')).toBe(0)
  })
})

describe('useStudy progress map', () => {
  it('merges public and private progress and caches it', async () => {
    const airspace = signIn()
    const a = card('a')
    airspace.progress.rows.set('p1', progress(a.uri, '2020-01-01T00:00:00Z'))
    airspace.vault.progress.rows.set('p2', progress(a.uri, '2021-01-01T00:00:00Z', { direction: 'reverse' }))
    const map = await useStudy().loadProgressMap()
    expect([...map.keys()].sort()).toEqual([a.uri, `${a.uri}#reverse`])
    expect((await useSync().getCachedProgressMap()).size).toBe(2)
  })

  it('reads only the cache when offline and when loading fails', async () => {
    expect((await useStudy().loadProgressMap()).size).toBe(0)
    const airspace = signIn()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await useSync().cacheProgress('x', 'r', progress('x', '2020-01-01T00:00:00Z'))
    airspace.progress.list.mockRejectedValue(new Error('down'))
    expect([...(await useStudy().loadProgressMap()).keys()]).toEqual(['x'])
  })

  it('survives an unreadable vault', async () => {
    const airspace = signIn()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    airspace.vault.progress.list.mockRejectedValue(new Error('vault'))
    airspace.progress.rows.set('p1', progress('c', '2020-01-01T00:00:00Z'))
    expect((await useStudy().loadProgressMap()).size).toBe(1)
  })
})

describe('useStudy grade', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('schedules the card, queues it and caches the result', async () => {
    const airspace = signIn()
    const a = card('a')
    const item = { card: a, progress: null, progressRkey: null, direction: 'forward' as const }
    const next = await useStudy().grade(item, Rating.Good, 'quick')
    expect(next).toMatchObject({ state: 'learning', repetitions: 1, card: a.uri, deck: 'd1' })
    expect(item.progress).toBe(next)
    expect(item.progressRkey).toMatch(/^[2-7a-z]{13}$/)
    await vi.waitFor(() => expect(airspace.vault.progress.put).toHaveBeenCalled())
    expect((await useSync().getCachedProgressMap()).get(a.uri)?.value.repetitions).toBe(1)
  })
})

describe('useStudy resetProgress', () => {
  it('deletes matching progress everywhere', async () => {
    const airspace = signIn()
    airspace.progress.rows.set('p1', progress('keep', '2020-01-01T00:00:00Z'))
    airspace.progress.rows.set('p2', progress('reset', '2020-01-01T00:00:00Z'))
    airspace.vault.progress.rows.set('p3', progress('reset', '2020-01-01T00:00:00Z'))
    await useStudy().resetProgress(['reset'])
    expect([...airspace.progress.rows.keys()]).toEqual(['p1'])
    expect(airspace.vault.progress.rows.size).toBe(0)
  })
})

describe('useStudySession', () => {
  it('records repetitions into a draft session and finishes it', async () => {
    const airspace = signIn()
    const session = useStudySession()
    session.cardShown()
    await session.record({ deck: 'd1', direction: 'forward', rating: 'good', isNew: true })
    await session.record({ deck: 'd1', direction: 'forward', rating: 'again', isNew: false })
    const [draft] = await useSync().getQueuedSessions()
    expect(draft).toMatchObject({ open: true, value: { deck: 'd1', repetitions: 2, good: 1, again: 1, newCards: 1 } })

    await session.finish()
    expect((await useSync().getQueuedSessions())[0]!.open).toBe(false)
    await vi.waitFor(() => expect(airspace.vault.session.put).toHaveBeenCalled())
    await session.finish()
  })

  it('caps the time counted per card', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      signIn()
      const session = useStudySession()
      session.cardShown()
      vi.advanceTimersByTime(10 * 60 * 1000)
      await session.record({ direction: 'reverse', rating: 'easy', isNew: false })
      const [draft] = await useSync().getQueuedSessions()
      expect(draft!.value.activeSeconds).toBe(120)
      expect(draft!.value.direction).toBe('reverse')
    } finally {
      vi.useRealTimers()
    }
  })
})
