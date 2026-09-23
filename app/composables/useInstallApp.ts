const DISMISS_KEY = 'opendeck-install-dismissed'
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000

function detectIos(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

function detectStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function readDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_MS
  } catch {
    return false
  }
}

export function useInstallApp() {
  const { $pwa } = useNuxtApp()
  const ready = useState('opendeck-install-ready', () => false)
  const ios = useState('opendeck-install-ios', () => false)
  const standalone = useState('opendeck-install-standalone', () => false)
  const dismissed = useState('opendeck-install-dismissed', () => true)

  if (import.meta.client && !ready.value) {
    ios.value = detectIos()
    standalone.value = detectStandalone()
    dismissed.value = readDismissed()
    ready.value = true
  }

  const installed = computed(() => standalone.value || $pwa?.isPWAInstalled === true)
  const canPrompt = computed(() => !installed.value && $pwa?.showInstallPrompt === true)
  const needsIosSteps = computed(() => !installed.value && ios.value)
  const available = computed(() => ready.value && (canPrompt.value || needsIosSteps.value))
  const showBanner = computed(() => available.value && !dismissed.value)

  async function install(): Promise<boolean> {
    const choice = await $pwa?.install()
    return choice?.outcome === 'accepted'
  }

  function dismiss() {
    dismissed.value = true
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {}
  }

  return { installed, canPrompt, needsIosSteps, available, showBanner, install, dismiss }
}
