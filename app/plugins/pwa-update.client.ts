const CHECK_EVERY_MS = 30 * 60 * 1000
const MIN_GAP_MS = 60 * 1000

export default defineNuxtPlugin(() => {
  if (!('serviceWorker' in navigator)) return
  let lastCheck = 0

  async function checkForUpdate() {
    if (!navigator.onLine || Date.now() - lastCheck < MIN_GAP_MS) return
    lastCheck = Date.now()
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      await registration?.update()
    } catch {
      return
    }
  }

  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate()
  })
  useEventListener(window, 'online', () => void checkForUpdate())
  useIntervalFn(() => void checkForUpdate(), CHECK_EVERY_MS)
})
