const STORAGE_KEY = 'opendeck-accent'
const DEFAULT_ACCENT = '#3b82f6'

export const ACCENT_PRESETS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Slate', value: '#64748b' },
] as const

export function useAccent() {
  const accent = useState<string>('opendeck-accent', () => DEFAULT_ACCENT)

  function apply(value: string) {
    if (import.meta.client) {
      document.documentElement.style.setProperty('--accent', value)
      document.documentElement.style.setProperty('--ui-primary', value)
      document.documentElement.style.setProperty('--accent-contrast', pickContrast(value))
    }
  }

  function setAccent(value: string, persist = true) {
    accent.value = value
    apply(value)
    if (persist && import.meta.client) {
      try {
        localStorage.setItem(STORAGE_KEY, value)
      } catch {}
    }
  }

  onMounted(() => {
    let cached: string | null = null
    try {
      cached = localStorage.getItem(STORAGE_KEY)
    } catch {
      cached = null
    }
    setAccent(cached || accent.value, false)
  })

  return { accent, setAccent }
}

function pickContrast(hex: string): string {
  const c = hex.replace('#', '')
  if (c.length < 6) return 'white'
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#000000' : '#ffffff'
}
