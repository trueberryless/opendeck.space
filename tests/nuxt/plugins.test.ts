import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _markAuthReady, useAirspace, useAuthUser, useConnected } from '~/composables/useAirspace'
import airspacePlugin from '~/plugins/airspace.client'
import offlinePlugin from '~/plugins/offline.client'
import profilePlugin from '~/plugins/profile.client'
import pwaUpdatePlugin from '~/plugins/pwa-update.client'
import remindersPlugin from '~/plugins/reminders.client'
import syncPlugin from '~/plugins/sync.client'
import { getMeta } from '~/utils/db'
import { createBrowserOAuth, createSession, oauth } from '../support/oauth'
import { stubNavigator } from '../support/navigator'
import { signIn } from '../support/session'

const remote = vi.hoisted(() => ({ handler: (_url: string): unknown => undefined }))

mockNuxtImport('$fetch', (original) =>
  Object.assign(async (url: unknown, options?: unknown) => {
    if (typeof url === 'string' && /^https:\/\/(public\.api\.bsky\.app|plc\.directory)/.test(url)) {
      const result = remote.handler(url)
      if (result instanceof Error) throw result
      return result
    }
    return (original as Function)(url, options)
  }, original),
)

vi.mock('airspace', async (importOriginal) => {
  const collection = {
    list: async () => [],
    get: async () => null,
    create: async () => ({ uri: 'at://did:plc:me/space.opendeck.deck/r', cid: 'c', rkey: 'r' }),
    put: async () => ({}),
    delete: async () => undefined,
  }
  const vault = new Proxy(
    { supported: async () => false, manage: { ensure: async () => undefined } } as Record<string, unknown>,
    {
      get: (target, key: string) => target[key] ?? collection,
    },
  )
  const client = new Proxy({} as Record<string, unknown>, {
    get: (_, key: string) =>
      key === 'vault'
        ? vault
        : key === 'identity'
          ? async () => ({ did: 'did:plc:me', handle: 'me.test', service: 'https://pds.test' })
          : collection,
  })
  return { ...(await importOriginal<typeof import('airspace')>()), createAirspace: () => client }
})

function run(plugin: unknown) {
  const app = useNuxtApp()
  return app.runWithContext(() => (plugin as (a: unknown) => unknown)(app))
}

const grade = {
  card: 'c',
  dueAt: '',
  stability: '1',
  difficulty: '1',
  repetitions: 1,
  lapses: 0,
  state: 'review' as const,
  lastReviewedAt: '',
}

beforeEach(() => {
  remote.handler = () => undefined
  oauth.init.mockReset().mockResolvedValue(null)
  oauth.client.restore.mockReset().mockImplementation(async (did: string) => createSession(did))
  oauth.client.readCallbackParams.mockReset().mockReturnValue(null)
  oauth.signIn.mockClear()
  createBrowserOAuth.mockClear()
  _markAuthReady()
})

afterEach(() => vi.useRealTimers())

describe('profile plugin', () => {
  it('loads my profile from the network and caches it', async () => {
    const airspace = signIn()
    airspace.profile.set({ bio: 'hi' })
    remote.handler = () => ({ did: 'did:plc:me', handle: 'renamed.test', displayName: 'Me' })
    await run(profilePlugin)
    await vi.waitFor(() => expect(useMe().value?.displayName).toBe('Me'))
    expect(useAuthUser().value?.handle).toBe('renamed.test')
    expect(useProfile().prefs.value?.bio).toBe('hi')
    await vi.waitFor(async () => expect((await getMeta<{ did: string }>('me'))?.did).toBe('did:plc:me'))
  })

  it('takes the handle from the identity when offline', async () => {
    const airspace = signIn()
    airspace.identity.mockResolvedValue({ did: 'did:plc:me', handle: 'fromidentity.test', service: 'https://pds.test' })
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
    await run(profilePlugin)
    await vi.waitFor(() => expect(useAuthUser().value?.handle).toBe('fromidentity.test'))
  })

  it('sends a brand new account to the welcome page', async () => {
    signIn()
    remote.handler = () => ({ did: 'did:plc:me', handle: 'me.test' })
    await navigateTo('/')
    await run(profilePlugin)
    await vi.waitFor(() => expect(useRouter().currentRoute.value.path).toBe('/welcome'))
  })

  it('does nothing while signed out', async () => {
    await run(profilePlugin)
    await new Promise((r) => setTimeout(r, 20))
    expect(useMe().value).toBeNull()
  })
})

