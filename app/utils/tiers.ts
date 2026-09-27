import { addDays, dayKey, startOfDay } from '~/utils/day'

export const TIERS = [
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
  'champion',
  'grandChampion',
  'supernova',
] as const
export type Tier = (typeof TIERS)[number]

const WINDOW_WEEKS = 4
const HISTORY_DAYS = 56
const HOLD_DAYS = 4
const REGAIN_DAYS = 14
const LOOKAHEAD_DAYS = 42
const SESSION_GAP_MS = 2 * 60 * 60 * 1000
const MAX_SESSIONS = 3
const SECRET_TIERS: ReadonlySet<Tier> = new Set(['supernova'])

const THRESHOLDS: Record<Tier, { enter: number; keep: number }> = {
  bronze: { enter: 0, keep: 0 },
  silver: { enter: 1.7, keep: 1 },
  gold: { enter: 3.8, keep: 3.2 },
  platinum: { enter: 5.5, keep: 4.9 },
  diamond: { enter: 7.4, keep: 6.6 },
  champion: { enter: 8.8, keep: 8.3 },
  grandChampion: { enter: 10.3, keep: 9.6 },
  supernova: { enter: 12.2, keep: 11.7 },
}

export const TIER_ICONS: Record<Tier, string> = {
  bronze: 'i-lucide-shield',
  silver: 'i-lucide-star',
  gold: 'i-lucide-crown',
  platinum: 'i-lucide-sparkle',
  diamond: 'i-lucide-gem',
  champion: 'i-lucide-trophy',
  grandChampion: 'i-lucide-award',
  supernova: 'i-lucide-sun',
}

export function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && (TIERS as readonly string[]).includes(value)
}

export function tierRank(tier: Tier): number {
  return TIERS.indexOf(tier)
}

export type StudyDays = Record<string, number>

export function studyDays(
  activity: Record<string, number>,
  sessions: { startedAt: string; endedAt: string; repetitions: number }[],
): StudyDays {
  const byDay = new Map<string, { start: number; end: number }[]>()
  for (const s of sessions) {
    if (s.repetitions <= 0) continue
    const start = new Date(s.startedAt).getTime()
    if (!Number.isFinite(start)) continue
    const end = new Date(s.endedAt).getTime()
    const key = dayKey(new Date(start))
    const list = byDay.get(key) ?? []
    list.push({ start, end: Number.isFinite(end) ? Math.max(start, end) : start })
    byDay.set(key, list)
  }

  const days: StudyDays = {}
  for (const [key, list] of byDay) {
    list.sort((a, b) => a.start - b.start)
    let count = 0
    let lastEnd = Number.NEGATIVE_INFINITY
    for (const s of list) {
      if (s.start - lastEnd >= SESSION_GAP_MS) count++
      lastEnd = Math.max(lastEnd, s.end)
    }
    days[key] = count
  }
  for (const [key, count] of Object.entries(activity)) if (count > 0 && !days[key]) days[key] = 1
  return days
}

function dayValue(sessions: number): number {
  return sessions > 0 ? 1 + (Math.min(sessions, MAX_SESSIONS) - 1) / 4 : 0
}

function score(days: StudyDays, end: Date): number {
  let total = 0
  for (let w = 0; w < WINDOW_WEEKS; w++) {
    let week = 0
    for (let d = 0; d < 7; d++) week += dayValue(days[dayKey(addDays(end, -(w * 7 + d)))] ?? 0)
    total += Math.sqrt(week)
  }
  return total
}

interface TierState {
  tier: Tier
  day: number
  changedOn: number
  lost: Tier | null
  lostOn: number
  score: number
}

function entryScore(tier: Tier, state: TierState): number {
  const { enter, keep } = THRESHOLDS[tier]
  const recentlyLost =
    state.lost !== null && tierRank(tier) <= tierRank(state.lost) && state.day - state.lostOn <= REGAIN_DAYS
  return recentlyLost ? (enter + keep) / 2 : enter
}

function step(state: TierState, days: StudyDays, date: Date): TierState {
  const next: TierState = { ...state, day: state.day + 1, score: score(days, date) }
  const rank = tierRank(state.tier)

  for (let r = TIERS.length - 1; r > rank; r--) {
    if (next.score >= entryScore(TIERS[r]!, next)) return { ...next, tier: TIERS[r]!, changedOn: next.day }
  }

  if (next.day - state.changedOn < HOLD_DAYS) return next
  let down = rank
  while (down > 0 && next.score < THRESHOLDS[TIERS[down]!].keep) down--
  if (down === rank) return next
  return { ...next, tier: TIERS[down]!, changedOn: next.day, lost: state.tier, lostOn: next.day }
}

function replay(days: StudyDays, end: Date): TierState {
  let state: TierState = {
    tier: 'bronze',
    day: 0,
    changedOn: Number.NEGATIVE_INFINITY,
    lost: null,
    lostOn: Number.NEGATIVE_INFINITY,
    score: 0,
  }
  for (let i = HISTORY_DAYS; i >= 0; i--) state = step(state, days, addDays(end, -i))
  return state
}

