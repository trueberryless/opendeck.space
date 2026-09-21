import type { ProgressValue } from '~/utils/fsrs'

export interface StudyStats {
  learned: number
  learning: number
  totalTracked: number
  totalCards: number
  reviews: number
  lastActive: string | null
  mostTrained: { front: string; reps: number } | null
  last7: { label: string; count: number }[]
  streak: number
}

export function useStats() {
  const stats = ref<StudyStats | null>(null)
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      const decks = useDecks()
      const study = useStudy()

      const myDecks = await decks.listMyDecks()
      const frontByUri = new Map<string, string>()
      let totalCards = 0
      for (const d of myDecks) {
        const cards = await decks.listMyCards(d.rkey, d.visibility)
        totalCards += cards.length
        for (const c of cards) frontByUri.set(c.uri, c.value.front)
      }

      const map = await study.loadProgressMap()
      const progresses: ProgressValue[] = [...map.values()].map((r) => r.value)

      stats.value = compute(progresses, frontByUri, totalCards)
    } catch (err) {
      console.error('[opendeck] failed to compute stats', err)
      stats.value = null
    } finally {
      loading.value = false
    }
  }

  return { stats, loading, load }
}

function compute(progresses: ProgressValue[], frontByUri: Map<string, string>, totalCards: number): StudyStats {
  let learned = 0
  let learning = 0
  let reviews = 0
  let lastActive: string | null = null
  let mostTrained: { front: string; reps: number } | null = null

  const today = startOfDay(new Date())
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return { key: d.toDateString(), label: d.toLocaleDateString(undefined, { weekday: 'short' }), count: 0 }
  })
  const activeDays = new Set<string>()

  for (const p of progresses) {
    if (p.state === 'review') learned++
    else if (p.state === 'learning' || p.state === 'relearning') learning++
    reviews += p.reps || 0

    if (p.lastReview) {
      if (!lastActive || p.lastReview > lastActive) lastActive = p.lastReview
      const day = startOfDay(new Date(p.lastReview)).toDateString()
      activeDays.add(day)
      const bucket = days.find((d) => d.key === day)
      if (bucket) bucket.count++
    }

    if (p.reps > 0 && (!mostTrained || p.reps > mostTrained.reps)) {
      const front = frontByUri.get(p.card)
      if (front) mostTrained = { front, reps: p.reps }
    }
  }

  let streak = 0
  const cursor = new Date(today)
  if (!activeDays.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1)
  while (activeDays.has(cursor.toDateString())) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  return {
    learned,
    learning,
    totalTracked: progresses.length,
    totalCards,
    reviews,
    lastActive,
    mostTrained,
    last7: days.map((d) => ({ label: d.label, count: d.count })),
    streak,
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
