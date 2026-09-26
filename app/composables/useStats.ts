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
      for (const d of myDecks) {
        const cards = await decks.listMyCards(d.rkey, d.visibility)
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
  const byRkey = new Map<string, SessionValue>()

  if (sync.online.value) {
    const airspace = requireAirspace()
    try {
      for (const r of await airspace.session.list()) byRkey.set(r.rkey, normalizeSession(r.value))
    } catch (err) {
      console.error('[opendeck] failed to load study sessions', err)
    }
    if (await useSpacesSupport().ensure()) {
      try {
        for (const r of await airspace.vault.session.list()) byRkey.set(r.rkey, normalizeSession(r.value))
      } catch (err) {
        console.error('[opendeck] failed to load private study sessions', err)
      }
    }
  }

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

function compute(
  progresses: ProgressValue[],
  sessions: SessionValue[],
  frontByUri: Map<string, string>,
  totalCards: number,
): StudyStats {
  let learned = 0
  let learning = 0
  let repetitions = 0
  let lastActive: string | null = null
  let mostTrained: { front: string; repetitions: number } | null = null

  for (const p of progresses) {
    if (p.state === 'review') learned++
    else if (p.state === 'learning' || p.state === 'relearning') learning++
    repetitions += p.repetitions || 0

    if (p.lastReviewedAt && (!lastActive || p.lastReviewedAt > lastActive)) lastActive = p.lastReviewedAt

    if (p.repetitions > 0 && (!mostTrained || p.repetitions > mostTrained.repetitions)) {
      const front = frontByUri.get(p.card)
      if (front) mostTrained = { front, repetitions: p.repetitions }
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
    if (!lastActive || s.endedAt > lastActive) lastActive = s.endedAt
    const started = new Date(s.startedAt)
    sessionRepetitions += s.repetitions
    if (started.getTime() >= yearStart) yearSeconds += s.activeSeconds
    if (started.getTime() >= monthStart) {
      monthRepetitions += s.repetitions
      monthAgain += s.again
    }
  }

  const activity = buildActivity(progresses, sessions)

  let yearRepetitions = 0
  let yearActiveDays = 0
  let monthActiveDays = 0
  for (let i = 0; i < 365; i++) {
    const count = activity[dayKey(addDays(today, -i))] ?? 0
    yearRepetitions += count
    if (count > 0) yearActiveDays++
    if (count > 0 && i < 28) monthActiveDays++
  }

  return {
    learned,
    learning,
    totalTracked: progresses.length,
    totalCards,
    repetitions: Math.max(repetitions, sessionRepetitions),
    lastActive,
    mostTrained,
    activity,
    daysPerWeek: monthActiveDays / 4,
    yearRepetitions,
    yearActiveDays,
    yearSeconds,
    retention: monthRepetitions > 0 ? (monthRepetitions - monthAgain) / monthRepetitions : null,
  }
}