describe('sync plugin', () => {
  it('counts queued grades on startup and flushes them', async () => {
    const airspace = signIn()
    const sync = useSync()
    await sync.enqueueProgress({ cardUri: 'c', cardRkey: 'r', progressRkey: null, value: grade })
    sync.pending.value = 0
    await run(syncPlugin)
    await vi.waitFor(() => expect(airspace.vault.progress.create).toHaveBeenCalled())
    expect(sync.pending.value).toBe(0)
  })

  it('flushes again when the connection returns', async () => {
    const airspace = signIn()
    const sync = useSync()
    await run(syncPlugin)
    await sync.enqueueProgress({ cardUri: 'c', cardRkey: 'r', progressRkey: null, value: grade })
    useConnected().value = true
    await vi.waitFor(() => expect(airspace.vault.progress.create).toHaveBeenCalled())
  })
})

describe('offline plugin', () => {
  it('prepares offline media after start up', async () => {
    const airspace = signIn()
    stubNavigator({ storage: { estimate: async () => ({ usage: 1 }), persisted: async () => true } })
    await run(offlinePlugin)
    useConnected().value = true
    await vi.waitFor(() => expect(airspace.session.list).toHaveBeenCalled(), { timeout: 5000 })
  })

  it('does nothing without a user', async () => {
    await run(offlinePlugin)
    await new Promise((r) => setTimeout(r, 20))
  })
})

describe('reminders plugin', () => {
  it('leaves push alone when reminders are off', async () => {
    stubNavigator({ serviceWorker: { getRegistration: async () => undefined } })
    const profile = useProfile()
    profile.loaded.value = true
    profile.prefs.value = { reminderEnabled: false }
    await run(remindersPlugin)
    profile.prefs.value = { reminderEnabled: true }
    await new Promise((r) => setTimeout(r, 20))
    expect(profile.prefs.value.reminderEnabled).toBe(true)
  })

  it('shows an in-app reminder once per hour when push is unavailable', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    vi.setSystemTime(new Date('2026-06-15T19:05:00'))
    const shown = vi.fn()
    const Notification = Object.assign(
      function (this: unknown, title: string) {
        shown(title)
        return { addEventListener() {}, close() {} }
      },
      { permission: 'granted' },
    )
    vi.stubGlobal('Notification', Notification)
    stubNavigator({ serviceWorker: { getRegistration: async () => undefined } })
    const profile = useProfile()
    profile.loaded.value = true
    profile.prefs.value = { reminderEnabled: true, reminderHour: 19, reminderDays: [0, 1, 2, 3, 4, 5, 6] }
    await run(remindersPlugin)
    await vi.advanceTimersByTimeAsync(61_000)
    await vi.advanceTimersByTimeAsync(61_000)
    await vi.waitFor(() => expect(shown).toHaveBeenCalledTimes(1))
  })
})

