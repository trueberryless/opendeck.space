import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFS, ME_KEY } from '~/composables/useProfile'
import { getMeta, setMeta } from '~/utils/db'
import { signIn } from '../support/session'

describe('useProfile', () => {
  it('starts empty', () => {
    const { prefs, loaded, fresh } = useProfile()
    expect([prefs.value, loaded.value, fresh.value]).toEqual([null, false, false])
  })

  it('loads the stored profile, applies its accent and caches it', async () => {
    const airspace = signIn()
    airspace.profile.set({ bio: 'hi', accentColor: '#ff0000', reminderTime: '07:30' })
    const profile = useProfile()
    await profile.load()
    expect(profile.prefs.value).toMatchObject({ bio: 'hi', reminderHour: 7 })
    expect(profile.loaded.value).toBe(true)
    expect(profile.fresh.value).toBe(false)
    expect(useAccent().accent.value).toBe('#ff0000')
    expect((await getMeta<{ bio: string }>('prefs'))?.bio).toBe('hi')
  })

  it('flags a fresh account when no profile exists', async () => {
    signIn()
    const profile = useProfile()
    await profile.load()
    expect(profile.fresh.value).toBe(true)
    expect(profile.prefs.value).toEqual({})
  })

  it('falls back to the cached profile when loading fails or when offline', async () => {
    const airspace = signIn()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await setMeta('prefs', { bio: 'cached' })
    airspace.profile.get.mockRejectedValue(new Error('down'))
    const profile = useProfile()
    await profile.load()
    expect(profile.prefs.value?.bio).toBe('cached')
  })

  it('uses empty prefs when loading fails and nothing is cached', async () => {
    const airspace = signIn()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    airspace.profile.get.mockRejectedValue(new Error('down'))
    const profile = useProfile()
    await profile.load()
    expect(profile.prefs.value).toEqual({})
    expect(profile.loaded.value).toBe(true)
  })

  it('reads only the cache without a connection', async () => {
    await setMeta('prefs', { bio: 'offline' })
    const profile = useProfile()
    await profile.load()
    expect(profile.prefs.value?.bio).toBe('offline')
    const empty = await useProfile().loadCached()
    expect(empty).toBe(true)
  })

  it('reports no cache when nothing is stored', async () => {
    expect(await useProfile().loadCached()).toBe(false)
  })

  it('saves a patch with an update time', async () => {
    const airspace = signIn()
    const profile = useProfile()
    await profile.save({ bio: 'new', accentColor: '#00ff00' })
    expect(airspace.profile.put).toHaveBeenCalledWith(
      expect.objectContaining({ bio: 'new', updatedAt: expect.any(String) }),
    )
    expect(profile.prefs.value?.bio).toBe('new')
    expect(profile.fresh.value).toBe(false)
    expect(useAccent().accent.value).toBe('#00ff00')
  })

  it('exposes defaults and the me cache key', () => {
    expect(DEFAULT_PREFS.showCredits).toBe('everyone')
    expect(ME_KEY).toBe('me')
    expect(useMe().value).toBeNull()
  })
})

describe('useAccent', () => {
  it('sets css variables and persists the choice', () => {
    const { setAccent, accent } = useAccent()
    setAccent('#3b82f6')
    expect(accent.value).toBe('#3b82f6')
    expect(document.documentElement.style.getPropertyValue('--accent-light')).toMatch(/^#/)
    expect(localStorage.getItem('opendeck-accent')).toBe('#3b82f6')
  })

  it('ignores invalid colors for css and restores the stored one', () => {
    const { setAccent, restoreAccent, accent } = useAccent()
    localStorage.setItem('opendeck-accent', '#8b5cf6')
    restoreAccent()
    expect(accent.value).toBe('#8b5cf6')
    setAccent('nonsense', false)
    expect(document.documentElement.style.getPropertyValue('--accent-light')).not.toBe('')
    expect(localStorage.getItem('opendeck-accent')).toBe('#8b5cf6')
  })
})
