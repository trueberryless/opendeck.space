import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { accessibleAccents } from '~/utils/contrast'
import { parseDevRoles, parseDevTier } from '~/utils/devTheme'
import { formatStudyTime } from '~/utils/duration'
import {
  battlePath,
  challengePath,
  deckPath,
  isNavActive,
  NAV_ITEMS,
  profilePath,
  studyPath,
  visibleNavItems,
} from '~/utils/nav'
import { pluralCategories, pluralRule } from '~/utils/plural'
import { chunks, retryAfterMs, retryOnRateLimit } from '~/utils/ratelimit'
import { nextTid } from '~/utils/tid'

describe('accessibleAccents', () => {
  it('returns null for invalid colors', () => {
    expect(accessibleAccents('nope')).toBeNull()
    expect(accessibleAccents('#12')).toBeNull()
  })

  it('darkens for light mode and lightens for dark mode', () => {
    const { light, dark } = accessibleAccents('#888888')!
    expect(parseInt(light.slice(1, 3), 16)).toBeLessThan(0x88)
    expect(parseInt(dark.slice(1, 3), 16)).toBeGreaterThan(0x88)
  })

  it('expands short hex and keeps already accessible colors', () => {
    expect(accessibleAccents('#000')!.light).toBe('#000000')
    expect(accessibleAccents('#fff')!.dark).toBe('#ffffff')
  })
})

describe('parseDevTier / parseDevRoles', () => {
  it('parses tiers', () => {
    expect(parseDevTier('gold')).toBe('gold')
    expect(parseDevTier('none')).toBe('none')
    expect(parseDevTier('wood')).toBeNull()
  })

  it('parses role lists', () => {
    expect(parseDevRoles('none')).toEqual([])
    expect(parseDevRoles('creator,bogus,tester')).toEqual(['creator', 'tester'])
    expect(parseDevRoles('bogus')).toBeNull()
    expect(parseDevRoles(3)).toBeNull()
  })
})

describe('formatStudyTime', () => {
  it('shows minutes below an hour, at least one', () => {
    expect(formatStudyTime(10, 'en')).toBe('1 minute')
    expect(formatStudyTime(600, 'en')).toBe('10 minutes')
  })

  it('shows fractional hours from an hour', () => {
    expect(formatStudyTime(5400, 'en')).toBe('1.5 hours')
  })
})

describe('navigation helpers', () => {
  it('hides auth-only items for guests', () => {
    expect(visibleNavItems(false).map((i) => i.to)).toEqual(['/', '/discover'])
    expect(visibleNavItems(true)).toEqual(NAV_ITEMS)
  })

  it('matches the active item by prefix except for home', () => {
    expect(isNavActive('/', '/')).toBe(true)
    expect(isNavActive('/discover', '/')).toBe(false)
    expect(isNavActive('/study/a/b', '/study')).toBe(true)
  })

  it('builds paths', () => {
    expect(deckPath('a', 'b')).toBe('/decks/a/b')
    expect(studyPath('a', 'b')).toBe('/study/a/b')
    expect(profilePath('a')).toBe('/profile/a')
    expect(challengePath('a', 'b')).toBe('/together/challenges/a/b')
    expect(battlePath('a', 'b', 'k')).toBe('/together/battle/a/b#k=k')
  })
})

describe('plural helpers', () => {
  it('orders categories from zero to other', () => {
    expect(pluralCategories('en')).toEqual(['one', 'other'])
    expect(pluralCategories('ar')).toEqual(['zero', 'one', 'two', 'few', 'many', 'other'])
  })

  it('picks the form index for a count', () => {
    const en = pluralRule('en')
    expect(en(1, 2)).toBe(0)
    expect(en(5, 2)).toBe(1)
    expect(en(5, 1)).toBe(0)
    expect(pluralRule('ja')(3, 2)).toBe(0)
  })
})

describe('chunks', () => {
  it('splits into batches', () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunks([])).toEqual([])
    expect(chunks(Array.from({ length: 11 }, (_, i) => i))).toHaveLength(2)
  })
})

describe('retryAfterMs', () => {
  it('ignores errors that are not rate limits', () => {
    expect(retryAfterMs(new Error('boom'))).toBeNull()
    expect(retryAfterMs(undefined)).toBeNull()
  })

  it('detects a rate limit by status or message', () => {
    expect(retryAfterMs({ status: 429 })).toBe(60_000)
    expect(retryAfterMs({ statusCode: 429 })).toBe(60_000)
    expect(retryAfterMs({ cause: { status: 429 } })).toBe(60_000)
    expect(retryAfterMs(new Error('Too Many Requests'))).toBe(60_000)
  })

  it('honours retry-after and ratelimit-reset headers', () => {
    expect(retryAfterMs({ status: 429, headers: { 'retry-after': '3' } })).toBe(3000)
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    expect(retryAfterMs({ status: 429, headers: { 'ratelimit-reset': '1005' } })).toBe(5000)
    expect(retryAfterMs({ status: 429, headers: { 'ratelimit-reset': '1' } })).toBe(1000)
  })
})

describe('retryOnRateLimit', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('retries after the wait and returns the result', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce({ status: 429, headers: { 'retry-after': '2' } })
      .mockResolvedValue('ok')
    const result = retryOnRateLimit(fn)
    await vi.advanceTimersByTimeAsync(2000)
    await expect(result).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('rethrows other errors immediately', async () => {
    await expect(retryOnRateLimit(() => Promise.reject(new Error('nope')))).rejects.toThrow('nope')
  })
})

describe('nextTid', () => {
  it('produces 13 sortable base32 characters', () => {
    expect(nextTid()).toMatch(/^[2-7a-z]{13}$/)
  })

  it('is strictly increasing even within the same millisecond', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const tids = Array.from({ length: 50 }, nextTid)
    expect([...tids].sort()).toEqual(tids)
    expect(new Set(tids).size).toBe(50)
  })
})
