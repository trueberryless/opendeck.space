import { isTier, tierRank, type Tier } from '~/utils/tiers'

export const ROUND_MS = 15000
const REVEAL_MS = 4000
const QUESTION_COUNT = 10
const MAX_PLAYERS = 8
const OPTION_COUNT = 4
const HANDICAP_STEP = 0.1
const HANDICAP_MAX = 0.5

export interface BattleCard {
  front: string
  back: string
}

export interface PlayerProfile {
  did: string
  name: string
  avatar?: string
  tier: Tier | null
}

export interface PlayerView extends PlayerProfile {
  score: number
  multiplier: number
  answered: boolean
  choice: number | null
  gained: number | null
}

export type Phase = 'lobby' | 'question' | 'reveal' | 'finished'

export interface BattleView {
  phase: Phase
  deck: string
  round: number
  rounds: number
  handicap: boolean
  players: PlayerView[]
  question: { prompt: string; options: string[] } | null
  answer: number | null
  remainingMs: number
}

export type HostMessage = { type: 'view'; view: BattleView } | { type: 'full' } | { type: 'closed' }
export type GuestMessage =
  | { type: 'hello'; tier: Tier | null }
  | { type: 'answer'; round: number; choice: number; ms: number }

interface Question {
  prompt: string
  options: string[]
  answer: number
}

interface Seat {
  profile: PlayerProfile
  score: number
  choice: number | null
  ms: number
  gained: number | null
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

function usableCards(cards: readonly BattleCard[]): BattleCard[] {
  const seen = new Set<string>()
  return cards
    .map((c) => ({ front: c.front.trim(), back: c.back.trim() }))
    .filter((c) => c.front && c.back && !seen.has(c.front) && seen.add(c.front))
}

export function canBattle(cards: readonly BattleCard[]): boolean {
  return new Set(usableCards(cards).map((c) => c.back)).size >= OPTION_COUNT
}

function buildQuestions(cards: readonly BattleCard[], count = QUESTION_COUNT, random = Math.random): Question[] {
  if (!canBattle(cards)) return []
  const usable = usableCards(cards)
  const backs = [...new Set(usable.map((c) => c.back))]
  return shuffle(usable, random)
    .slice(0, count)
    .map((card) => {
      const distractors = shuffle(
        backs.filter((b) => b !== card.back),
        random,
      ).slice(0, OPTION_COUNT - 1)
      const options = shuffle([card.back, ...distractors], random)
      return { prompt: card.front, options, answer: options.indexOf(card.back) }
    })
}

function rankOf(tier: Tier | null): number {
  return isTier(tier) ? tierRank(tier) : 0
}

function handicapMultiplier(tier: Tier | null, tiers: readonly (Tier | null)[], handicap: boolean): number {
  if (!handicap) return 1
  const top = Math.max(0, ...tiers.map(rankOf))
  return Math.round(Math.min(1 + HANDICAP_MAX, 1 + HANDICAP_STEP * (top - rankOf(tier))) * 10) / 10
}

function roundPoints(correct: boolean, ms: number, multiplier: number): number {
  if (!correct) return 0
  const speed = 1 - Math.min(1, Math.max(0, ms / ROUND_MS))
  return Math.round((500 + 500 * speed) * multiplier)
}

export class BattleGame {
  private readonly seats = new Map<string, Seat>()
  private questions: Question[] = []
  private phase: Phase = 'lobby'
  private round = -1
  private handicap = true
  private startedAt = 0
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(
    private readonly deck: string,
    private readonly cards: readonly BattleCard[],
    private readonly onChange: () => void,
    private readonly now: () => number = Date.now,
  ) {}

  get players(): number {
    return this.seats.size
  }

  join(profile: PlayerProfile): boolean {
    const seat = this.seats.get(profile.did)
    if (!seat && this.seats.size >= MAX_PLAYERS) return false
    this.seats.set(profile.did, seat ? { ...seat, profile } : { profile, score: 0, choice: null, ms: 0, gained: null })
    this.onChange()
    return true
  }

  leave(did: string) {
    if (!this.seats.delete(did)) return
    if (this.phase === 'question' && this.allAnswered()) this.reveal()
    else this.onChange()
  }

  setHandicap(on: boolean) {
    if (this.phase === 'question' || this.phase === 'reveal') return
    this.handicap = on
    this.onChange()
  }

  start(): boolean {
    const questions = buildQuestions(this.cards)
    if (questions.length === 0) return false
    this.questions = questions
    for (const seat of this.seats.values()) Object.assign(seat, { score: 0, choice: null, ms: 0, gained: null })
    this.round = -1
    this.next()
    return true
  }

  answer(did: string, round: number, choice: number, ms: number) {
    const seat = this.seats.get(did)
    const question = this.questions[this.round]
    if (this.phase !== 'question' || round !== this.round || !seat || seat.choice !== null || !question) return
    if (!Number.isInteger(choice) || choice < 0 || choice >= question.options.length) return
    seat.choice = choice
    seat.ms = Math.min(ROUND_MS, Math.max(0, Number.isFinite(ms) ? ms : ROUND_MS))
    if (this.allAnswered()) this.reveal()
    else this.onChange()
  }

  view(): BattleView {
    const question = this.questions[this.round]
    const asking = this.phase === 'question' || this.phase === 'reveal'
    const revealed = this.phase !== 'question'
    const tiers = [...this.seats.values()].map((s) => s.profile.tier)
    const elapsed = this.now() - this.startedAt
    return {
      phase: this.phase,
      deck: this.deck,
      round: this.round,
      rounds: this.questions.length,
      handicap: this.handicap,
      players: [...this.seats.values()].map((s) => ({
        did: s.profile.did,
        name: s.profile.name,
        avatar: s.profile.avatar,
        tier: s.profile.tier,
        score: s.score,
        multiplier: handicapMultiplier(s.profile.tier, tiers, this.handicap),
        answered: s.choice !== null,
        choice: revealed ? s.choice : null,
        gained: revealed ? s.gained : null,
      })),
      question: asking && question ? { prompt: question.prompt, options: question.options } : null,
      answer: this.phase === 'reveal' && question ? question.answer : null,
      remainingMs: this.phase === 'question' ? Math.max(0, ROUND_MS - elapsed) : 0,
    }
  }

  dispose() {
    clearTimeout(this.timer)
  }

  private allAnswered(): boolean {
    return this.seats.size > 0 && [...this.seats.values()].every((s) => s.choice !== null)
  }

  private next() {
    clearTimeout(this.timer)
    this.round++
    if (this.round >= this.questions.length) {
      this.phase = 'finished'
      this.onChange()
      return
    }
    for (const seat of this.seats.values()) Object.assign(seat, { choice: null, ms: 0, gained: null })
    this.phase = 'question'
    this.startedAt = this.now()
    this.timer = setTimeout(() => this.reveal(), ROUND_MS)
    this.onChange()
  }

  private reveal() {
    clearTimeout(this.timer)
    const question = this.questions[this.round]
    if (!question) return
    const tiers = [...this.seats.values()].map((s) => s.profile.tier)
    for (const seat of this.seats.values()) {
      const multiplier = handicapMultiplier(seat.profile.tier, tiers, this.handicap)
      seat.gained = roundPoints(seat.choice === question.answer, seat.ms, multiplier)
      seat.score += seat.gained
    }
    this.phase = 'reveal'
    this.timer = setTimeout(() => this.next(), REVEAL_MS)
    this.onChange()
  }
}
