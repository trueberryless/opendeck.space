import { addDays, dayKey, parseDayKey, startOfDay } from '~/utils/day'
import type { ProgressValue, PublicStats, SessionValue } from '~/utils/records'

const RHYTHM_DAYS = 28
const YEAR_DAYS = 365
const PUBLIC_ACTIVITY_DAYS = 371

export function buildActivity(progresses: ProgressValue[], sessions: SessionValue[]): Record<string, number> {
  const activity: Record<string, number> = {}
  for (const p of progresses) {
    if (!p.lastReviewedAt) continue
    const key = dayKey(new Date(p.lastReviewedAt))
    activity[key] = (activity[key] ?? 0) + 1
  }
  const fromSessions: Record<string, number> = {}
  for (const s of sessions) {
    const key = dayKey(new Date(s.startedAt))
    fromSessions[key] = (fromSessions[key] ?? 0) + s.repetitions
  }
  for (const [key, count] of Object.entries(fromSessions)) activity[key] = Math.max(count, activity[key] ?? 0)
  return activity
}

export function computeStats(
  progresses: ProgressValue[],
  sessions: SessionValue[],
  frontByUri: Map<string, string>,
): StudyStats {
  let repetitions = 0
  let lastActive: string | null = null
  const byCard = new Map<string, { state: 'learned' | 'learning' | 'new'; repetitions: number }>()

  for (const p of progresses) {
    repetitions += p.repetitions || 0
    if (p.lastReviewedAt && (!lastActive || p.lastReviewedAt > lastActive)) lastActive = p.lastReviewedAt
    if (!frontByUri.has(p.card)) continue

    const card = byCard.get(p.card) ?? { state: 'new', repetitions: 0 }
    card.repetitions += p.repetitions || 0
    if (p.state === 'review') card.state = 'learned'
    else if ((p.state === 'learning' || p.state === 'relearning') && card.state === 'new') card.state = 'learning'
    byCard.set(p.card, card)
  }

  let learned = 0
  let learning = 0
  let mostTrained: { front: string; repetitions: number } | null = null
  for (const [uri, card] of byCard) {
    if (card.state === 'learned') learned++
    else if (card.state === 'learning') learning++
    if (card.repetitions > 0 && (!mostTrained || card.repetitions > mostTrained.repetitions)) {
      mostTrained = { front: frontByUri.get(uri)!, repetitions: card.repetitions }
    }
  }

  const today = startOfDay(new Date())
  const yearStart = addDays(today, -(YEAR_DAYS - 1)).getTime()
  const monthStart = addDays(today, -29).getTime()
  let yearSeconds = 0
  let sessionRepetitions = 0
  let monthRepetitions = 0
  let monthAgain = 0

  for (const s of sessions) {
    if (s.endedAt && (!lastActive || s.endedAt > lastActive)) lastActive = s.endedAt
    const started = new Date(s.startedAt).getTime()
    sessionRepetitions += s.repetitions
    if (started >= yearStart) yearSeconds += s.activeSeconds
    if (started >= monthStart) {
      monthRepetitions += s.repetitions
      monthAgain += s.again
    }
  }

  const activity = buildActivity(progresses, sessions)
  const first = firstStudyDay(activity)

  return {
    learned,
    learning,
    repetitions: Math.max(repetitions, sessionRepetitions),
    lastActive,
    mostTrained,
    firstStudyDay: first,
    activity,
    ...summarizeActivity(activity, first, today),
    yearSeconds,
    retention: monthRepetitions > 0 ? (monthRepetitions - monthAgain) / monthRepetitions : null,
  }
}

export function toPublicStats(stats: StudyStats, now = new Date()): PublicStats {
  const end = startOfDay(now)
  const activity: number[] = []
  for (let i = PUBLIC_ACTIVITY_DAYS - 1; i >= 0; i--) activity.push(stats.activity[dayKey(addDays(end, -i))] ?? 0)
  return {
    learned: stats.learned,
    learning: stats.learning,
    repetitions: stats.repetitions,
    secondsStudied: Math.round(stats.yearSeconds),
    lastStudiedAt: stats.lastActive ?? undefined,
    firstStudiedOn: stats.firstStudyDay ?? undefined,
    activity,
    activityEnd: dayKey(end),
    updatedAt: now.toISOString(),
  }
}

export function samePublicStats(a: PublicStats | undefined, b: PublicStats | undefined): boolean {
  if (!a || !b) return a === b
  const { updatedAt: _a, ...restA } = a
  const { updatedAt: _b, ...restB } = b
  return JSON.stringify(restA) === JSON.stringify(restB)
}

export function fromPublicStats(raw: unknown): StudyStats | null {
  const p = raw as Partial<PublicStats> | undefined
  const end = typeof p?.activityEnd === 'string' ? parseDayKey(p.activityEnd) : null
  if (!p || !end || !Array.isArray(p.activity)) return null
  const activity: Record<string, number> = {}
  const offset = p.activity.length - 1
  for (const [i, count] of p.activity.entries()) {
    if (typeof count === 'number' && count > 0) activity[dayKey(addDays(end, i - offset))] = count
  }
  const firstDay = typeof p.firstStudiedOn === 'string' ? p.firstStudiedOn : firstStudyDay(activity)
  return {
    learned: Number(p.learned) || 0,
    learning: Number(p.learning) || 0,
    repetitions: Number(p.repetitions) || 0,
    lastActive: typeof p.lastStudiedAt === 'string' ? p.lastStudiedAt : null,
    mostTrained: null,
    firstStudyDay: firstDay,
    activity,
    ...summarizeActivity(activity, firstDay, startOfDay(new Date())),
    yearSeconds: Number(p.secondsStudied) || 0,
    retention: null,
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : undefined,
  }
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000)
}

function firstStudyDay(activity: Record<string, number>): string | null {
  let first: string | null = null
  for (const [key, count] of Object.entries(activity)) if (count > 0 && (!first || key < first)) first = key
  return first
}

function summarizeActivity(activity: Record<string, number>, firstDay: string | null, today: Date) {
  let yearRepetitions = 0
  let yearActiveDays = 0
  let rhythmActiveDays = 0
  for (let i = 0; i < YEAR_DAYS; i++) {
    const count = activity[dayKey(addDays(today, -i))] ?? 0
    yearRepetitions += count
    if (count > 0) yearActiveDays++
    if (count > 0 && i < RHYTHM_DAYS) rhythmActiveDays++
  }
  const first = firstDay ? parseDayKey(firstDay) : null
  const studyingFor = first ? Math.min(RHYTHM_DAYS, daysBetween(first, today) + 1) : RHYTHM_DAYS
  return { yearRepetitions, yearActiveDays, daysPerWeek: rhythmActiveDays / (Math.max(7, studyingFor) / 7) }
}

export interface StudyStats {
  learned: number
  learning: number
  repetitions: number
  lastActive: string | null
  mostTrained: { front: string; repetitions: number } | null
  firstStudyDay: string | null
  activity: Record<string, number>
  daysPerWeek: number
  yearRepetitions: number
  yearActiveDays: number
  yearSeconds: number
  retention: number | null
  updatedAt?: string
}
