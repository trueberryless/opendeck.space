import { addDays, dayKey, startOfDay } from '~/utils/day'

export const CHALLENGE_KINDS = ['studyDays', 'everyDay'] as const
export type ChallengeKind = (typeof CHALLENGE_KINDS)[number]

export const CHALLENGE_WEEKS = [1, 2, 4] as const

export interface ChallengeValue {
  title: string
  kind: ChallengeKind
  startsAt: string
  endsAt: string
  createdAt: string
}

export interface ChallengeEntryValue {
  challenge: string
  days: string[]
  createdAt: string
  updatedAt?: string
}

export type ChallengeStatus = 'upcoming' | 'running' | 'ended'
export type DayMark = 'done' | 'missed' | 'open'

export interface Standing {
  did: string
  studied: number
  survived: number
  out: boolean
  rank: number
  marks: DayMark[]
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

function isDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime())
}

export function normalizeChallenge(raw: unknown): ChallengeValue | null {
  const r = (raw ?? {}) as Record<string, unknown>
  if (typeof r.title !== 'string' || !(CHALLENGE_KINDS as readonly unknown[]).includes(r.kind)) return null
  if (!isDate(r.startsAt) || !isDate(r.endsAt) || r.endsAt <= r.startsAt) return null
  return {
    title: r.title,
    kind: r.kind as ChallengeKind,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    createdAt: isDate(r.createdAt) ? r.createdAt : r.startsAt,
  }
}

export function normalizeEntry(raw: unknown): ChallengeEntryValue | null {
  const r = (raw ?? {}) as Record<string, unknown>
  if (typeof r.challenge !== 'string') return null
  const days = Array.isArray(r.days) ? r.days.filter((d): d is string => typeof d === 'string' && DAY_KEY.test(d)) : []
  return {
    challenge: r.challenge,
    days: [...new Set(days)].sort(),
    createdAt: isDate(r.createdAt) ? r.createdAt : new Date(0).toISOString(),
    updatedAt: isDate(r.updatedAt) ? r.updatedAt : undefined,
  }
}

export function challengeWindow(weeks: number, now = new Date()): Pick<ChallengeValue, 'startsAt' | 'endsAt'> {
  const start = startOfDay(now)
  return { startsAt: start.toISOString(), endsAt: addDays(start, weeks * 7).toISOString() }
}

export function challengeDayKeys(challenge: ChallengeValue): string[] {
  const end = new Date(challenge.endsAt).getTime()
  const keys: string[] = []
  for (let day = startOfDay(new Date(challenge.startsAt)); day.getTime() < end; day = addDays(day, 1)) {
    keys.push(dayKey(day))
  }
  return keys
}

export function challengeStatus(challenge: ChallengeValue, now = Date.now()): ChallengeStatus {
  if (now < new Date(challenge.startsAt).getTime()) return 'upcoming'
  return now < new Date(challenge.endsAt).getTime() ? 'running' : 'ended'
}

export function daysLeft(challenge: ChallengeValue, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(challenge.endsAt).getTime() - now) / 86400000))
}

export function entryDays(challenge: ChallengeValue, studied: Record<string, number>): string[] {
  return challengeDayKeys(challenge).filter((key) => (studied[key] ?? 0) > 0)
}

export function sameDays(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((d, i) => d === b[i])
}

export function standings(
  challenge: ChallengeValue,
  entries: readonly { did: string; days: readonly string[] }[],
  now = new Date(),
): Standing[] {
  const keys = challengeDayKeys(challenge)
  const settledBefore = dayKey(addDays(startOfDay(now), -1))

  const rows = entries.map(({ did, days }) => {
    const set = new Set(days)
    let survived = 0
    let out = false
    const marks = keys.map((key): DayMark => {
      if (set.has(key)) {
        if (!out) survived++
        return 'done'
      }
      if (key < settledBefore) {
        out = true
        return 'missed'
      }
      return 'open'
    })
    return { did, studied: keys.filter((k) => set.has(k)).length, survived, out, rank: 0, marks }
  })

  const everyDay = challenge.kind === 'everyDay'
  const compare = (a: Standing, b: Standing) =>
    everyDay ? Number(a.out) - Number(b.out) || b.survived - a.survived : b.studied - a.studied
  rows.sort((a, b) => compare(a, b) || a.did.localeCompare(b.did))
  rows.forEach((row, i) => {
    const previous = rows[i - 1]
    row.rank = previous && compare(previous, row) === 0 ? previous.rank : i + 1
  })
  return rows
}