describe('airspace plugin', () => {
  const session = createSession()

  function remember() {
    localStorage.setItem('opendeck-identity', JSON.stringify({ did: 'did:plc:me', handle: 'me.test' }))
  }

  it('signs in with a restored session and follows the saved redirect', async () => {
    oauth.init.mockResolvedValue({ did: 'did:plc:me', session, state: 'x' })
    sessionStorage.setItem('opendeck-signin-redirect', '/discover')
    sessionStorage.setItem('opendeck-signin-handle', 'me.test')
    const replace = vi.spyOn(useRouter(), 'replace').mockResolvedValue(undefined)
    await run(airspacePlugin)
    await vi.waitFor(() => expect(useConnected().value).toBe(true))
    expect(oauth.init).toHaveBeenCalledWith({ refresh: false })
    expect(useAirspace()).not.toBeNull()
    expect(useAuthUser().value).toMatchObject({ did: 'did:plc:me' })
    expect(sessionStorage.getItem('opendeck-signin-handle')).toBeNull()
    expect(localStorage.getItem('opendeck-last-did')).toBe('did:plc:me')
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/discover'))
  })

  it('clears local data when a different account signs in', async () => {
    localStorage.setItem('opendeck-last-did', 'did:plc:other')
    localStorage.setItem('opendeck-accent', '#fff')
    oauth.init.mockResolvedValue({ did: 'did:plc:me', session })
    await run(airspacePlugin)
    await vi.waitFor(() => expect(localStorage.getItem('opendeck-last-did')).toBe('did:plc:me'))
    expect(localStorage.getItem('opendeck-accent')).toBeNull()
  })

  it('signs the remembered user in at once without waiting for the network', async () => {
    remember()
    oauth.client.restore.mockReturnValueOnce(new Promise(() => undefined))
    await run(airspacePlugin)
    expect(useAuthUser().value).toMatchObject({ did: 'did:plc:me', handle: 'me.test' })
    expect(useConnected().value).toBe(false)
  })

  it('restores the remembered session from storage and checks the tokens in the background', async () => {
    remember()
    const restored = createSession()
    oauth.client.restore.mockResolvedValueOnce(restored)
    await run(airspacePlugin)
    await vi.waitFor(() => expect(useConnected().value).toBe(true))
    expect(oauth.client.restore).toHaveBeenCalledWith('did:plc:me', false)
    expect(oauth.init).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(restored.getTokenInfo).toHaveBeenCalled())
    expect(useAuthUser().value).toMatchObject({ did: 'did:plc:me', handle: 'me.test' })
  })

  it('handles a sign-in redirect even when a user is remembered', async () => {
    remember()
    oauth.client.readCallbackParams.mockReturnValueOnce(new URLSearchParams('state=x&code=y'))
    oauth.init.mockResolvedValue({ did: 'did:plc:me', session, state: 'x' })
    await run(airspacePlugin)
    await vi.waitFor(() => expect(useConnected().value).toBe(true))
    expect(oauth.init).toHaveBeenCalled()
    expect(oauth.client.restore).not.toHaveBeenCalled()
  })

  it('signs out and asks to sign in again when the session has expired', async () => {
    const { TokenRefreshError } = await import('@atproto/oauth-client-browser')
    remember()
    await navigateTo('/import')
    const restored = createSession()
    restored.getTokenInfo.mockRejectedValueOnce(new TokenRefreshError('did:plc:me', 'revoked'))
    oauth.client.restore.mockResolvedValueOnce(restored)
    await run(airspacePlugin)
    await vi.waitFor(() => expect(useAuthUser().value).toBeNull())
    expect(useConnected().value).toBe(false)
    expect(useAirspace()).toBeNull()
    expect(localStorage.getItem('opendeck-identity')).toBeNull()
    await vi.waitFor(() => expect(useToast().toasts.value.some((t) => t.id === 'session-expired')).toBe(true))
    await vi.waitFor(() => expect(useRouter().currentRoute.value.path).toBe('/login'))
    expect(useRouter().currentRoute.value.query.redirect).toBe('/import')
  })

  it('forgets the identity when the stored session is gone', async () => {
    const { TokenRefreshError } = await import('@atproto/oauth-client-browser')
    remember()
    oauth.client.restore.mockRejectedValueOnce(new TokenRefreshError('did:plc:me', 'deleted'))
    await run(airspacePlugin)
    await vi.waitFor(() => expect(localStorage.getItem('opendeck-identity')).toBeNull())
    expect(useAuthUser().value).toBeNull()
  })

  it('stays signed out quietly when there is no session at all', async () => {
    await run(airspacePlugin)
    await vi.waitFor(() => expect(oauth.init).toHaveBeenCalled())
    expect(useAuthUser().value).toBeNull()
    expect(useToast().toasts.value.some((t) => t.id === 'session-expired')).toBe(false)
  })

  it('retries the sign in with reduced scopes once when scopes are missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    sessionStorage.setItem('opendeck-signin-handle', 'me.test')
    oauth.init.mockRejectedValue(new Error('missing scope declaration'))
    await run(airspacePlugin)
    await vi.waitFor(() =>
      expect(oauth.signIn).toHaveBeenCalledWith('me.test', expect.objectContaining({ scopes: expect.anything() })),
    )
    expect(sessionStorage.getItem('opendeck-signin-retried')).toBe('1')
  })

  it('keeps the remembered user signed in when the network fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    remember()
    oauth.client.restore.mockRejectedValueOnce(new Error('network down'))
    await run(airspacePlugin)
    await vi.waitFor(() => expect(console.error).toHaveBeenCalled())
    expect(useAuthUser().value).toMatchObject({ did: 'did:plc:me' })
    expect(localStorage.getItem('opendeck-identity')).not.toBeNull()
  })

  it('keeps the user signed in when the token check fails for another reason', async () => {
    remember()
    const restored = createSession()
    restored.getTokenInfo.mockRejectedValueOnce(new Error('offline'))
    oauth.client.restore.mockResolvedValueOnce(restored)
    await run(airspacePlugin)
    await vi.waitFor(() => expect(restored.getTokenInfo).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 20))
    expect(useAuthUser().value).toMatchObject({ did: 'did:plc:me' })
    expect(useConnected().value).toBe(true)
  })

  it('keeps going when the oauth client cannot be created', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    remember()
    createBrowserOAuth.mockRejectedValueOnce(new Error('metadata'))
    await run(airspacePlugin)
    await vi.waitFor(() => expect(console.error).toHaveBeenCalled())
    expect(useAuthUser().value).toMatchObject({ did: 'did:plc:me' })
  })
})

