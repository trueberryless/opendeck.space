import { authReady } from '~/composables/useAirspace'

const REFRESH_EVERY_MS = 10 * 60 * 1000
const REFRESH_DELAY_MS = 3000

export default defineNuxtPlugin(() => {
  const connected = useConnected()
  const { online } = useSync()
  const { refreshLibrary, syncMedia } = useOfflineDecks()
  let lastRefresh = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  function maybeRefresh() {
    if (!connected.value || !online.value || Date.now() - lastRefresh < REFRESH_EVERY_MS) return
    lastRefresh = Date.now()
    clearTimeout(timer)
    timer = setTimeout(() => void refreshLibrary(), REFRESH_DELAY_MS)
  }

  void (async () => {
    await authReady
    if (!useAuthUser().value) return
    if (window.matchMedia('(display-mode: standalone)').matches) void persistStorage()
    void syncMedia()
    maybeRefresh()
    watch([connected, online], maybeRefresh)
    useEventListener(document, 'visibilitychange', () => {
      if (document.visibilityState === 'visible') maybeRefresh()
    })
  })()
})
