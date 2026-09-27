import type { BskyProfile } from '~/utils/bsky'
import { getMeta, setMeta } from '~/utils/db'
import { normalizePrefs, type OpenDeckPrefs } from '~/utils/records'

export const DEFAULT_PREFS = {
  defaultVisibility: 'public' as const,
  showActivityOnProfile: false,
  showProgressOnProfile: false,
  showDecksOnProfile: false,
  showFollowsOnProfile: false,
}

const PREFS_KEY = 'prefs'
export const ME_KEY = 'me'

export function useMe() {
  return useState<BskyProfile | null>('opendeck-me', () => null)
}

export function useProfile() {
  const prefs = useState<OpenDeckPrefs | null>('opendeck-prefs', () => null)
  const loaded = useState<boolean>('opendeck-prefs-loaded', () => false)
  const { setAccent } = useAccent()

  function apply(next: OpenDeckPrefs) {
    prefs.value = next
    if (next.accentColor) setAccent(next.accentColor)
    if (next.uiLanguage) applyLocaleGlobally(next.uiLanguage)
  }

  async function loadCached(): Promise<boolean> {
    const cached = await getMeta<OpenDeckPrefs>(PREFS_KEY)
    if (!cached) return false
    if (!prefs.value) apply(normalizePrefs(cached))
    loaded.value = true
    return true
  }

  async function load() {
    const airspace = onlineAirspace()
    if (!airspace) {
      await loadCached()
      return
    }
    try {
      const rec = await airspace.profile.get()
      apply(normalizePrefs(rec?.value))
      await setMeta(PREFS_KEY, prefs.value)
    } catch (err) {
      console.error('[opendeck] failed to load profile', err)
      if (!(await loadCached())) prefs.value = {}
    } finally {
      loaded.value = true
    }
  }

  async function save(patch: Partial<OpenDeckPrefs>) {
    const airspace = requireAirspace()
    const next: OpenDeckPrefs = { ...normalizePrefs(prefs.value), ...patch, updatedAt: new Date().toISOString() }
    prefs.value = next
    await airspace.profile.put(next)
    await setMeta(PREFS_KEY, next)
    if (patch.accentColor) setAccent(patch.accentColor)
  }

  return { prefs, loaded, load, loadCached, save }
}
