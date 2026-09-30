import { describe, expect, it } from 'vitest'
import { addDays, dayKey, parseDayKey, startOfDay } from '~/utils/day'

describe('dayKey', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('parseDayKey', () => {
  it('round-trips with dayKey', () => {
    expect(dayKey(parseDayKey('2026-03-09')!)).toBe('2026-03-09')
  })

  it('returns null for malformed keys', () => {
    expect(parseDayKey('2026-3-9')).toBeNull()
  })
})

describe('addDays', () => {
  it('crosses month boundaries without mutating the input', () => {
    const d = new Date(2026, 0, 31)
    expect(dayKey(addDays(d, 1))).toBe('2026-02-01')
    expect(dayKey(d)).toBe('2026-01-31')
  })
})

describe('startOfDay', () => {
  it('zeroes the time', () => {
    expect(startOfDay(new Date(2026, 0, 5, 13, 45)).getHours()).toBe(0)
  })
})
