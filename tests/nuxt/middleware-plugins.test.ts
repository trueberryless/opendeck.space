import { afterEach, describe, expect, it, vi } from 'vitest'
import { _markAuthReady } from '~/composables/useAirspace'
import authMiddleware from '~/middleware/auth'
import { stubNavigator } from '../support/navigator'
import { signIn } from '../support/session'
import '../support/reset'

describe('auth middleware', () => {
  const route = (fullPath: string) => ({ fullPath, path: fullPath }) as never

  it('sends signed out visitors to the login page and remembers where they wanted to go', async () => {
    _markAuthReady()
    await navigateTo('/study')
    const current = useRouter().currentRoute.value
    expect(current.path).toBe('/login')
    expect(current.query.redirect).toBe('/study')
  })

  it('lets signed in users through', async () => {
    _markAuthReady()
    signIn()
    expect(await authMiddleware(route('/settings'), route('/'))).toBeUndefined()
  })
})

describe('useAirspace helpers', () => {
  it('remembers and forgets the identity', async () => {
    const { rememberIdentity, rememberedIdentity } = await import('~/composables/useAirspace')
    expect(rememberedIdentity()).toBeNull()
    rememberIdentity({ did: 'did:plc:me', handle: 'me.test' })
    expect(rememberedIdentity()).toEqual({ did: 'did:plc:me', handle: 'me.test' })
    localStorage.setItem('opendeck-identity', JSON.stringify({ did: 'did:plc:x' }))
    expect(rememberedIdentity()).toEqual({ did: 'did:plc:x', handle: null })
    localStorage.setItem('opendeck-identity', '{}')
    expect(rememberedIdentity()).toBeNull()
    localStorage.setItem('opendeck-identity', 'nope')
    expect(rememberedIdentity()).toBeNull()
    rememberIdentity(null)
    expect(localStorage.getItem('opendeck-identity')).toBeNull()
  })

  it('exposes the connection state and the logged in flag after hydration', async () => {
    const { useIsLoggedIn, useOAuth, useAirspace, requireAirspace, onlineAirspace, readAirspace, signOut } =
      await import('~/composables/useAirspace')
    expect(useOAuth).toBeTypeOf('function')
    expect(useAirspace()).toBeNull()
    expect(onlineAirspace()).toBeNull()
    expect(() => requireAirspace()).toThrow('not authenticated')
    const loggedIn = useIsLoggedIn()
    expect(loggedIn.value).toBe(false)
    useHydrated().value = true
    signIn()
    expect(loggedIn.value).toBe(true)
    expect(useAirspace()).not.toBeNull()
    expect(onlineAirspace()).not.toBeNull()
    expect(readAirspace('did:plc:a')).toBe(readAirspace('did:plc:a'))
    expect(useConnected().value).toBe(false)
    expect(signOut).toBeTypeOf('function')
  })

  it('does not use the client while offline', async () => {
    signIn()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const { onlineAirspace } = await import('~/composables/useAirspace')
    expect(onlineAirspace()).toBeNull()
  })

  it('signs out by forgetting the identity and revoking the session', async () => {
    const { signOut, rememberIdentity, rememberedIdentity } = await import('~/composables/useAirspace')
    signIn()
    rememberIdentity({ did: 'did:plc:me', handle: 'me.test' })
    await signOut()
    expect(rememberedIdentity()).toBeNull()
  })
})

describe('page backdrop and tier celebration state', () => {
  it('start empty and are shared', () => {
    expect(usePageBackdrop().value).toBeNull()
    usePageBackdrop().value = { tier: 'gold', role: null }
    expect(usePageBackdrop().value?.tier).toBe('gold')
    expect(useTierCelebration().value).toBeNull()
  })
})

afterEach(() => vi.useRealTimers())

describe('stubNavigator', () => {
  it('restores the original after the test', () => {
    stubNavigator({ language: 'xx' })
    expect(navigator.language).toBe('xx')
  })

  it('leaves navigator untouched afterwards', () => {
    expect(navigator.language).not.toBe('xx')
  })
})
