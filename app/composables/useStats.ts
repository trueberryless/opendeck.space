import { addDays, dayKey, startOfDay } from '~/utils/day'
import { normalizeSession, type ProgressValue, type SessionValue } from '~/utils/records'

export interface StudyStats {
  learned: number
  learning: number
  totalTracked: number
  totalCards: number
  repetitions: number
  lastActive: string | null
  mostTrained: { front: string; repetitions: number } | null
  activity: Record<string, number>
  daysPerWeek: number
  yearRepetitions: number
  yearActiveDays: number
  yearSeconds: number
  retention: number | null
}

export function useStats() {
  const stats = ref<StudyStats | null>(null)
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      const decks = useDecks()
      const study = useStudy()

      const [myDecks, map, sessions] = await Promise.all([decks.listMyDecks(), study.loadProgressMap(), loadSessions()])
      const frontByUri = new Map<string, string>()
      let totalCards = 0
      for (const cards of (await decks.listAllMyCards(myDecks)).values()) {
        totalCards += cards.length
        for (const c of cards) frontByUri.set(c.uri, c.value.front)
      }

      const progresses: ProgressValue[] = [...map.values()].map((r) => r.value)
      stats.value = compute(progresses, sessions, frontByUri, totalCards)
      useMotivation().apply(stats.value.activity, sessions)
    } catch (err) {
      console.error('[opendeck] failed to compute stats', err)
      stats.value = null
    } finally {
      loading.value = false
    }
  }

  return { stats, loading, load }
}

export async function loadSessions(): Promise<SessionValue[]> {
  const sync = useSync()
  const airspace = onlineAirspace()
  let byRkey: Map<string, SessionValue> | null = null

  if (airspace) {
    try {
      const fetched = new Map<string, SessionValue>()
      for (const r of await airspace.session.list()) fetched.set(r.rkey, normalizeSession(r.value))
      if (await useSpacesSupport().ensure()) {
        for (const r of await airspace.vault.session.list()) fetched.set(r.rkey, normalizeSession(r.value))
      }
      await sync.cacheSessions(fetched)
      byRkey = fetched
    } catch (err) {
      console.error('[opendeck] falling back to cached study sessions', err)
    }
  }

  byRkey ??= await sync.getCachedSessions()
  for (const q of await sync.getQueuedSessions()) byRkey.set(q.rkey, normalizeSession(q.value))
  return [...byRkey.values()]
}

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

const RHYTHM_DAYS = 28

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000)
}

function firstStudyDay(activity: Record<string, number>): string | null {
  let first: string | null = null
  for (const [key, count] of Object.entries(activity)) if (count > 0 && (!first || key < first)) first = key
  return first
}

function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

function compute(
  progresses: ProgressValue[],
  sessions: SessionValue[],
  frontByUri: Map<string, string>,
  totalCards: number,
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
  const yearStart = addDays(today, -364).getTime()
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

  let yearRepetitions = 0
  let yearActiveDays = 0
  let rhythmActiveDays = 0
  for (let i = 0; i < 365; i++) {
    const count = activity[dayKey(addDays(today, -i))] ?? 0
    yearRepetitions += count
    if (count > 0) yearActiveDays++
    if (count > 0 && i < RHYTHM_DAYS) rhythmActiveDays++
  }

  const first = firstStudyDay(activity)
  const studyingFor = first ? Math.min(RHYTHM_DAYS, daysBetween(fromDayKey(first), today) + 1) : RHYTHM_DAYS

  return {
    learned,
    learning,
    totalTracked: byCard.size,
    totalCards,
    repetitions: Math.max(repetitions, sessionRepetitions),
    lastActive,
    mostTrained,
    activity,
    daysPerWeek: rhythmActiveDays / (Math.max(7, studyingFor) / 7),
    yearRepetitions,
    yearActiveDays,
    yearSeconds,
    retention: monthRepetitions > 0 ? (monthRepetitions - monthAgain) / monthRepetitions : null,
  }
}
