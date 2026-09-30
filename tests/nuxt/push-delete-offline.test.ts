import { afterEach, describe, expect, it, vi } from 'vitest'
import { DATA_DELETED_KEY } from '~/composables/useDeleteAllData'
import { persistStorage } from '~/composables/useOfflineDecks'
import { getDb } from '~/utils/db'
import { inSetup } from '../support/nuxt'
import { stubNavigator } from '../support/navigator'
import { signIn } from '../support/session'

function pushSupport(existing: object | null = null) {
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/x',
    toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/x' }),
    unsubscribe: vi.fn(async () => true),
  }
  const pushManager = {
    getSubscription: vi.fn(async () => existing),
    subscribe: vi.fn(async () => subscription),
  }
  stubNavigator({ serviceWorker: { getRegistration: async () => ({ pushManager }) } })
  vi.stubGlobal('PushManager', function PushManager() {})
  vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'granted' }))
  return { pushManager, subscription }
}

describe('usePushReminders', () => {
  it('does nothing without a service worker, session or permission', async () => {
    expect(await usePushReminders().subscribe()).toBe(false)
    await usePushReminders().unsubscribe()
    signIn()
    pushSupport()
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'denied' }))
    expect(await usePushReminders().subscribe()).toBe(false)
  })

  it('subscribes and registers the subscription with the server', async () => {
    signIn()
    const { pushManager } = pushSupport()
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST' ? new Response(null, { status: 204 }) : Response.json({ publicKey: 'AQAB' }),
    )
    vi.stubGlobal('fetch', fetch)
    const push = await inSetup(() => usePushReminders())
    expect(await push.subscribe()).toBe(true)
    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    })
    const body = JSON.parse(String(fetch.mock.calls[1]![1]!.body))
    expect(body).toMatchObject({
      did: 'did:plc:me',
      subscription: { endpoint: 'https://fcm.googleapis.com/x' },
      title: expect.any(String),
      body: expect.any(String),
    })
  })

  it('reuses an existing subscription and reports server refusals', async () => {
    signIn()
    const { pushManager, subscription } = pushSupport({ endpoint: 'e', toJSON: () => ({}) })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: string, init?: RequestInit) =>
        init?.method === 'POST' ? new Response(null, { status: 500 }) : Response.json({ publicKey: 'AQAB' }),
      ),
    )
    const push = await inSetup(() => usePushReminders())
    expect(await push.subscribe()).toBe(false)
    expect(pushManager.subscribe).not.toHaveBeenCalled()
    expect(subscription).toBeTruthy()
  })

  it('reports an unconfigured server and network failures', async () => {
    signIn()
    pushSupport()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503 })),
    )
    const push = await inSetup(() => usePushReminders())
    expect(await push.subscribe()).toBe(false)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    )
    expect(await push.subscribe()).toBe(false)
  })

  it('unsubscribes locally and on the server', async () => {
    const { subscription } = pushSupport({
      endpoint: 'https://fcm.googleapis.com/x',
      unsubscribe: vi.fn(async () => true),
    })
    const fetch = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    await usePushReminders().unsubscribe()
    expect(fetch).toHaveBeenCalledWith(
      '/.netlify/functions/push-subscribe',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(subscription).toBeTruthy()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('x'))),
    )
    await usePushReminders().unsubscribe()
    expect(console.error).toHaveBeenCalled()
  })
})

describe('useDeleteAllData', () => {
  const listing = (records: Record<string, string[]>) =>
    vi.fn(async (input: URL) => {
      const collection = new URL(String(input)).searchParams.get('collection')!
      const rkeys = records[collection] ?? []
      return Response.json({ records: rkeys.map((k) => ({ uri: `at://did:plc:me/${collection}/${k}` })) })
    })

  it('deletes every record and the vault, then signs out', async () => {
    const airspace = signIn()
    vi.stubGlobal(
      'fetch',
      listing({
        'space.opendeck.deck': ['d1'],
        'space.opendeck.card': ['c1', 'c2'],
        'space.opendeck.profile': ['self', 'other'],
      }),
    )
    const { rememberedIdentity } = await import('~/composables/useAirspace')
    localStorage.setItem('opendeck-identity', JSON.stringify({ did: 'did:plc:me', handle: null }))
    localStorage.setItem('opendeck-accent', '#fff')
    const del = useDeleteAllData()
    await del.deleteAll()
    expect(airspace.vault.manage.delete).toHaveBeenCalledTimes(1)
    expect(airspace.batch).toHaveBeenCalledTimes(3)
    expect(del.total.value).toBe(5)
    expect(del.done.value).toBe(5)
    expect(del.running.value).toBe(false)
    expect(localStorage.getItem('opendeck-accent')).toBeNull()
    expect(sessionStorage.getItem(DATA_DELETED_KEY)).toBe('1')
    expect(rememberedIdentity()).toBeNull()
  })

  it('skips a vault that does not exist and ignores concurrent runs', async () => {
    const airspace = signIn()
    airspace.vault.manage.exists.mockResolvedValue(false)
    vi.stubGlobal('fetch', listing({}))
    const del = useDeleteAllData()
    await Promise.all([del.deleteAll(), del.deleteAll()])
    expect(airspace.vault.manage.delete).not.toHaveBeenCalled()
  })

  it('stops with an error when the repository cannot be listed', async () => {
    signIn()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    )
    const del = useDeleteAllData()
    await expect(del.deleteAll()).rejects.toThrow('listRecords')
    expect(del.running.value).toBe(false)
  })
})