describe('pwa update plugin', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function stubServiceWorker(registration: EventTarget, controller: unknown = {}) {
    const container = Object.assign(new EventTarget(), {
      controller,
      ready: Promise.resolve(registration),
      getRegistration: async () => registration,
    })
    stubNavigator({ onLine: true, serviceWorker: container })
    return container
  }

  function createRegistration(waiting: unknown = null) {
    return Object.assign(new EventTarget(), {
      waiting,
      installing: null as unknown,
      update: vi.fn(async () => undefined),
    })
  }

  function offer() {
    return useToast().toasts.value.find((t) => t.id === 'pwa-update')
  }

  async function start() {
    const app = useNuxtApp()
    await run(pwaUpdatePlugin)
    await app.callHook('app:mounted', app.vueApp)
  }

  it('checks for a new service worker when the app returns to the foreground, goes online or on a timer', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    const registration = createRegistration()
    stubServiceWorker(registration)
    await run(pwaUpdatePlugin)

    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalledTimes(1))

    window.dispatchEvent(new Event('online'))
    await new Promise((r) => setTimeout(r, 20))
    expect(registration.update).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(31 * 60 * 1000)
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalledTimes(2))
  })

  it('skips the check while offline', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    const registration = createRegistration()
    stubServiceWorker(registration)
    stubNavigator({ onLine: false })
    await run(pwaUpdatePlugin)
    await vi.advanceTimersByTimeAsync(31 * 60 * 1000)
    expect(registration.update).not.toHaveBeenCalled()
  })

  it('offers the update that was already waiting at start up', async () => {
    stubServiceWorker(createRegistration({ postMessage: vi.fn() }))
    await start()
    await vi.waitFor(() => expect(offer()).toBeDefined())
    expect(offer()!.duration).toBe(0)
  })

  it('offers an update once the new service worker has installed', async () => {
    const registration = createRegistration()
    stubServiceWorker(registration)
    await start()
    const worker = Object.assign(new EventTarget(), { state: 'installing' })
    registration.installing = worker
    registration.dispatchEvent(new Event('updatefound'))
    expect(offer()).toBeUndefined()
    worker.state = 'installed'
    worker.dispatchEvent(new Event('statechange'))
    await vi.waitFor(() => expect(offer()).toBeDefined())
  })

  it('does not offer the first install as an update', async () => {
    const registration = createRegistration()
    stubServiceWorker(registration, null)
    await start()
    const worker = Object.assign(new EventTarget(), { state: 'installed' })
    registration.installing = worker
    registration.dispatchEvent(new Event('updatefound'))
    worker.dispatchEvent(new Event('statechange'))
    await new Promise((r) => setTimeout(r, 20))
    expect(offer()).toBeUndefined()
  })

  it('activates the waiting worker, shows progress and reloads once it takes over', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    const waiting = { postMessage: vi.fn() }
    const container = stubServiceWorker(createRegistration(waiting))
    await start()
    await vi.waitFor(() => expect(offer()).toBeDefined())

    ;(offer()!.actions![0]!.onClick as () => void)()
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' }, [])
    await vi.waitFor(() => expect(useToast().toasts.value.some((t) => t.id === 'pwa-updating')).toBe(true))
    expect(reload).not.toHaveBeenCalled()

    container.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads anyway when the new worker never takes over', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    stubServiceWorker(createRegistration({ postMessage: vi.fn() }))
    await start()
    await vi.waitFor(() => expect(offer()).toBeDefined())
    ;(offer()!.actions![0]!.onClick as () => void)()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
