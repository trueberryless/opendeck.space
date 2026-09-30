import { describe, expect, it } from 'vitest'
import {
  challengeDayKeys,
  challengeStatus,
  challengeWindow,
  daysLeft,
  entryDays,
  normalizeChallenge,
  normalizeEntry,
  sameDays,
  standings,
  type ChallengeValue,
} from '~/utils/challenges'

const challenge: ChallengeValue = {
  title: 'Week',
  kind: 'studyDays',
  startsAt: new Date(2026, 5, 1).toISOString(),
  endsAt: new Date(2026, 5, 5).toISOString(),
  createdAt: new Date(2026, 5, 1).toISOString(),
}

describe('normalizeChallenge', () => {
  it('accepts a valid challenge and defaults createdAt', () => {
    const { createdAt: _, ...raw } = challenge
    expect(normalizeChallenge(raw)).toEqual({ ...challenge, createdAt: challenge.startsAt })
  })

  it('rejects invalid shapes', () => {
    expect(normalizeChallenge(null)).toBeNull()
    expect(normalizeChallenge({ ...challenge, kind: 'other' })).toBeNull()
    expect(normalizeChallenge({ ...challenge, title: 4 })).toBeNull()
    expect(normalizeChallenge({ ...challenge, startsAt: 'x' })).toBeNull()
    expect(normalizeChallenge({ ...challenge, endsAt: challenge.startsAt })).toBeNull()
  })
})

describe('normalizeEntry', () => {
  it('sorts and de-duplicates valid days', () => {
    const entry = normalizeEntry({ challenge: 'at://c', days: ['2026-06-03', 'bad', '2026-06-01', '2026-06-03', 4] })
    expect(entry?.days).toEqual(['2026-06-01', '2026-06-03'])
    expect(entry?.createdAt).toBe(new Date(0).toISOString())
  })

  it('rejects entries without a challenge and tolerates missing days', () => {
    expect(normalizeEntry({})).toBeNull()
    expect(normalizeEntry({ challenge: 'c' })?.days).toEqual([])
  })
})

describe('challengeWindow', () => {
  it('spans whole weeks from the start of today', () => {
    const { startsAt, endsAt } = challengeWindow(2, new Date(2026, 5, 10, 15))
    expect(new Date(startsAt).getHours()).toBe(0)
    expect((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 86400000).toBe(14)
  })
})

describe('challengeDayKeys', () => {
  it('lists one key per day, excluding the end', () => {
    expect(challengeDayKeys(challenge)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04'])
  })
})

describe('challengeStatus / daysLeft', () => {
  it('moves from upcoming to running to ended', () => {
    const at = (d: number) => new Date(2026, 5, d).getTime()
    expect(challengeStatus(challenge, at(1) - 1)).toBe('upcoming')
    expect(challengeStatus(challenge, at(2))).toBe('running')
    expect(challengeStatus(challenge, at(5))).toBe('ended')
  })

  it('counts the remaining days without going negative', () => {
    expect(daysLeft(challenge, new Date(2026, 5, 2).getTime())).toBe(3)
    expect(daysLeft(challenge, new Date(2026, 6, 1).getTime())).toBe(0)
  })
})

describe('entryDays / sameDays', () => {
  it('keeps only studied days inside the challenge', () => {
    expect(entryDays(challenge, { '2026-06-01': 3, '2026-06-02': 0, '2026-06-09': 5 })).toEqual(['2026-06-01'])
  })

  it('compares day lists', () => {
    expect(sameDays(['a'], ['a'])).toBe(true)
    expect(sameDays(['a'], ['b'])).toBe(false)
    expect(sameDays(['a'], [])).toBe(false)
  })
})

describe('standings', () => {
  const now = new Date(2026, 5, 4, 12)

  it('ranks by studied days in a studyDays challenge, sharing ranks on ties', () => {
    const rows = standings(
      challenge,
      [
        { did: 'b', days: ['2026-06-01', '2026-06-02'] },
        { did: 'a', days: ['2026-06-01', '2026-06-03'] },
        { did: 'c', days: ['2026-06-01'] },
      ],
      now,
    )
    expect(rows.map((r) => [r.did, r.rank])).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 3],
    ])
  })

  it('eliminates a participant who missed a settled day in an everyDay challenge', () => {
    const rows = standings(
      { ...challenge, kind: 'everyDay' },
      [
        { did: 'quitter', days: ['2026-06-01', '2026-06-03'] },
        { did: 'steady', days: ['2026-06-01', '2026-06-02', '2026-06-03'] },
      ],
      now,
    )
    expect(rows[0]).toMatchObject({ did: 'steady', out: false, survived: 3, marks: ['done', 'done', 'done', 'open'] })
    expect(rows[1]).toMatchObject({ did: 'quitter', out: true, survived: 1, studied: 2 })
    expect(rows[1]!.marks).toEqual(['done', 'missed', 'done', 'open'])
  })
})
