import { describe, expect, it } from 'vitest'
import {
  balanceHint,
  isTier,
  latticeTile,
  packStudyDays,
  publishedTier,
  studyDays,
  summarizeTier,
  TIERS,
  tierRank,
  tierTile,
  unpackStudyDays,
  type StudyDays,
} from '~/utils/tiers'
import { addDays, dayKey } from '~/utils/day'

const NOW = new Date(2026, 5, 15, 12)

function daysEndingToday(count: number, sessions = 1, now = NOW): StudyDays {
  const days: StudyDays = {}
  for (let i = 0; i < count; i++) days[dayKey(addDays(now, -i))] = sessions
  return days
}

describe('isTier / tierRank', () => {
  it('accepts only known tier names', () => {
    expect(isTier('gold')).toBe(true)
    expect(isTier('wood')).toBe(false)
    expect(isTier(3)).toBe(false)
  })

  it('ranks tiers in order', () => {
    expect(TIERS.map(tierRank)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })
})

describe('studyDays', () => {
  it('counts sessions on a day, merging those less than two hours apart', () => {
    const at = (h: number) => new Date(Date.UTC(2026, 5, 1, h)).toISOString()
    const days = studyDays({}, [
      { startedAt: at(8), endedAt: at(9), repetitions: 5 },
      { startedAt: at(10), endedAt: at(10), repetitions: 5 },
      { startedAt: at(14), endedAt: at(15), repetitions: 5 },
    ])
    expect(days).toEqual({ '2026-06-01': 2 })
  })

  it('ignores empty and invalid sessions', () => {
    const days = studyDays({}, [
      { startedAt: '2026-06-01T08:00:00Z', endedAt: '2026-06-01T09:00:00Z', repetitions: 0 },
      { startedAt: 'nope', endedAt: 'nope', repetitions: 4 },
    ])
    expect(days).toEqual({})
  })

  it('treats an invalid end as an instant session', () => {
    expect(studyDays({}, [{ startedAt: '2026-06-01T08:00:00Z', endedAt: 'x', repetitions: 1 }])).toEqual({
      '2026-06-01': 1,
    })
  })

  it('adds days with activity but no session as one session', () => {
    expect(studyDays({ '2026-06-02': 4, '2026-06-03': 0 }, [])).toEqual({ '2026-06-02': 1 })
  })
})

describe('summarizeTier', () => {
  it('starts at bronze with no activity', () => {
    const summary = summarizeTier({}, NOW)
    expect(summary).toMatchObject({
      tier: 'bronze',
      activeDays: 0,
      studiedToday: false,
      atRisk: false,
      next: 'silver',
      progress: 0,
    })
    expect(summary.days).toHaveLength(28)
  })

  it('rises with a steady habit', () => {
    const light = summarizeTier(daysEndingToday(7), NOW)
    const heavy = summarizeTier(daysEndingToday(28), NOW)
    expect(tierRank(light.tier)).toBeGreaterThan(0)
    expect(tierRank(heavy.tier)).toBeGreaterThan(tierRank(light.tier))
    expect(heavy.studiedToday).toBe(true)
    expect(heavy.activeDays).toBe(28)
  })

  it('reports days until the next tier and never exposes the secret tier', () => {
    const summary = summarizeTier(daysEndingToday(3), NOW)
    expect(summary.next).not.toBeNull()
    expect(summary.daysToNext).toBeGreaterThan(0)

    const top = summarizeTier(daysEndingToday(56, 3), NOW)
    expect(top.tier).toBe('supernova')
    expect(top.next).toBeNull()
    expect(top.progress).toBe(1)
  })

  it('does not count today against the habit until it is over', () => {
    const days = daysEndingToday(20)
    delete days[dayKey(NOW)]
    const summary = summarizeTier(days, NOW)
    expect(summary.studiedToday).toBe(false)
    expect(summary.atRisk).toBe(false)
  })

  it('drops a tier after the activity stops', () => {
    const before = summarizeTier(daysEndingToday(28), NOW)
    const later = summarizeTier(daysEndingToday(28), addDays(NOW, 40))
    expect(tierRank(later.tier)).toBeLessThan(tierRank(before.tier))
  })

  it('flags a tier at risk when skipping today would lose it', () => {
    const risky = Array.from({ length: 30 }, (_, i) => summarizeTier(daysEndingToday(12), addDays(NOW, i))).some(
      (s) => s.atRisk,
    )
    expect(risky).toBe(true)
  })
})

describe('publishedTier', () => {
  const now = Date.UTC(2026, 5, 15)

  it('rejects unknown tiers', () => {
    expect(publishedTier('wood', undefined, now)).toBeNull()
  })

  it('keeps the tier when the timestamp is missing or invalid', () => {
    expect(publishedTier('gold', undefined, now)).toBe('gold')
    expect(publishedTier('gold', 'garbage', now)).toBe('gold')
  })

  it('drops one tier per week since publishing, bottoming out at bronze', () => {
    const weeksAgo = (w: number) => new Date(now - w * 7 * 86400000).toISOString()
    expect(publishedTier('gold', weeksAgo(0), now)).toBe('gold')
    expect(publishedTier('gold', weeksAgo(1), now)).toBe('silver')
    expect(publishedTier('gold', weeksAgo(9), now)).toBe('bronze')
  })

  it('never goes negative for timestamps in the future', () => {
    expect(publishedTier('gold', new Date(now + 86400000).toISOString(), now)).toBe('gold')
  })
})

describe('packStudyDays / unpackStudyDays', () => {
  it('round-trips the last days, capping sessions per day', () => {
    const packed = packStudyDays({ '2026-06-15': 9, '2026-06-14': 2 }, NOW)
    expect(packed.studyDaysEnd).toBe('2026-06-15')
    expect(packed.studyDays.at(-1)).toBe(3)
    expect(unpackStudyDays(packed.studyDays, packed.studyDaysEnd)).toEqual({ '2026-06-15': 3, '2026-06-14': 2 })
  })

  it('returns null for malformed input', () => {
    expect(unpackStudyDays('x', '2026-06-15')).toBeNull()
    expect(unpackStudyDays([1], 5)).toBeNull()
    expect(unpackStudyDays([1], 'bad')).toBeNull()
  })

  it('skips non-positive and non-numeric entries', () => {
    expect(unpackStudyDays([0, 'a', 2], '2026-06-15')).toEqual({ '2026-06-15': 2 })
  })
})

describe('balanceHint', () => {
  it('returns null without a load', () => {
    expect(balanceHint(null)).toBeNull()
  })

  it('warns about a long or heavy day', () => {
    expect(balanceHint({ repetitions: 1, newCards: 0, activeSeconds: 45 * 60 })).toBe('plenty')
    expect(balanceHint({ repetitions: 400, newCards: 0, activeSeconds: 0 })).toBe('plenty')
  })

  it('warns about many new cards', () => {
    expect(balanceHint({ repetitions: 10, newCards: 40, activeSeconds: 60 })).toBe('manyNew')
  })

  it('stays quiet for a normal day', () => {
    expect(balanceHint({ repetitions: 10, newCards: 5, activeSeconds: 60 })).toBeNull()
  })
})

describe('tiles', () => {
  it('builds an svg data url for every tier', () => {
    for (const tier of TIERS) expect(tierTile(tier)).toMatch(/^url\("data:image\/svg\+xml,/)
  })

  it('builds a lattice with and without a tier, escaping glyphs', () => {
    const plain = decodeURIComponent(latticeTile(null, ['<', 'a']))
    expect(plain).toContain('&#60;')
    expect(plain).not.toContain('stroke-width="2"')
    expect(decodeURIComponent(latticeTile('gold', ['a']))).toContain('stroke-width="2"')
  })
})
