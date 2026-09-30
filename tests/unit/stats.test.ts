import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildActivity, computeStats, fromPublicStats, samePublicStats, toPublicStats } from '~/utils/stats'
import type { ProgressValue, SessionValue } from '~/utils/records'

const NOW = new Date(2026, 5, 15, 12)

function progress(over: Partial<ProgressValue>): ProgressValue {
  return {
    card: 'c1',
    dueAt: NOW.toISOString(),
    stability: '1',
    difficulty: '1',
    repetitions: 1,
    lapses: 0,
    state: 'review',
    lastReviewedAt: NOW.toISOString(),
    ...over,
  }
}

function session(over: Partial<SessionValue>): SessionValue {
  return {
    startedAt: NOW.toISOString(),
    endedAt: NOW.toISOString(),
    activeSeconds: 60,
    repetitions: 5,
    again: 1,
    hard: 0,
    good: 4,
    easy: 0,
    newCards: 0,
    ...over,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('buildActivity', () => {
  it('counts reviews per day and prefers the larger session count', () => {
    const activity = buildActivity(
      [progress({}), progress({ card: 'c2' }), progress({ card: 'c3', lastReviewedAt: '' })],
      [session({ repetitions: 5 })],
    )
    expect(activity).toEqual({ '2026-06-15': 5 })
  })

  it('keeps progress counts when they exceed sessions', () => {
    const activity = buildActivity([progress({}), progress({ card: 'c2' })], [session({ repetitions: 1 })])
    expect(activity['2026-06-15']).toBe(2)
  })
})

describe('computeStats', () => {
  const fronts = new Map([
    ['c1', 'one'],
    ['c2', 'two'],
    ['c3', 'three'],
  ])

  it('classifies cards and finds the most trained one', () => {
    const stats = computeStats(
      [
        progress({ card: 'c1', repetitions: 9 }),
        progress({ card: 'c2', state: 'learning', repetitions: 2 }),
        progress({ card: 'c3', state: 'new', repetitions: 0 }),
        progress({ card: 'gone', repetitions: 50 }),
      ],
      [],
      fronts,
    )
    expect(stats).toMatchObject({ learned: 1, learning: 1, mostTrained: { front: 'one', repetitions: 9 } })
    expect(stats.repetitions).toBe(61)
  })

  it('counts a card learned when any direction reached review', () => {
    const stats = computeStats(
      [progress({ card: 'c1', state: 'learning' }), progress({ card: 'c1', state: 'review' })],
      [],
      fronts,
    )
    expect(stats).toMatchObject({ learned: 1, learning: 0 })
  })

  it('computes retention over the last 30 days', () => {
    const stats = computeStats(
      [],
      [session({ repetitions: 10, again: 2 }), session({ startedAt: '2020-01-01T00:00:00Z', repetitions: 100 })],
      fronts,
    )
    expect(stats.retention).toBeCloseTo(0.8)
    expect(stats.yearSeconds).toBe(60)
    expect(stats.repetitions).toBe(110)
  })

  it('has no retention without recent sessions and tracks the last activity', () => {
    const stats = computeStats([progress({ lastReviewedAt: '2026-06-01T00:00:00.000Z' })], [], fronts)
    expect(stats.retention).toBeNull()
    expect(stats.lastActive).toBe('2026-06-01T00:00:00.000Z')
    const withSession = computeStats(
      [progress({ lastReviewedAt: '2026-06-01T00:00:00.000Z' })],
      [session({ endedAt: '2026-06-10T00:00:00.000Z' })],
      fronts,
    )
    expect(withSession.lastActive).toBe('2026-06-10T00:00:00.000Z')
  })

  it('summarizes the rhythm for a new learner', () => {
    const stats = computeStats([progress({ card: 'c1' })], [], fronts)
    expect(stats.firstStudyDay).toBe('2026-06-15')
    expect(stats.yearActiveDays).toBe(1)
    expect(stats.daysPerWeek).toBeCloseTo(1)
  })

  it('handles no data at all', () => {
    const stats = computeStats([], [], new Map())
    expect(stats).toMatchObject({ learned: 0, mostTrained: null, firstStudyDay: null, lastActive: null })
  })
})

describe('toPublicStats / fromPublicStats', () => {
  it('round-trips the activity of a year', () => {
    const stats = computeStats([progress({})], [session({})], new Map([['c1', 'one']]))
    const pub = toPublicStats(stats, NOW)
    expect(pub.activity).toHaveLength(371)
    expect(pub.activityEnd).toBe('2026-06-15')
    const back = fromPublicStats(pub)!
    expect(back.activity).toEqual(stats.activity)
    expect(back).toMatchObject({ learned: 1, retention: null, mostTrained: null })
  })

  it('returns null for malformed data', () => {
    expect(fromPublicStats(undefined)).toBeNull()
    expect(fromPublicStats({ activityEnd: 'bad', activity: [] })).toBeNull()
    expect(fromPublicStats({ activityEnd: '2026-06-15' })).toBeNull()
  })

  it('tolerates junk values', () => {
    const back = fromPublicStats({ activityEnd: '2026-06-15', activity: [0, 'x', 3], learned: 'n', secondsStudied: 9 })!
    expect(back.activity).toEqual({ '2026-06-15': 3 })
    expect(back).toMatchObject({ learned: 0, yearSeconds: 9, lastActive: null })
  })
})

describe('samePublicStats', () => {
  const base = toPublicStats(computeStats([], [], new Map()), NOW)

  it('ignores the update time', () => {
    expect(samePublicStats(base, { ...base, updatedAt: 'later' })).toBe(true)
  })

  it('detects a difference', () => {
    expect(samePublicStats(base, { ...base, learned: 1 })).toBe(false)
  })

  it('handles missing values', () => {
    expect(samePublicStats(undefined, undefined)).toBe(true)
    expect(samePublicStats(base, undefined)).toBe(false)
  })
})
