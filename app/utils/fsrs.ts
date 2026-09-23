import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type FSRS,
  type Grade,
  Rating,
  State,
  type Steps,
} from 'ts-fsrs'
import type { ProgressState, ProgressValue, RatingKey, StudyDirection } from '~/utils/records'

export type ShortTermPreset = 'quick' | 'balanced' | 'relaxed' | 'spaced'
export type ShortTermChoice = 'auto' | ShortTermPreset

export const SHORT_TERM_PRESETS: Record<ShortTermPreset, { learning: Steps; relearning: Steps }> = {
  quick: { learning: ['1m', '10m'], relearning: ['10m'] },
  balanced: { learning: ['10m', '1h'], relearning: ['10m'] },
  relaxed: { learning: ['30m', '4h'], relearning: ['30m'] },
  spaced: { learning: ['1h', '1d'], relearning: ['1h'] },
}
export const SHORT_TERM_PRESET_KEYS = Object.keys(SHORT_TERM_PRESETS) as ShortTermPreset[]
export const DEFAULT_SHORT_TERM_PRESET: ShortTermPreset = 'quick'

const SECONDS_PER_CARD = 10
const AUTO_THRESHOLDS: [maxMinutes: number, preset: ShortTermPreset][] = [
  [5, 'quick'],
  [30, 'balanced'],
  [Infinity, 'relaxed'],
]

export function autoShortTermPreset(sessionSize: number): ShortTermPreset {
  const minutes = (sessionSize * SECONDS_PER_CARD) / 60
  return AUTO_THRESHOLDS.find(([max]) => minutes < max)?.[1] ?? 'relaxed'
}

export function resolveShortTermPreset(choice: ShortTermChoice | undefined, sessionSize: number): ShortTermPreset {
  return !choice || choice === 'auto' ? autoShortTermPreset(sessionSize) : choice
}

export function formatShortTerm(preset: ShortTermPreset): string {
  return SHORT_TERM_PRESETS[preset].learning.join(' → ')
}

const schedulers = new Map<ShortTermPreset, FSRS>()
function schedulerFor(preset: ShortTermPreset): FSRS {
  let scheduler = schedulers.get(preset)
  if (!scheduler) {
    const { learning, relearning } = SHORT_TERM_PRESETS[preset]
    scheduler = fsrs(generatorParameters({ enable_fuzz: true, learning_steps: learning, relearning_steps: relearning }))
    schedulers.set(preset, scheduler)
  }
  return scheduler
}

export function progressDirection(p: ProgressValue | null | undefined): StudyDirection {
  return p?.direction ?? 'forward'
}

export function directionKey(cardUri: string, direction: StudyDirection): string {
  return direction === 'reverse' ? `${cardUri}#reverse` : cardUri
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
    due: new Date(p.dueAt),
    stability: Number.parseFloat(p.stability),
    difficulty: Number.parseFloat(p.difficulty),
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: p.shortTermStep ?? 0,
    reps: p.repetitions,
    lapses: p.lapses,
    state: STR_TO_STATE[p.state],
    last_review: new Date(p.lastReviewedAt),
  }
}

export function cardToProgress(
  cardUri: string,
  card: Card,
  rating: Grade,
  deckUri?: string,
  direction: StudyDirection = 'forward',
): ProgressValue {
  return {
    card: cardUri,
    deck: deckUri,
    dueAt: card.due.toISOString(),
    stability: String(card.stability),
    difficulty: String(card.difficulty),
    repetitions: card.reps,
    lapses: card.lapses,
    shortTermStep: card.state === State.Learning || card.state === State.Relearning ? card.learning_steps : undefined,
    direction: direction === 'reverse' ? 'reverse' : undefined,
    state: STATE_TO_STR[card.state],
    lastRating: RATING_TO_STR[rating],
    lastReviewedAt: (card.last_review ?? new Date()).toISOString(),
  }
}

export function gradeCard(
  cardUri: string,
  existing: ProgressValue | null,
  grade: Grade,
  deckUri?: string,
  direction: StudyDirection = progressDirection(existing),
  preset: ShortTermPreset = DEFAULT_SHORT_TERM_PRESET,
  now: Date = new Date(),
): ProgressValue {
  const card = existing ? progressToCard(existing) : createEmptyCard(now)
  const { card: next } = schedulerFor(preset).next(card, now, grade)
  return cardToProgress(cardUri, next, grade, deckUri ?? existing?.deck, direction)
}

export function isDue(progress: ProgressValue | null, now: Date = new Date()): boolean {
  if (!progress) return true
  return new Date(progress.dueAt).getTime() <= now.getTime()
}

export function intervalPreview(
  existing: ProgressValue | null,
  preset: ShortTermPreset = DEFAULT_SHORT_TERM_PRESET,
  now: Date = new Date(),
): Record<RatingKey, string> {
  const card = existing ? progressToCard(existing) : createEmptyCard(now)
  const out = {} as Record<RatingKey, string>
  const scheduler = schedulerFor(preset)
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