describe('useOfflineDecks', () => {
  const blob = { cid: 'media1', mimeType: 'image/png' }

  async function seed() {
    const airspace = signIn()
    const deck = {
      uri: 'at://did:plc:me/space.opendeck.deck/d1',
      cid: 'c',
      rkey: 'd1',
      author: 'did:plc:me',
      visibility: 'public' as const,
      value: { title: 'D', createdAt: '2026-01-01T00:00:00Z' },
    }
    await useSync().cacheDecks('did:plc:me', [deck])
    await useSync().cacheCards(deck.uri, [
      {
        uri: 'at://c1',
        cid: 'c',
        rkey: 'c1',
        value: { deck: 'd1', front: 'f', back: 'b', image: blob, createdAt: '' },
      },
    ])
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Blob(['img']))),
    )
    return { airspace, deck }
  }

  afterEach(() => vi.unstubAllGlobals())

  it('downloads media of all decks when the mode is all', async () => {
    const { airspace, deck } = await seed()
    stubNavigator({
      storage: {
        estimate: async () => ({ usage: 42 }),
        persisted: async () => false,
        persist: vi.fn(async () => true),
      },
    })
    const offline = useOfflineDecks()
    await offline.setMode('all')
    expect(offline.mode.value).toBe('all')
    expect(offline.status.value[deck.uri]).toBe('ready')
    expect(offline.usage.value).toBe(42)
    expect(airspace.blobs.url).toHaveBeenCalledTimes(1)
    expect((await getDb().media.get('media1'))?.blob).toBeTruthy()
  })

  it('removes media of decks that are no longer kept', async () => {
    const { deck } = await seed()
    const offline = useOfflineDecks()
    await offline.setMode('all')
    await offline.setKept(deck as never, false)
    expect(offline.status.value[deck.uri]).toBe('off')
    expect(await getDb().media.count()).toBe(0)
    await offline.setKept(deck as never, true)
    expect(offline.status.value[deck.uri]).toBe('ready')
  })

  it('keeps recently studied decks in recent mode', async () => {
    const { deck } = await seed()
    const offline = useOfflineDecks()
    await offline.syncMedia()
    expect(offline.status.value[deck.uri]).toBe('off')
    await useSync().cacheSessions(
      new Map([
        [
          's',
          {
            deck: 'd1',
            startedAt: new Date().toISOString(),
            endedAt: new Date().toISOString(),
            activeSeconds: 1,
            repetitions: 1,
            again: 0,
            hard: 0,
            good: 1,
            easy: 0,
            newCards: 0,
          },
        ],
      ]),
    )
    await offline.syncMedia()
    expect(offline.status.value[deck.uri]).toBe('ready')
  })

  it('skips failed downloads and handles storage errors', async () => {
    const { deck } = await seed()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    )
    stubNavigator({ storage: { estimate: async () => Promise.reject(new Error('x')) } })
    const offline = useOfflineDecks()
    await offline.setMode('all')
    expect(offline.status.value[deck.uri]).toBe('downloading')
    expect(offline.usage.value).toBeNull()
  })

  it('does nothing without a session and refreshes the library', async () => {
    const offline = useOfflineDecks()
    await offline.syncMedia()
    expect(offline.status.value).toEqual({})
    signIn()
    await offline.refreshLibrary()
    await Promise.all([offline.syncMedia(), offline.syncMedia()])
  })

  it('asks for persistent storage once', async () => {
    const persist = vi.fn(async () => true)
    stubNavigator({ storage: { persisted: async () => false, persist } })
    await persistStorage()
    expect(persist).toHaveBeenCalled()
    persist.mockClear()
    stubNavigator({ storage: { persisted: async () => true, persist } })
    await persistStorage()
    expect(persist).not.toHaveBeenCalled()
    stubNavigator({ storage: { persisted: async () => Promise.reject(new Error('x')) } })
    await persistStorage()
  })
})
