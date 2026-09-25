import { addDays, dayKey, startOfDay } from '~/utils/day'

export const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const
export type Tier = (typeof TIERS)[number]

export const TIER_WINDOW_WEEKS = 4

// Tiers count study days, never repetitions or minutes, so cramming does not rank higher than a
// steady habit. Diamond (about five days a week) is the top: studying every day earns nothing extra.
const RULES: Record<Tier, { days: number; weeks: number }> = {
  bronze: { days: 0, weeks: 0 },
  silver: { days: 2, weeks: 1 },
  gold: { days: 4, weeks: 3 },
  platinum: { days: 12, weeks: 3 },
  diamond: { days: 20, weeks: 4 },
}

export const TIER_ICONS: Record<Tier, string> = {
  bronze: 'i-lucide-shield',
  silver: 'i-lucide-star',
  gold: 'i-lucide-crown',
  platinum: 'i-lucide-sparkle',
  diamond: 'i-lucide-gem',
}

export function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && (TIERS as readonly string[]).includes(value)
}

export function tierRank(tier: Tier): number {
  return TIERS.indexOf(tier)
}

export interface TierSummary {
  tier: Tier
  activeDays: number
  weeksActive: number
  /** Study day flags for the window, oldest first. */
  days: boolean[]
  next: Tier | null
  daysToNext: number | null
  progress: number
  studiedToday: boolean
  /** Not studying today drops the tier tomorrow. */
  atRisk: boolean
}

function evaluate(activity: Record<string, number>, now: Date) {
  const today = startOfDay(now)
  const studiedToday = (activity[dayKey(today)] ?? 0) > 0
  // Today only counts once it has a study day in it, so the tier never drops before the day is over.
  const end = studiedToday ? today : addDays(today, -1)
  const length = TIER_WINDOW_WEEKS * 7
  const days: boolean[] = []
  for (let i = length - 1; i >= 0; i--) days.push((activity[dayKey(addDays(end, -i))] ?? 0) > 0)

  let activeDays = 0
  let weeksActive = 0
  for (let w = 0; w < TIER_WINDOW_WEEKS; w++) {
    const week = days.slice(w * 7, w * 7 + 7).filter(Boolean).length
    activeDays += week
    if (week > 0) weeksActive++
  }

  let tier: Tier = 'bronze'
  for (const t of TIERS) if (activeDays >= RULES[t].days && weeksActive >= RULES[t].weeks) tier = t
  return { tier, activeDays, weeksActive, days, studiedToday, today }
}

export function summarizeTier(activity: Record<string, number>, now = new Date()): TierSummary {
  const current = evaluate(activity, now)
  const rank = tierRank(current.tier)
  const next = TIERS[rank + 1] ?? null

  let daysToNext: number | null = null
  if (next) {
    // The fewest study days to the next tier, studying every day from today on.
    const simulated = { ...activity }
    let day = current.studiedToday ? addDays(current.today, 1) : current.today
    for (let n = 1; n <= TIER_WINDOW_WEEKS * 7; n++, day = addDays(day, 1)) {
      simulated[dayKey(day)] = 1
      if (tierRank(evaluate(simulated, day).tier) > rank) {
        daysToNext = n
        break
      }
    }
  }

  const from = RULES[current.tier].days
  const to = next ? RULES[next].days : from
  const progress = next ? Math.min(1, Math.max(0, (current.activeDays - from) / (to - from))) : 1
  const tomorrow = evaluate(activity, addDays(current.today, 1))

  return {
    tier: current.tier,
    activeDays: current.activeDays,
    weeksActive: current.weeksActive,
    days: current.days,
    next,
    daysToNext,
    progress,
    studiedToday: current.studiedToday,
    atRisk: !current.studiedToday && tierRank(tomorrow.tier) < rank,
  }
}

/**
 * A published tier is a snapshot from the last time its owner opened OpenDeck. Without newer
 * study days, the four-week window empties at roughly one tier per week, so viewers age it the same way.
 */
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

// Lucide icon bodies (ISC license), drawn into the repeating backdrop tile of a themed profile.
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
}

/** A square mask tile with two icons on a diamond grid: one in the top-left quarter, one in the bottom-right. */
export function tierTile(tier: Tier): string {
  const icon = (x: number, y: number) =>
    `<g transform="translate(${x} ${y}) scale(0.8)" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[tier]}</g>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">${icon(14.4, 14.4)}${icon(62.4, 62.4)}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
