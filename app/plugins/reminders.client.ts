import { isReminderDue } from '~~/shared/reminders'

const LAST_KEY = 'opendeck-last-reminder'

export default defineNuxtPlugin((nuxtApp) => {
  const { prefs, loaded } = useProfile()
  const push = usePushReminders()
  const viaPush = ref(false)

  async function sync() {
    if (!loaded.value) return
    if (prefs.value?.reminderEnabled && canNotify()) {
      viaPush.value = await push.subscribe()
    } else {
      viaPush.value = false
      await push.unsubscribe()
    }
  }

  function checkInApp() {
    const p = prefs.value
    if (!p || !canNotify()) return
    const now = new Date()
    if (!isReminderDue(p, Intl.DateTimeFormat().resolvedOptions().timeZone, now)) return

    const slot = `${now.toDateString()} ${now.getHours()}`
    try {
      if (localStorage.getItem(LAST_KEY) === slot) return
      localStorage.setItem(LAST_KEY, slot)
    } catch {}

    const { t } = nuxtApp.$i18n
    void showNotification(t('reminder.title'), { body: t('reminder.body') })
  }

  const { pause, resume } = useIntervalFn(checkInApp, 60_000, { immediate: false })

  watch(
    () => [loaded.value, prefs.value?.reminderEnabled, nuxtApp.$i18n.locale.value],
    () => void sync(),
    { immediate: true },
  )

  watchEffect(() => {
    if (prefs.value?.reminderEnabled && !viaPush.value) resume()
    else pause()
  })
})
