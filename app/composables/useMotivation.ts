import { dayKey } from '~/utils/day'
import type { OpenDeckPrefs, SessionValue, ShowTo } from '~/utils/records'
import {
  packStudyDays,
  studyDays,
  summarizeTier,
  type DayLoad,
  type StudyDays,
  type TierStyle,
  type TierSummary,
} from '~/utils/tiers'

const REPUBLISH_MS = 12 * 60 * 60 * 1000

function sameDays(a: number[] | undefined, b: number[] | undefined): boolean {
  if (!a || !b) return a === b
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export function motivationShownTo(prefs: OpenDeckPrefs | null | undefined): ShowTo {
  const motivation = prefs?.showMotivation ?? DEFAULT_PREFS.showMotivation
  const tier = prefs?.showTier ?? DEFAULT_PREFS.showTier
  return motivation === 'everyone' && tier !== 'everyone' ? 'me' : motivation
}

export function useMotivation() {
  const summary = useState<TierSummary | null>('opendeck-tier', () => null)
  const today = useState<DayLoad | null>('opendeck-day-load', () => null)
  const studied = useState<StudyDays | null>('opendeck-study-days', () => null)
  const { stats } = useStats()
  const { prefs, loaded, save } = useProfile()

  const breakReminders = computed(() => prefs.value?.breakReminders ?? DEFAULT_PREFS.breakReminders)
  const showStats = computed<ShowTo>(() => prefs.value?.showStats ?? DEFAULT_PREFS.showStats)
  const showTier = computed<ShowTo>(() => prefs.value?.showTier ?? DEFAULT_PREFS.showTier)
  const tierStyle = computed<TierStyle>(() => prefs.value?.tierStyle ?? DEFAULT_PREFS.tierStyle)
  const showMotivation = computed(() => motivationShownTo(prefs.value))
  const enabled = computed(() => showMotivation.value !== 'nobody')
  const ownTier = computed(() => (showTier.value !== 'nobody' ? (summary.value?.tier ?? null) : null))
  const publicTier = computed(() => (showTier.value === 'everyone' ? (summary.value?.tier ?? null) : null))

  function apply(activity: Record<string, number>, sessions: SessionValue[]) {
    studied.value = studyDays(activity, sessions)
    summary.value = summarizeTier(studied.value)
    const key = dayKey(new Date())
    const load: DayLoad = { repetitions: 0, newCards: 0, activeSeconds: 0 }
    for (const s of sessions) {
      if (dayKey(new Date(s.startedAt)) !== key) continue
      load.repetitions += s.repetitions
      load.newCards += s.newCards
      load.activeSeconds += s.activeSeconds
    }
    today.value = load
    void publish()
    void useChallenges().sync(studied.value)
  }

  async function refresh() {
    try {
      if (showStats.value === 'everyone') {
        const result = await computeStudyStats()
        stats.value = result.stats
        apply(result.stats.activity, result.sessions)
        return
      }
      const [map, sessions] = await Promise.all([useStudy().loadProgressMap(), loadSessions()])
      apply(
        buildActivity(
          [...map.values()].map((r) => r.value),
          sessions,
        ),
        sessions,
      )
    } catch (err) {
      console.error('[opendeck] failed to compute study tier', err)
    }
  }

  async function publish() {
    const current = prefs.value
    if (!loaded.value || !current || !useAirspace()) return
    const tierPublic = showTier.value === 'everyone'
    const daysPublic = showMotivation.value === 'everyone'
    const statsPublic = showStats.value === 'everyone'
    if ((tierPublic || daysPublic) && (!summary.value || !studied.value)) return
    if (statsPublic && !stats.value) return

    const tier = tierPublic ? summary.value!.tier : undefined
    const days = daysPublic ? packStudyDays(studied.value!) : undefined
    const publicStats = statsPublic ? toPublicStats(stats.value!) : undefined
    const at = current.studyTierAt ? new Date(current.studyTierAt).getTime() : 0
    const fresh = Date.now() - at < REPUBLISH_MS
    const unchanged =
      tier === current.studyTier &&
      (!tier || fresh) &&
      sameDays(days?.studyDays, current.studyDays) &&
      days?.studyDaysEnd === current.studyDaysEnd &&
      samePublicStats(publicStats, current.publicStats)
    if (unchanged) return

    try {
      await save({
        studyTier: tier,
        studyTierAt: tier ? new Date().toISOString() : undefined,
        studyDays: days?.studyDays,
        studyDaysEnd: days?.studyDaysEnd,
        publicStats,
      })
    } catch (err) {
      console.error('[opendeck] failed to publish study progress', err)
    }
  }

  return {
    summary,
    today,
    studied,
    enabled,
    breakReminders,
    showStats,
    showTier,
    tierStyle,
    showMotivation,
    ownTier,
    publicTier,
    apply,
    refresh,
    publish,
  }
}
