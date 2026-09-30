import { describe, expect, it } from 'vitest'
import { normalizeCard, normalizeDeck, normalizePrefs, normalizeProgress, normalizeSession } from '~/utils/records'

const EPOCH = new Date(0).toISOString()

describe('normalizeDeck', () => {
  it('fills defaults and drops undefined fields', () => {
    expect(normalizeDeck({})).toEqual({ title: '', createdAt: EPOCH })
  })

  it('reads the legacy stepsPreset field', () => {
    expect(normalizeDeck({ title: 'x', stepsPreset: 'quick' }).shortTermIntervals).toBe('quick')
    expect(normalizeDeck({ title: 'x', stepsPreset: 'quick', shortTermIntervals: 'spaced' }).shortTermIntervals).toBe(
      'spaced',
    )
  })

  it('ignores values with the wrong type', () => {
    expect(normalizeDeck({ title: 5, summary: {} })).toEqual({ title: '', createdAt: EPOCH })
  })
})

describe('normalizeCard', () => {
  it('maps legacy phonetic fields to readings', () => {
    expect(normalizeCard({ front: 'a', back: 'b', phoneticFront: 'pf', phonetic: 'pb' })).toMatchObject({
      frontReading: 'pf',
      backReading: 'pb',
    })
  })

  it('prefers the new reading fields and keeps numeric order only', () => {
    const card = normalizeCard({ frontReading: 'new', phoneticFront: 'old', order: 3 })
    expect(card.frontReading).toBe('new')
    expect(card.order).toBe(3)
    expect(normalizeCard({ order: '3' }).order).toBeUndefined()
  })
})

describe('normalizeProgress', () => {
  it('maps legacy field names', () => {
    const p = normalizeProgress({ card: 'c', due: 'D', reviews: 4, lastReview: 'L', state: 'review' })
    expect(p).toMatchObject({ dueAt: 'D', repetitions: 4, lastReviewedAt: 'L' })
    expect(p.shortTermStep).toBeUndefined()
  })

  it('infers the short-term step of legacy learning cards', () => {
    expect(normalizeProgress({ state: 'learning', lastRating: 'good' }).shortTermStep).toBe(1)
    expect(normalizeProgress({ state: 'learning', lastRating: 'again' }).shortTermStep).toBe(0)
    expect(normalizeProgress({ state: 'relearning', learningSteps: 2 }).shortTermStep).toBe(2)
  })

  it('falls back through the last reviewed chain', () => {
    expect(normalizeProgress({ updatedAt: 'U' }).lastReviewedAt).toBe('U')
    expect(normalizeProgress({}).lastReviewedAt).toBe('')
  })
})

describe('normalizeSession', () => {
  it('reduces an at:// deck to its rkey', () => {
    expect(normalizeSession({ deck: 'at://did:plc:x/space.opendeck.deck/abc' }).deck).toBe('abc')
    expect(normalizeSession({ deck: 'abc' }).deck).toBe('abc')
  })

  it('estimates active seconds capped at 120 per repetition', () => {
    const long = normalizeSession({
      startedAt: '2026-01-01T00:00:00Z',
      endedAt: '2026-01-01T01:00:00Z',
      repetitions: 2,
    })
    expect(long.activeSeconds).toBe(240)
    const short = normalizeSession({
      startedAt: '2026-01-01T00:00:00Z',
      endedAt: '2026-01-01T00:01:00Z',
      repetitions: 10,
    })
    expect(short.activeSeconds).toBe(60)
  })

  it('keeps a recorded active time and tolerates bad dates', () => {
    expect(normalizeSession({ activeSeconds: 33 }).activeSeconds).toBe(33)
    expect(normalizeSession({ startedAt: 'x', endedAt: 'y', repetitions: 2 }).activeSeconds).toBe(0)
    expect(normalizeSession({ reviews: 3 }).repetitions).toBe(3)
  })
})

describe('normalizePrefs', () => {
  it('handles empty input', () => {
    expect(normalizePrefs(undefined)).toEqual({})
  })

  it('drops removed keys and migrates legacy ones', () => {
    const prefs = normalizePrefs({
      visibleDecks: [],
      showStatsOnProfile: true,
      motivationEnabled: true,
      stepsPreset: 'relaxed',
      reminderTime: '18:30',
      bio: 'hi',
    })
    expect(prefs).toEqual({ bio: 'hi', shortTermIntervals: 'relaxed', reminderHour: 18 })
  })

  it('prefers current keys over legacy ones', () => {
    expect(normalizePrefs({ reminderHour: 7, reminderTime: '18:30' }).reminderHour).toBe(7)
    expect(normalizePrefs({ reminderTime: 'later' }).reminderHour).toBeUndefined()
  })
})
