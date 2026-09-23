import type { SessionValue } from '~/utils/db'
import { addDays, dayKey, startOfDay } from '~/utils/day'
import type { ProgressValue } from '~/utils/fsrs'

export interface StudyStats {
  learned: number
  learning: number
  totalTracked: number
  totalCards: number
  reviews: number
  lastActive: string | null
  mostTrained: { front: string; reps: number } | null
  activity: Record<string, number>
  streak: number
  longestStreak: number
  yearReviews: number
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
    } catch (err) {
      console.error('[opendeck] failed to compute stats', err)
      stats.value = null
    } finally {
      loading.value = false
    }
  }

  return { stats, loading, load }
}

async function loadSessions(): Promise<SessionValue[]> {
  const sync = useSync()
  const byRkey = new Map<string, SessionValue>()

  if (sync.online.value) {
    const airspace = requireAirspace()
    try {
      for (const r of await airspace.session.list()) byRkey.set(r.rkey, r.value as SessionValue)
    } catch (err) {
      console.error('[opendeck] failed to load study sessions', err)
    }
    if (await useSpacesSupport().ensure()) {
      try {
        for (const r of await airspace.vault.session.list()) byRkey.set(r.rkey, r.value as SessionValue)
      } catch (err) {
        console.error('[opendeck] failed to load private study sessions', err)
      }
    }
  }

  for (const q of await sync.getQueuedSessions()) byRkey.set(q.rkey, q.value)
  return [...byRkey.values()]
}

function compute(
  progresses: ProgressValue[],
  sessions: SessionValue[],
  frontByUri: Map<string, string>,
  totalCards: number,
): StudyStats {
  let learned = 0
  let learning = 0
  let reviews = 0
  let lastActive: string | null = null
  let mostTrained: { front: string; reps: number } | null = null

  const fromSessions: Record<string, number> = {}
  const fromLastReview: Record<string, number> = {}

  for (const p of progresses) {
    if (p.state === 'review') learned++
    else if (p.state === 'learning' || p.state === 'relearning') learning++
    reviews += p.reps || 0

    if (p.lastReview) {
      if (!lastActive || p.lastReview > lastActive) lastActive = p.lastReview
      const key = dayKey(new Date(p.lastReview))
      fromLastReview[key] = (fromLastReview[key] ?? 0) + 1
    }

    if (p.reps > 0 && (!mostTrained || p.reps > mostTrained.reps)) {
      const front = frontByUri.get(p.card)
      if (front) mostTrained = { front, reps: p.reps }
    }
  }

  const today = startOfDay(new Date())
  const yearStart = addDays(today, -364).getTime()
  const monthStart = addDays(today, -29).getTime()
  let yearSeconds = 0
  let sessionReviews = 0
  let monthReviews = 0
  let monthAgain = 0

  for (const s of sessions) {
    if (!lastActive || s.endedAt > lastActive) lastActive = s.endedAt
    const started = new Date(s.startedAt)
    const key = dayKey(started)
    fromSessions[key] = (fromSessions[key] ?? 0) + s.reviews
    sessionReviews += s.reviews
    if (started.getTime() >= yearStart) yearSeconds += s.activeSeconds
    if (started.getTime() >= monthStart) {
      monthReviews += s.reviews
      monthAgain += s.again
    }
  }

  const activity: Record<string, number> = { ...fromLastReview }
  for (const [key, count] of Object.entries(fromSessions)) activity[key] = Math.max(count, activity[key] ?? 0)

  let yearReviews = 0
  let yearActiveDays = 0
  for (let i = 0; i < 365; i++) {
    const count = activity[dayKey(addDays(today, -i))] ?? 0
    yearReviews += count
    if (count > 0) yearActiveDays++
  }

  return {
    learned,
    learning,
    totalTracked: progresses.length,
    totalCards,
    reviews: Math.max(reviews, sessionReviews),
    lastActive,
    mostTrained,
    activity,
    streak: currentStreak(activity, today),
    longestStreak: longestStreak(activity),
    yearReviews,
    yearActiveDays,
    yearSeconds,
    retention: monthReviews > 0 ? (monthReviews - monthAgain) / monthReviews : null,
  }
}

function currentStreak(activity: Record<string, number>, today: Date): number {
  let cursor = activity[dayKey(today)] ? today : addDays(today, -1)
  let streak = 0
  while (activity[dayKey(cursor)]) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

function longestStreak(activity: Record<string, number>): number {
  const keys = Object.keys(activity)
    .filter((k) => activity[k]! > 0)
    .sort()
  let best = 0
  let run = 0
  let prev: Date | null = null
  for (const key of keys) {
    const [y, m, d] = key.split('-').map(Number)
    const date = new Date(y!, m! - 1, d!)
    run = prev && dayKey(addDays(prev, 1)) === key ? run + 1 : 1
    best = Math.max(best, run)
    prev = date
  }
  return best
}
