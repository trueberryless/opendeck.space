import { dayKey } from '~/utils/day'
import type { SessionValue } from '~/utils/records'
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

export function useMotivation() {
  const summary = useState<TierSummary | null>('opendeck-tier', () => null)
  const today = useState<DayLoad | null>('opendeck-day-load', () => null)
  const studied = useState<StudyDays | null>('opendeck-study-days', () => null)
  const { prefs, loaded, save } = useProfile()

  const enabled = computed(() => prefs.value?.motivationEnabled ?? DEFAULT_PREFS.motivationEnabled)
  const breakReminders = computed(() => prefs.value?.breakReminders ?? DEFAULT_PREFS.breakReminders)
  const showTier = computed(() => prefs.value?.showTierOnProfile ?? DEFAULT_PREFS.showTierOnProfile)
  const tierStyle = computed<TierStyle>(() => prefs.value?.tierStyle ?? DEFAULT_PREFS.tierStyle)
  const motivationPublic = computed(
    () => enabled.value && (prefs.value?.showMotivationOnProfile ?? DEFAULT_PREFS.showMotivationOnProfile),
  )
  const publicTier = computed(() => (showTier.value ? (summary.value?.tier ?? null) : null))

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
    const current = prefs.value
    if (!loaded.value || !current || !useAirspace()) return
    const sharesTier = showTier.value || motivationPublic.value
    if (sharesTier && (!summary.value || !studied.value)) return

    const tier = sharesTier ? summary.value!.tier : undefined
    const days = motivationPublic.value ? packStudyDays(studied.value!) : undefined
    const at = current.studyTierAt ? new Date(current.studyTierAt).getTime() : 0
    const fresh = Date.now() - at < REPUBLISH_MS
    const unchanged =
      tier === current.studyTier &&
      (!tier || fresh) &&
      sameDays(days?.studyDays, current.studyDays) &&
      days?.studyDaysEnd === current.studyDaysEnd
    if (unchanged) return

    try {
      await save({
        studyTier: tier,
        studyTierAt: tier ? new Date().toISOString() : undefined,
        studyDays: days?.studyDays,
        studyDaysEnd: days?.studyDaysEnd,
      })
    } catch (err) {
      console.error('[opendeck] failed to publish study tier', err)
    }
  }

  return {
    summary,
    today,
    studied,
    enabled,
    breakReminders,
    showTier,
    tierStyle,
    motivationPublic,
    publicTier,
    apply,
    refresh,
    publish,
  }
}
