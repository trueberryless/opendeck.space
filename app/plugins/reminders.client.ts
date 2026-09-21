export default defineNuxtPlugin(() => {
  const { prefs } = useProfile()
  const LAST_KEY = 'opendeck-last-reminder'

  function check() {
    const p = prefs.value
    if (!p?.reminderEnabled || !canNotify()) return

    const now = new Date()
    const days = p.reminderDays ?? [1, 2, 3, 4, 5]
    if (!days.includes(now.getDay())) return

    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    if (hhmm !== (p.reminderTime ?? '19:00')) return

    const today = now.toDateString()
    let last: string | null = null
    try {
      last = localStorage.getItem(LAST_KEY)
    } catch {
      last = null
    }
    if (last === today) return
    try {
      localStorage.setItem(LAST_KEY, today)
    } catch {}

    showNotification('Time to study 📚', { body: 'Your OpenDeck cards are waiting.' })
  }

  const { pause, resume } = useIntervalFn(check, 60_000, { immediate: false })

  watchEffect(() => {
    if (prefs.value?.reminderEnabled) resume()
    else pause()
  })
})
