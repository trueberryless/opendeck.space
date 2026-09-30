import { describe, expect, it } from 'vitest'
import { Rating } from 'ts-fsrs'
import {
  autoShortTermPreset,
  cardToProgress,
  directionKey,
  formatShortTerm,
  gradeCard,
  intervalPreview,
  isDue,
  progressDirection,
  progressToCard,
  resolveShortTermPreset,
} from '~/utils/fsrs'
import type { ProgressValue } from '~/utils/records'

const NOW = new Date('2026-06-15T12:00:00Z')

describe('autoShortTermPreset', () => {
  it('scales the preset with the session length', () => {
    expect(autoShortTermPreset(5)).toBe('quick')
    expect(autoShortTermPreset(100)).toBe('balanced')
    expect(autoShortTermPreset(1000)).toBe('relaxed')
  })
})

describe('resolveShortTermPreset', () => {
  it('uses auto for missing or auto choices and the explicit preset otherwise', () => {
    expect(resolveShortTermPreset(undefined, 5)).toBe('quick')
    expect(resolveShortTermPreset('auto', 1000)).toBe('relaxed')
    expect(resolveShortTermPreset('spaced', 5)).toBe('spaced')
  })
})

describe('formatShortTerm', () => {
  it('joins the learning steps', () => {
    expect(formatShortTerm('quick')).toBe('1m → 10m')
  })
})

describe('directionKey / progressDirection', () => {
  it('suffixes reverse cards only', () => {
    expect(directionKey('at://c', 'forward')).toBe('at://c')
    expect(directionKey('at://c', 'reverse')).toBe('at://c#reverse')
  })

  it('defaults to forward', () => {
    expect(progressDirection(null)).toBe('forward')
    expect(progressDirection({ direction: 'reverse' } as ProgressValue)).toBe('reverse')
  })
})

describe('gradeCard', () => {
  it('creates learning progress for a new card', () => {
    const p = gradeCard('at://card', null, Rating.Good, 'at://deck', 'forward', 'quick', NOW)
    expect(p).toMatchObject({
      card: 'at://card',
      deck: 'at://deck',
      state: 'learning',
      lastRating: 'good',
      repetitions: 1,
      shortTermStep: 1,
      direction: undefined,
    })
    expect(new Date(p.dueAt).getTime()).toBeGreaterThan(NOW.getTime())
  })

  it('graduates to review and keeps the deck and direction of existing progress', () => {
    const first = gradeCard('at://card', null, Rating.Easy, 'at://deck', 'reverse', 'quick', NOW)
    expect(first).toMatchObject({ state: 'review', direction: 'reverse', shortTermStep: undefined })

    const later = new Date(first.dueAt)
    const second = gradeCard('at://card', first, Rating.Good, undefined, undefined, 'quick', later)
    expect(second).toMatchObject({ deck: 'at://deck', direction: 'reverse', repetitions: 2 })
  })

  it('counts a lapse and relearns after Again on a review card', () => {
    const review = gradeCard('at://card', null, Rating.Easy, undefined, 'forward', 'quick', NOW)
    const lapsed = gradeCard('at://card', review, Rating.Again, undefined, 'forward', 'quick', new Date(review.dueAt))
    expect(lapsed).toMatchObject({ state: 'relearning', lapses: 1, lastRating: 'again' })
  })
})

describe('progressToCard / cardToProgress', () => {
  it('round-trips the scheduling fields', () => {
    const p = gradeCard('at://card', null, Rating.Good, 'at://deck', 'forward', 'quick', NOW)
    const card = progressToCard(p)
    expect(card.reps).toBe(p.repetitions)
    expect(cardToProgress('at://card', card, Rating.Good, 'at://deck')).toMatchObject({
      dueAt: p.dueAt,
      stability: p.stability,
      difficulty: p.difficulty,
      state: p.state,
    })
  })
})

describe('isDue', () => {
  it('treats missing progress as due', () => {
    expect(isDue(null, NOW)).toBe(true)
  })

  it('compares the due date to now', () => {
    const p = { dueAt: NOW.toISOString() } as ProgressValue
    expect(isDue(p, NOW)).toBe(true)
    expect(isDue(p, new Date(NOW.getTime() - 1))).toBe(false)
  })
})

describe('intervalPreview', () => {
  it('previews short steps in minutes for a new card', () => {
    const preview = intervalPreview(null, 'quick', NOW)
    expect(preview.again).toBe('1m')
    expect(Object.keys(preview)).toEqual(['again', 'hard', 'good', 'easy'])
  })

  it('formats hours, days, months and years', () => {
    const review = gradeCard('at://c', null, Rating.Easy, undefined, 'forward', 'quick', NOW)
    const preview = intervalPreview(review, 'quick', new Date(review.dueAt))
    expect(preview.easy).toMatch(/^\d+(d|mo|y)$/)

    const values = [
      intervalPreview(null, 'relaxed', NOW).good,
      intervalPreview(null, 'spaced', NOW).good,
      intervalPreview(null, 'spaced', NOW).easy,
    ]
    expect(values[0]).toMatch(/h$/)
    expect(values[1]).toMatch(/^\d+(h|d)$/)
    expect(values[2]).toMatch(/d$/)
  })

  it('reaches months and years for well-known cards', () => {
    let p: ProgressValue | null = null
    let at = NOW
    for (let i = 0; i < 12; i++) {
      p = gradeCard('at://c', p, Rating.Easy, undefined, 'forward', 'quick', at)
      at = new Date(p.dueAt)
    }
    expect(intervalPreview(p, 'quick', at).easy).toMatch(/(mo|y)$/)
  })
})
