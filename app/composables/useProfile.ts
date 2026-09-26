import type { BskyProfile } from '~/utils/bsky'
import { normalizePrefs, type OpenDeckPrefs } from '~/utils/records'

export const DEFAULT_PREFS = {
  defaultVisibility: 'public' as const,
  showActivityOnProfile: false,
  showProgressOnProfile: false,
  showDecksOnProfile: false,
  showFollowsOnProfile: false,
  motivationEnabled: true,
  breakReminders: true,
  showTierOnProfile: false,
}

export function useMe() {
  return useState<BskyProfile | null>('opendeck-me', () => null)
}

export function useProfile() {
  const prefs = useState<OpenDeckPrefs | null>('opendeck-prefs', () => null)
  const loaded = useState<boolean>('opendeck-prefs-loaded', () => false)
  const fresh = useState<boolean>('opendeck-fresh-account', () => false)
  const { setAccent } = useAccent()

  async function load() {
    const airspace = useAirspace()
    if (!airspace) return
    try {
      const rec = await airspace.profile.get()
      fresh.value = !rec
      prefs.value = normalizePrefs(rec?.value)
      if (prefs.value.accentColor) setAccent(prefs.value.accentColor)
      if (prefs.value.uiLanguage) void applyLocaleGlobally(prefs.value.uiLanguage)
    } catch (err) {
      console.error('[opendeck] failed to load profile', err)
      prefs.value = {}
    } finally {
      loaded.value = true
    }
  }

  async function save(patch: Partial<OpenDeckPrefs>) {
    const airspace = requireAirspace()
    const next = normalizePrefs({ ...prefs.value, ...patch, updatedAt: new Date().toISOString() })
    prefs.value = next
    await airspace.profile.put(next)
    fresh.value = false
    if (patch.accentColor) setAccent(patch.accentColor)
  }

  return { prefs, loaded, fresh, load, save }
}
