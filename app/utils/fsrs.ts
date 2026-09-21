import { createEmptyCard, fsrs, generatorParameters, type Card, type Grade, Rating, State } from 'ts-fsrs'

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }))

export type ProgressState = 'new' | 'learning' | 'review' | 'relearning'
export type RatingKey = 'again' | 'hard' | 'good' | 'easy'

export interface ProgressValue {
  card: string
  deck?: string
  due: string
  stability: string
  difficulty: string
  reps: number
  lapses: number
  scheduledDays?: number
  state: ProgressState
  lastRating?: RatingKey
  lastReview?: string
  updatedAt: string
}

const STATE_TO_STR: Record<State, ProgressState> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
}
const STR_TO_STATE: Record<ProgressState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
}
const RATING_TO_STR: Record<Grade, RatingKey> = {
  [Rating.Again]: 'again',
  [Rating.Hard]: 'hard',
  [Rating.Good]: 'good',
  [Rating.Easy]: 'easy',
}

export const RATINGS = [
  { grade: Rating.Again, key: 'again', label: 'Again', color: 'error', icon: 'i-lucide-rotate-ccw' },
  { grade: Rating.Hard, key: 'hard', label: 'Hard', color: 'warning', icon: 'i-lucide-chevrons-down' },
  { grade: Rating.Good, key: 'good', label: 'Good', color: 'primary', icon: 'i-lucide-check' },
  { grade: Rating.Easy, key: 'easy', label: 'Easy', color: 'success', icon: 'i-lucide-chevrons-up' },
] as const

export function progressToCard(p: ProgressValue): Card {
  return {
    due: new Date(p.due),
    stability: Number.parseFloat(p.stability),
    difficulty: Number.parseFloat(p.difficulty),
    elapsed_days: 0,
    scheduled_days: p.scheduledDays ?? 0,
    learning_steps: 0,
    reps: p.reps,
    lapses: p.lapses,
    state: STR_TO_STATE[p.state],
    last_review: p.lastReview ? new Date(p.lastReview) : undefined,
  }
}

export function cardToProgress(cardUri: string, card: Card, rating: Grade, deckUri?: string): ProgressValue {
  return {
    card: cardUri,
    deck: deckUri,
    due: card.due.toISOString(),
    stability: String(card.stability),
    difficulty: String(card.difficulty),
    reps: card.reps,
    lapses: card.lapses,
    scheduledDays: card.scheduled_days,
    state: STATE_TO_STR[card.state],
    lastRating: RATING_TO_STR[rating],
    lastReview: card.last_review?.toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function gradeCard(
  cardUri: string,
  existing: ProgressValue | null,
  grade: Grade,
  deckUri?: string,
  now: Date = new Date(),
): ProgressValue {
  const card = existing ? progressToCard(existing) : createEmptyCard(now)
  const { card: next } = scheduler.next(card, now, grade)
  return cardToProgress(cardUri, next, grade, deckUri ?? existing?.deck)
}

export function isDue(progress: ProgressValue | null, now: Date = new Date()): boolean {
  if (!progress) return true
  return new Date(progress.due).getTime() <= now.getTime()
}

export function intervalPreview(existing: ProgressValue | null, now: Date = new Date()): Record<RatingKey, string> {
  const card = existing ? progressToCard(existing) : createEmptyCard(now)
  const out = {} as Record<RatingKey, string>
  for (const { grade, key } of RATINGS) {
    const { card: next } = scheduler.next(card, now, grade)
    out[key] = formatInterval(next.due, now)
  }
  return out
}

function formatInterval(due: Date, now: Date): string {
  const mins = Math.round((due.getTime() - now.getTime()) / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo`
  return `${Math.round(months / 12)}y`
}
