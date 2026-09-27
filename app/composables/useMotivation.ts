import { dayKey } from '~/utils/day'
import type { SessionValue } from '~/utils/records'
import { studyDays, summarizeTier, type DayLoad, type StudyDays, type TierSummary } from '~/utils/tiers'

const REPUBLISH_MS = 12 * 60 * 60 * 1000

export function useMotivation() {
  const summary = useState<TierSummary | null>('opendeck-tier', () => null)
  const today = useState<DayLoad | null>('opendeck-day-load', () => null)
  const studied = useState<StudyDays | null>('opendeck-study-days', () => null)
  const { prefs, loaded, save } = useProfile()

  const enabled = computed(() => prefs.value?.motivationEnabled ?? DEFAULT_PREFS.motivationEnabled)
  const breakReminders = computed(() => prefs.value?.breakReminders ?? DEFAULT_PREFS.breakReminders)
  const showOnProfile = computed(
    () => enabled.value && (prefs.value?.showTierOnProfile ?? DEFAULT_PREFS.showTierOnProfile),
  )

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
    if (!loaded.value || !prefs.value || !useAirspace()) return
    const tier = showOnProfile.value ? summary.value?.tier : undefined
    if (showOnProfile.value && !tier) return
    const at = prefs.value.studyTierAt ? new Date(prefs.value.studyTierAt).getTime() : 0
    const fresh = Date.now() - at < REPUBLISH_MS
    if (tier === prefs.value.studyTier && (!tier || fresh)) return
    try {
      await save({ studyTier: tier, studyTierAt: tier ? new Date().toISOString() : undefined })
    } catch (err) {
      console.error('[opendeck] failed to publish study tier', err)
    }
  }

  return { summary, today, studied, enabled, breakReminders, showOnProfile, apply, refresh, publish }
}
