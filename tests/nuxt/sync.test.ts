import { describe, expect, it, vi } from 'vitest'
import { getDb } from '~/utils/db'
import type { ProgressValue } from '~/utils/records'
import type { DeckView } from '~/composables/useDecks'
import { inSetup } from '../support/nuxt'
import { signIn } from '../support/session'

const progress = (over: Partial<ProgressValue> = {}): ProgressValue => ({
  card: 'at://did:plc:me/space.opendeck.card/c1',
  dueAt: '2026-06-15T12:00:00.000Z',
  stability: '1',
  difficulty: '1',
  repetitions: 1,
  lapses: 0,
  state: 'review',
  lastReviewedAt: '2026-06-15T12:00:00.000Z',
  ...over,
})

const deck = (rkey: string, over: Partial<DeckView> = {}): DeckView => ({
  uri: `at://did:plc:me/space.opendeck.deck/${rkey}`,
  cid: 'c',
  rkey,
  author: 'did:plc:me',
  value: { title: rkey, createdAt: `2026-01-0${rkey.length}T00:00:00Z` },
  visibility: 'public',
  ...over,
})

describe('useSync outbox', () => {
  it('queues grades and counts them as pending', async () => {
    const sync = useSync()
    await sync.enqueueProgress({ cardUri: 'c', cardRkey: 'r', progressRkey: null, value: progress() })
    expect(sync.pending.value).toBe(1)
    await sync.refreshPending()
    expect(sync.pending.value).toBe(1)
  })

  it('keeps only the latest grade per card', async () => {
    const sync = useSync()
    await sync.enqueueProgress({ cardUri: 'c', cardRkey: 'r', progressRkey: 'p', value: progress({ repetitions: 1 }) })
    await sync.enqueueProgress({ cardUri: 'c', cardRkey: 'r', progressRkey: 'p', value: progress({ repetitions: 2 }) })
    expect(sync.pending.value).toBe(1)
    expect((await sync.getCachedProgressMap()).get('c')!.value.repetitions).toBe(2)
  })

  it('flushes to the vault when spaces are supported, creating or updating records', async () => {
    const airspace = signIn()
    const sync = useSync()
    await sync.enqueueProgress({ cardUri: 'a', cardRkey: 'r', progressRkey: null, value: progress() })
    await sync.enqueueProgress({ cardUri: 'b', cardRkey: 'r', progressRkey: 'known', value: progress() })
    await sync.flush()
    expect(airspace.vault.progress.create).toHaveBeenCalledTimes(1)
    expect(airspace.vault.progress.put).toHaveBeenCalledWith('known', expect.objectContaining({ repetitions: 1 }))
    expect(sync.pending.value).toBe(0)
    expect(sync.syncFailed.value).toBe(false)
  })

  it('flushes to the public repository without spaces support', async () => {
    const airspace = signIn()
    airspace.vault.supported.mockResolvedValue(false)
    const sync = useSync()
    await sync.enqueueProgress({ cardUri: 'a', cardRkey: 'r', progressRkey: null, value: progress() })
    await sync.enqueueProgress({ cardUri: 'b', cardRkey: 'r', progressRkey: 'known', value: progress() })
    await sync.flush()
    expect(airspace.progress.create).toHaveBeenCalledTimes(1)
    expect(airspace.progress.put).toHaveBeenCalledTimes(1)
    expect(sync.pending.value).toBe(0)
  })

  it('keeps the outbox and reports a failure when a write fails', async () => {
    const airspace = signIn()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    airspace.vault.progress.create.mockRejectedValue(new Error('down'))
    const sync = useSync()
    await sync.enqueueProgress({ cardUri: 'a', cardRkey: 'r', progressRkey: null, value: progress() })
    await sync.flush()
    expect(sync.pending.value).toBe(1)
    expect(sync.syncFailed.value).toBe(true)
  })

  it('does nothing without a session', async () => {
    const sync = useSync()
    await sync.enqueueProgress({ cardUri: 'a', cardRkey: 'r', progressRkey: null, value: progress() })
    await sync.flush()
    expect(sync.pending.value).toBe(1)
  })

  it('forgets progress of both directions', async () => {
    const sync = useSync()
    await sync.enqueueProgress({ cardUri: 'x', cardRkey: 'r', progressRkey: null, value: progress() })
    await sync.enqueueProgress({ cardUri: 'x#reverse', cardRkey: 'r', progressRkey: null, value: progress() })
    await sync.cacheProgress('x', 'rk', progress())
    await sync.forgetProgress(['x'])
    expect(sync.pending.value).toBe(0)
    expect((await sync.getCachedProgressMap()).size).toBe(0)
  })

  it('reads queued grades over cached ones', async () => {
    const sync = useSync()
    await sync.cacheProgressMap(new Map([['c', { rkey: 'old', value: progress({ repetitions: 1 }) }]]))
    await sync.enqueueProgress({ cardUri: 'c', cardRkey: 'r', progressRkey: null, value: progress({ repetitions: 9 }) })
    const map = await sync.getCachedProgressMap()
    expect(map.get('c')).toMatchObject({ rkey: '', value: { repetitions: 9 } })
  })
})

