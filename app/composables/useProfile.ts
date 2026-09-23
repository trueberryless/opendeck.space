import type { BskyProfile } from '~/utils/bsky'

export interface OpenDeckPrefs {
  bio?: string
  accentColor?: string
  uiLanguage?: string
  defaultVisibility?: 'public' | 'private'
  showActivityOnProfile?: boolean
  showProgressOnProfile?: boolean
  showDecksOnProfile?: boolean
  visibleDecks?: string[]
  reminderEnabled?: boolean
  reminderTime?: string
  reminderDays?: number[]
  updatedAt?: string
}

export const DEFAULT_PREFS = {
  defaultVisibility: 'public' as const,
  showActivityOnProfile: false,
  showProgressOnProfile: false,
  showDecksOnProfile: false,
}

export function useMe() {
  return useState<BskyProfile | null>('opendeck-me', () => null)
}

export function useProfile() {
  const prefs = useState<OpenDeckPrefs | null>('opendeck-prefs', () => null)
  const loaded = useState<boolean>('opendeck-prefs-loaded', () => false)
  const { setAccent } = useAccent()

  async function load() {
    const airspace = useAirspace()
    if (!airspace) return
    try {
      const rec = await airspace.profile.get()
      prefs.value = (rec?.value as OpenDeckPrefs) ?? {}
      if (prefs.value.accentColor) setAccent(prefs.value.accentColor)
      if (prefs.value.uiLanguage) applyLocaleGlobally(prefs.value.uiLanguage)
    } catch (err) {
      console.error('[opendeck] failed to load profile', err)
      prefs.value = {}
    } finally {
      loaded.value = true
    }
  }

  async function save(patch: Partial<OpenDeckPrefs>) {
    const airspace = requireAirspace()
    const next: OpenDeckPrefs = { ...prefs.value, ...patch, updatedAt: new Date().toISOString() }
    prefs.value = next
    await airspace.profile.put(next)
    if (patch.accentColor) setAccent(patch.accentColor)
  }

  return { prefs, loaded, load, save }
}
