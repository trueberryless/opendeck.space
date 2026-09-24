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
    if (!import.meta.client) return
    const variants = accessibleAccents(value)
    if (!variants) return
    const style = document.documentElement.style
    style.setProperty('--accent-light', variants.light)
    style.setProperty('--accent-dark', variants.dark)
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

  function restoreAccent() {
    let cached: string | null = null
    try {
      cached = localStorage.getItem(STORAGE_KEY)
    } catch {
      cached = null
    }
    setAccent(cached || accent.value, false)
  }

  return { accent, setAccent, restoreAccent }
}