describe('useSync sessions', () => {
  const session = (endedAt: string) => ({
    startedAt: endedAt,
    endedAt,
    activeSeconds: 1,
    repetitions: 1,
    again: 0,
    hard: 0,
    good: 1,
    easy: 0,
    newCards: 0,
  })

  it('sends finished sessions and holds back recently active open ones', async () => {
    const airspace = signIn()
    const sync = useSync()
    const recent = new Date().toISOString()
    await sync.saveSessionDraft({ rkey: 'done', open: false, value: session(recent) })
    await sync.saveSessionDraft({ rkey: 'live', open: true, value: session(recent) })
    await sync.saveSessionDraft({ rkey: 'stale', open: true, value: session('2020-01-01T00:00:00Z') })
    await sync.flush()
    expect(airspace.vault.session.put.mock.calls.map((c) => c[0]).sort()).toEqual(['done', 'stale'])
    expect((await sync.getQueuedSessions()).map((s) => s.rkey)).toEqual(['live'])
  })

  it('closes other open drafts', async () => {
    const sync = useSync()
    await sync.saveSessionDraft({ rkey: 'a', open: true, value: session('2026-01-01T00:00:00Z') })
    await sync.saveSessionDraft({ rkey: 'b', open: true, value: session('2026-01-01T00:00:00Z') })
    await sync.closeSessionDrafts('b')
    const open = Object.fromEntries((await sync.getQueuedSessions()).map((s) => [s.rkey, s.open]))
    expect(open).toEqual({ a: false, b: true })
  })

  it('caches sessions by rkey', async () => {
    const sync = useSync()
    await sync.cacheSessions(new Map([['a', session('2026-01-01T00:00:00Z')]]))
    expect([...(await sync.getCachedSessions()).keys()]).toEqual(['a'])
  })
})

describe('useSync decks and cards', () => {
  it('caches decks per author, dropping decks and cards that are gone', async () => {
    const sync = useSync()
    const a = deck('a')
    const gone = deck('gone')
    await sync.cacheDecks('did:plc:me', [a, gone])
    await sync.cacheCards(gone.uri, [
      { uri: 'c1', cid: 'x', rkey: 'c1', value: { deck: 'gone', front: 'f', back: 'b', createdAt: '' } },
    ])
    await sync.cacheDecks('did:plc:me', [a])
    expect((await sync.getCachedDecks('did:plc:me')).map((d) => d.rkey)).toEqual(['a'])
    expect(await sync.getCachedCards(gone.uri)).toEqual([])
  })

  it('returns cached decks newest first and a single deck by uri', async () => {
    const sync = useSync()
    await sync.cacheDecks('did:plc:me', [deck('a'), deck('bbb')])
    expect((await sync.getCachedDecks('did:plc:me')).map((d) => d.rkey)).toEqual(['bbb', 'a'])
    await sync.cacheDeck(deck('single'))
    expect((await sync.getCachedDeck(deck('single').uri))?.rkey).toBe('single')
    expect(await sync.getCachedDeck('at://none')).toBeNull()
  })

  it('replaces the cards of a deck', async () => {
    const sync = useSync()
    const card = (rkey: string) => ({
      uri: rkey,
      cid: 'c',
      rkey,
      value: { deck: 'd', front: rkey, back: 'b', createdAt: '' },
    })
    await sync.cacheCards('d', [card('1'), card('2')])
    await sync.cacheCards('d', [card('3')])
    expect((await sync.getCachedCards('d')).map((c) => c.rkey)).toEqual(['3'])
  })
})

describe('useSyncStatus', () => {
  it('is saved when nothing is pending and syncing or failed otherwise', async () => {
    const sync = useSync()
    const status = await inSetup(() => useSyncStatus())
    expect(status.status.value).toBe('saved')
    await sync.enqueueProgress({ cardUri: 'a', cardRkey: 'r', progressRkey: null, value: progress() })
    expect(status.status.value).toBe('syncing')
    expect(status.icon.value).toBe('i-lucide-refresh-cw')
    sync.syncFailed.value = true
    expect(status.status.value).toBe('failed')
    expect(status.detail.value).toBeTruthy()
  })

  it('is offline without a connection', async () => {
    const status = await inSetup(() => useSyncStatus())
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
    expect(status.status.value).toBe('offline')
    expect(status.detail.value).toBeTruthy()
    vi.restoreAllMocks()
    window.dispatchEvent(new Event('online'))
  })
})

describe('getDb', () => {
  it('reuses the same instance', () => {
    expect(getDb()).toBe(getDb())
  })
})
