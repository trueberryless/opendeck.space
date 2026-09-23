import type { ShortTermChoice } from '~/utils/fsrs'

export type Visibility = 'public' | 'private'
export type ReadingMode = 'off' | 'answer' | 'prompt' | 'hint'
export type ProgressState = 'new' | 'learning' | 'review' | 'relearning'
export type RatingKey = 'again' | 'hard' | 'good' | 'easy'
export type StudyDirection = 'forward' | 'reverse'

export interface DeckValue {
  title: string
  summary?: string
  sourceLang?: string
  targetLang?: string
  readingMode?: ReadingMode
  shortTermIntervals?: ShortTermChoice
  tags?: string[]
  copiedFrom?: string
  createdAt: string
  updatedAt?: string
}

export interface CardValue {
  deck: string
  front: string
  back: string
  hint?: string
  examples?: string[]
  backReading?: string
  frontReading?: string
  image?: unknown
  imageAlt?: string
  audio?: unknown
  order?: number
  createdAt: string
  updatedAt?: string
}

export interface ProgressValue {
  card: string
  deck?: string
  dueAt: string
  stability: string
  difficulty: string
  repetitions: number
  lapses: number
  shortTermStep?: number
  direction?: StudyDirection
  state: ProgressState
  lastRating?: RatingKey
  lastReviewedAt: string
}

export interface SessionValue {
  deck?: string
  direction?: StudyDirection
  startedAt: string
  endedAt: string
  activeSeconds: number
  repetitions: number
  again: number
  hard: number
  good: number
  easy: number
  newCards: number
}

export interface OpenDeckPrefs {
  bio?: string
  accentColor?: string
  uiLanguage?: string
  defaultVisibility?: 'public' | 'private'
  shortTermIntervals?: ShortTermChoice
  showActivityOnProfile?: boolean
  showProgressOnProfile?: boolean
  showDecksOnProfile?: boolean
  showFollowsOnProfile?: boolean
  reminderEnabled?: boolean
  reminderHour?: number
  reminderDays?: number[]
  updatedAt?: string
}

type Raw = Record<string, unknown>

function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function normalizeDeck(raw: unknown): DeckValue {
  const r = raw as Raw
  return compact({
    title: str(r.title) ?? '',
    summary: str(r.summary),
    sourceLang: str(r.sourceLang),
    targetLang: str(r.targetLang),
    readingMode: r.readingMode as DeckValue['readingMode'],
    shortTermIntervals: (r.shortTermIntervals ?? r.stepsPreset) as DeckValue['shortTermIntervals'],
    tags: r.tags as string[] | undefined,
    copiedFrom: str(r.copiedFrom),
    createdAt: str(r.createdAt) ?? new Date(0).toISOString(),
    updatedAt: str(r.updatedAt),
  })
}

export function normalizeCard(raw: unknown): CardValue {
  const r = raw as Raw
  return compact({
    deck: str(r.deck) ?? '',
    front: str(r.front) ?? '',
    back: str(r.back) ?? '',
    hint: str(r.hint),
    examples: r.examples as string[] | undefined,
    frontReading: str(r.frontReading) ?? str(r.phoneticFront),
    backReading: str(r.backReading) ?? str(r.phonetic),
    image: r.image,
    imageAlt: str(r.imageAlt),
    audio: r.audio,
    order: typeof r.order === 'number' ? r.order : undefined,
    createdAt: str(r.createdAt) ?? new Date(0).toISOString(),
    updatedAt: str(r.updatedAt),
  })
}

export function normalizeProgress(raw: unknown): ProgressValue {
  const r = raw as Raw
  const state = r.state as ProgressValue['state']
  const lastRating = r.lastRating as ProgressValue['lastRating']
  const legacyStep = state === 'learning' && lastRating === 'good' ? 1 : 0
  const step = (r.shortTermStep ?? r.learningSteps) as number | undefined
  return compact({
    card: str(r.card) ?? '',
    deck: str(r.deck),
    dueAt: str(r.dueAt) ?? str(r.due) ?? new Date(0).toISOString(),
    stability: str(r.stability) ?? '0',
    difficulty: str(r.difficulty) ?? '0',
    repetitions: (r.repetitions ?? r.reviews ?? r.reps ?? 0) as number,
    lapses: (r.lapses ?? 0) as number,
    shortTermStep: state === 'learning' || state === 'relearning' ? (step ?? legacyStep) : undefined,
    direction: r.direction as ProgressValue['direction'],
    state,
    lastRating,
    lastReviewedAt: str(r.lastReviewedAt) ?? str(r.lastReview) ?? str(r.updatedAt) ?? str(r.dueAt) ?? str(r.due) ?? '',
  })
}

export function normalizeSession(raw: unknown): SessionValue {
  const r = raw as Raw
  const deck = str(r.deck)
  return compact({
    deck: deck?.startsWith('at://') ? deck.split('/').pop() : deck,
    direction: r.direction as SessionValue['direction'],
    startedAt: str(r.startedAt) ?? '',
    endedAt: str(r.endedAt) ?? '',
    activeSeconds: (r.activeSeconds ?? 0) as number,
    repetitions: (r.repetitions ?? r.reviews ?? 0) as number,
    again: (r.again ?? 0) as number,
    hard: (r.hard ?? 0) as number,
    good: (r.good ?? 0) as number,
    easy: (r.easy ?? 0) as number,
    newCards: (r.newCards ?? 0) as number,
  })
}

export function normalizePrefs(raw: unknown): OpenDeckPrefs {
  const { visibleDecks: _visibleDecks, stepsPreset, reminderTime, ...rest } = (raw ?? {}) as Raw & OpenDeckPrefs
  const legacyHour = typeof reminderTime === 'string' ? Number.parseInt(reminderTime, 10) : Number.NaN
  return compact({
    ...rest,
    shortTermIntervals: rest.shortTermIntervals ?? (stepsPreset as OpenDeckPrefs['shortTermIntervals']),
    reminderHour: rest.reminderHour ?? (Number.isInteger(legacyHour) ? legacyHour : undefined),
  })
}
