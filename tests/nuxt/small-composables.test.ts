import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { isScopeError } from '~/composables/useReauth'
import { canNotify, requestNotificationPermission, showNotification } from '~/utils/notifications'
import { inSetup } from '../support/nuxt'
import { oauth } from '../support/oauth'
import { stubNavigator } from '../support/navigator'
import { signIn } from '../support/session'
import '../support/reset'

const toast = vi.hoisted(() => ({ add: vi.fn() }))
mockNuxtImport('useToast', () => () => toast)

describe('useSpacesSupport', () => {
  it('caches the answer of the pds', async () => {
    const airspace = signIn()
    const { ensure, supported } = useSpacesSupport()
    expect(await ensure()).toBe(true)
    expect(await ensure()).toBe(true)
    expect(supported.value).toBe(true)
    expect(airspace.vault.supported).toHaveBeenCalledTimes(1)
  })

  it('is unsupported without a session or when the check fails', async () => {
    expect(await useSpacesSupport().ensure()).toBe(false)
    const airspace = signIn()
    airspace.vault.supported.mockRejectedValue(new Error('x'))
    expect(await useSpacesSupport().ensure()).toBe(false)
  })
})

describe('useLocale', () => {
  it('lists locales and switches the interface language', async () => {
    const { current, dir, setLocale, applyLocale, locales } = await inSetup(() => useLocale())
    expect(locales).toHaveLength(40)
    expect(current.value).toBe('en')
    await applyLocale('ar')
    expect(current.value).toBe('ar')
    expect(dir.value).toBe('rtl')
    setLocale('xx')
    await applyLocale('xx')
    await applyLocale('en')
    expect(current.value).toBe('en')
  })

  it('saves the language to the profile when signed in', async () => {
    const airspace = signIn()
    useHydrated().value = true
    const { setLocale, applyLocale } = await inSetup(() => useLocale())
    setLocale('de')
    await vi.waitFor(() =>
      expect(airspace.profile.put).toHaveBeenCalledWith(expect.objectContaining({ uiLanguage: 'de' })),
    )
    await applyLocale('en')
  })
})

describe('useShareLink', () => {
  it('copies a link and confirms with a toast', async () => {
    const writeText = vi.fn(async () => undefined)
    stubNavigator({ clipboard: { writeText } })
    const { copy } = await inSetup(() => useShareLink())
    await copy('https://x')
    expect(writeText).toHaveBeenCalledWith('https://x')
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ color: 'success' }))
  })

  it('shows the link when copying fails', async () => {
    stubNavigator({ clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('no'))) } })
    const { copy } = await inSetup(() => useShareLink())
    await copy('https://y')
    expect(toast.add).toHaveBeenCalledWith({ title: 'https://y', color: 'neutral' })
  })

  it('uses the share sheet and falls back to copying', async () => {
    const share = vi.fn(async () => undefined)
    const writeText = vi.fn(async () => undefined)
    stubNavigator({ share, clipboard: { writeText } })
    const { share: doShare, canShare } = await inSetup(() => useShareLink())
    expect(canShare.value).toBe(true)
    await doShare('https://z', 'Z')
    expect(share).toHaveBeenCalledWith({ url: 'https://z', title: 'Z' })
    share.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'AbortError' }))
    await doShare('https://z', 'Z')
    expect(writeText).not.toHaveBeenCalled()
    share.mockRejectedValueOnce(new Error('fail'))
    await doShare('https://z', 'Z')
    expect(writeText).toHaveBeenCalledWith('https://z')
  })
})

describe('useReauth', () => {
  it('detects scope errors', () => {
    expect(isScopeError(new Error('missing scope'))).toBe(true)
    expect(isScopeError('bad scope')).toBe(true)
    expect(isScopeError(new Error('other'))).toBe(false)
  })

  it('offers to sign in again for scope errors and shows other errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { report } = await inSetup(() => useReauth())
    report(new Error('token scope missing'), 'Failed')
    expect(toast.add).toHaveBeenLastCalledWith(
      expect.objectContaining({
        color: 'warning',
        actions: [expect.objectContaining({ onClick: expect.any(Function) })],
      }),
    )
    signIn()
    history.replaceState(null, '', '/together?x=1#h')
    const [action] = toast.add.mock.lastCall![0].actions
    action.onClick()
    await vi.waitFor(() => expect(oauth.signIn).toHaveBeenCalledWith('me.test'))
    expect(sessionStorage.getItem('opendeck-signin-redirect')).toBe('/together?x=1#h')
    report(new Error('boom'), 'Failed')
    expect(toast.add).toHaveBeenLastCalledWith({ title: 'Failed', description: 'boom', color: 'error' })
  })
})

describe('useInstallApp', () => {
  it('offers manual steps on iOS and hides the banner once dismissed', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    const install = await inSetup(() => useInstallApp())
    expect(install.needsIosSteps.value).toBe(true)
    expect(install.available.value).toBe(true)
    expect(install.showBanner.value).toBe(true)
    install.dismiss()
    expect(install.showBanner.value).toBe(false)
    expect(localStorage.getItem('opendeck-install-dismissed')).toBeTruthy()
    expect(await install.install()).toBe(false)
  })

  it('treats a recently dismissed prompt as dismissed', async () => {
    localStorage.setItem('opendeck-install-dismissed', String(Date.now()))
    clearNuxtState()
    const install = await inSetup(() => useInstallApp())
    expect(install.showBanner.value).toBe(false)
  })
})

describe('notifications', () => {
  it('cannot notify without permission', async () => {
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'denied', requestPermission: vi.fn() }))
    expect(canNotify()).toBe(false)
    expect(await requestNotificationPermission()).toBe(false)
    await showNotification('x')
  })

  it('requests permission when undecided', async () => {
    const requestPermission = vi.fn(async () => 'granted')
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'default', requestPermission }))
    expect(await requestNotificationPermission()).toBe(true)
    requestPermission.mockRejectedValueOnce(new Error('x'))
    expect(await requestNotificationPermission()).toBe(false)
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'granted' }))
    expect(await requestNotificationPermission()).toBe(true)
  })

  it('shows through the service worker registration when there is one', async () => {
    const showNotificationSpy = vi.fn(async () => undefined)
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'granted' }))
    stubNavigator({ serviceWorker: { getRegistration: async () => ({ showNotification: showNotificationSpy }) } })
    await showNotification('Hello', { body: 'b' })
    expect(showNotificationSpy).toHaveBeenCalledWith(
      'Hello',
      expect.objectContaining({ body: 'b', icon: '/pwa-192x192.png' }),
    )
  })

  it('falls back to a page notification and logs failures', async () => {
    const instance = { addEventListener: vi.fn(), close: vi.fn() }
    const Ctor = vi.fn(function () {
      return instance
    })
    vi.stubGlobal('Notification', Object.assign(Ctor, { permission: 'granted' }))
    stubNavigator({ serviceWorker: { getRegistration: async () => undefined } })
    await showNotification('Hello')
    expect(Ctor).toHaveBeenCalledWith('Hello', expect.any(Object))
    const onClick = instance.addEventListener.mock.calls[0]![1] as () => void
    vi.spyOn(window, 'focus').mockImplementation(() => undefined)
    onClick()
    expect(instance.close).toHaveBeenCalled()

    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stubNavigator({ serviceWorker: { getRegistration: async () => Promise.reject(new Error('x')) } })
    await showNotification('Hello')
    expect(console.error).toHaveBeenCalled()
  })
})
