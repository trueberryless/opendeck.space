const CHECK_EVERY_MS = 30 * 60 * 1000
const MIN_GAP_MS = 60 * 1000
const RELOAD_FALLBACK_MS = 8000
const OFFER_ID = 'pwa-update'
const PROGRESS_ID = 'pwa-updating'

export default defineNuxtPlugin((nuxtApp) => {
  if (!('serviceWorker' in navigator)) return
  const toast = useToast()
  const t = (key: string) => (nuxtApp.vueApp.config.globalProperties.$t as (key: string) => string)(key)
  let lastCheck = 0
  let updating = false
  let reloading = false

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

  function watchRegistration(registration: ServiceWorkerRegistration) {
    if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration)
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(registration)
      })
    })
  }

  function offerUpdate(registration: ServiceWorkerRegistration) {
    if (updating || toast.toasts.value.some((entry) => entry.id === OFFER_ID)) return
    toast.add({
      id: OFFER_ID,
      title: t('update.title'),
      description: t('update.body'),
      icon: 'i-lucide-refresh-cw',
      duration: 0,
      actions: [{ label: t('update.action'), onClick: () => applyUpdate(registration) }],
    })
  }

  function applyUpdate(registration: ServiceWorkerRegistration) {
    if (updating) return
    updating = true
    toast.add({
      id: PROGRESS_ID,
      title: t('update.updating'),
      icon: 'i-lucide-loader-circle',
      duration: 0,
      close: false,
      ui: { icon: 'animate-spin' },
    })
    const waiting = registration.waiting
    if (!waiting) {
      reload()
      return
    }
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true })
    waiting.postMessage({ type: 'SKIP_WAITING' }, [])
    setTimeout(reload, RELOAD_FALLBACK_MS)
  }

  function reload() {
    if (reloading) return
    reloading = true
    window.location.reload()
  }

  nuxtApp.hook('app:mounted', () => {
    void navigator.serviceWorker.ready.then(watchRegistration)
  })
  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate()
  })
  useEventListener(window, 'online', () => void checkForUpdate())
  useIntervalFn(() => void checkForUpdate(), CHECK_EVERY_MS)
})