export interface TierSummary {
  tier: Tier
  activeDays: number
  days: boolean[]
  next: Tier | null
  daysToNext: number | null
  progress: number
  studiedToday: boolean
  atRisk: boolean
}

export function summarizeTier(days: StudyDays, now = new Date()): TierSummary {
  const today = startOfDay(now)
  const studiedToday = (days[dayKey(today)] ?? 0) > 0
  const end = studiedToday ? today : addDays(today, -1)
  const state = replay(days, end)
  const rank = tierRank(state.tier)
  const following = TIERS[rank + 1]
  const next = following && !SECRET_TIERS.has(following) ? following : null

  let daysToNext: number | null = null
  if (next) {
    const simulated = { ...days }
    let future = state
    let date = end
    for (let n = 1; n <= LOOKAHEAD_DAYS; n++) {
      date = addDays(date, 1)
      simulated[dayKey(date)] = 1
      future = step(future, simulated, date)
      if (tierRank(future.tier) > rank) {
        daysToNext = n
        break
      }
    }
  }

  const window: boolean[] = []
  for (let i = WINDOW_WEEKS * 7 - 1; i >= 0; i--) window.push((days[dayKey(addDays(end, -i))] ?? 0) > 0)

  const base = THRESHOLDS[state.tier].enter
  const progress = next ? Math.min(1, Math.max(0, (state.score - base) / (THRESHOLDS[next].enter - base))) : 1
  const tomorrow = studiedToday ? state : step(state, days, today)

  return {
    tier: state.tier,
    activeDays: window.filter(Boolean).length,
    days: window,
    next,
    daysToNext,
    progress,
    studiedToday,
    atRisk: tierRank(tomorrow.tier) < rank,
  }
}

export function publishedTier(tier: unknown, at: unknown, now = Date.now()): Tier | null {
  if (!isTier(tier)) return null
  const since = typeof at === 'string' ? now - new Date(at).getTime() : Number.NaN
  if (!Number.isFinite(since)) return tier
  const weeks = Math.max(0, Math.floor(since / (7 * 86400000)))
  return TIERS[Math.max(0, tierRank(tier) - weeks)]!
}

export interface DayLoad {
  repetitions: number
  newCards: number
  activeSeconds: number
}

const PLENTY_SECONDS = 45 * 60
const PLENTY_REPETITIONS = 400
const MANY_NEW_CARDS = 40

export type BalanceHint = 'plenty' | 'manyNew' | null

export function balanceHint(load: DayLoad | null): BalanceHint {
  if (!load) return null
  if (load.activeSeconds >= PLENTY_SECONDS || load.repetitions >= PLENTY_REPETITIONS) return 'plenty'
  if (load.newCards >= MANY_NEW_CARDS) return 'manyNew'
  return null
}

const ICON_PATHS: Record<Tier, string> = {
  bronze:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  silver:
    '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.12 2.12 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16z"/>',
  gold: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294zM5 21h14"/>',
  platinum:
    '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/>',
  diamond:
    '<path d="M10.5 3L8 9l4 13l4-13l-2.5-6"/><path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3zM2 9h20"/>',
  champion:
    '<path d="M10 14.66V17a1 1 0 0 1-1 1a2 2 0 0 0-2 2v2m7-7.34V17a1 1 0 0 0 1 1a2 2 0 0 1 2 2v2m.916-12H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/>',
  grandChampion:
    '<path d="m15.477 12.89l1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>',
  supernova:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
}

function tileIcon(tier: Tier, x: number, y: number): string {
  return `<g transform="translate(${x} ${y}) scale(0.8)" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[tier]}</g>`
}

function tileGlyph(glyph: string, x: number, y: number, turn: number): string {
  const text = glyph.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
  return `<text x="${x}" y="${y}" transform="rotate(${turn} ${x} ${y})" font-family="system-ui,sans-serif" font-size="17" font-weight="700" text-anchor="middle" dominant-baseline="central">${text}</text>`
}

function svgUrl(size: number, content: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${content}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export function tierTile(tier: Tier): string {
  return svgUrl(96, tileIcon(tier, 14.4, 14.4) + tileIcon(tier, 62.4, 62.4))
}

export function latticeTile(tier: Tier | null, glyphs: readonly string[]): string {
  const points = Array.from({ length: 8 }, (_, i) => {
    const row = Math.floor(i / 2)
    const column = (i % 2) * 2 + (row % 2)
    return { x: column * 48 + 24, y: row * 48 + 24, icon: Boolean(tier) && ((column - row) / 2) % 2 === 0 }
  })
  const icons = points.filter((p) => p.icon).map(({ x, y }) => tileIcon(tier!, x - 9.6, y - 9.6))
  const marks = points
    .filter((p) => !p.icon)
    .map(({ x, y }, i) => tileGlyph(glyphs[i % glyphs.length]!, x, y, i % 2 ? 12 : -12))
  return svgUrl(192, [...icons, ...marks].join(''))
}
