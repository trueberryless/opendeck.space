import { describe, expect, it, vi } from 'vitest'
import { motivationShownTo } from '~/composables/useMotivation'
import { computeStudyStats, loadSessions } from '~/composables/useStats'
import { dayKey } from '~/utils/day'
import { signIn } from '../support/session'

const today = new Date()
const session = (over: object = {}) => ({
  startedAt: today.toISOString(),
  endedAt: today.toISOString(),
  activeSeconds: 120,
  repetitions: 6,
  again: 1,
  hard: 0,
  good: 5,
  easy: 0,
  newCards: 2,
  ...over,
})

describe('loadSessions', () => {
  it('merges public, private and queued sessions and caches the fetched ones', async () => {
    const airspace = signIn()
    airspace.session.rows.set('a', session())
    airspace.vault.session.rows.set('b', session())
    await useSync().saveSessionDraft({ rkey: 'c', open: true, value: session() as never })
    expect(await loadSessions()).toHaveLength(3)
    expect((await useSync().getCachedSessions()).size).toBe(2)
  })

  it('uses cached sessions when fetching fails', async () => {
    const airspace = signIn()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await useSync().cacheSessions(new Map([['x', session() as never]]))
    airspace.session.list.mockRejectedValue(new Error('down'))
    expect(await loadSessions()).toHaveLength(1)
  })
})

describe('computeStudyStats / useStats', () => {
  it('counts learned cards of my decks', async () => {
    const airspace = signIn()
    const decks = useDecks()
    const deck = await decks.createDeck({ title: 'd' }, 'public')
    const cardRes = await decks.createCard(deck.rkey, { front: 'hola', back: 'hello' }, 'public')
    const cardUri = `at://did:plc:me/space.opendeck.card/${cardRes.rkey}`
    airspace.progress.rows.set('p', {
      card: cardUri,
      dueAt: today.toISOString(),
      stability: '3',
      difficulty: '3',
      repetitions: 4,
      lapses: 0,
      state: 'review',
      lastReviewedAt: today.toISOString(),
    })
    airspace.session.rows.set('s', session())
    const { stats } = await computeStudyStats()
    expect(stats).toMatchObject({ learned: 1, mostTrained: { front: 'hola', repetitions: 4 } })

    const state = useStats()
    await state.load()
    expect(state.stats.value?.learned).toBe(1)
    expect(state.loading.value).toBe(false)
    expect(useMotivation().summary.value).not.toBeNull()
    expect(dayKey(today) in (useMotivation().studied.value ?? {})).toBe(true)
  })

  it('resets stats when computing fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const state = useStats()
    state.stats.value = { learned: 1 } as never
    await state.load()
    expect(state.stats.value).toBeNull()
  })
})

describe('motivationShownTo', () => {
  it('never shows motivation to everyone unless the tier is public too', () => {
    expect(motivationShownTo(null)).toBe('me')
    expect(motivationShownTo({ showMotivation: 'everyone', showTier: 'me' })).toBe('me')
    expect(motivationShownTo({ showMotivation: 'everyone', showTier: 'everyone' })).toBe('everyone')
    expect(motivationShownTo({ showMotivation: 'nobody' })).toBe('nobody')
  })
})

describe('useMotivation', () => {
  it('derives visibility from prefs', () => {
    const motivation = useMotivation()
    expect(motivation.enabled.value).toBe(true)
    expect(motivation.breakReminders.value).toBe(true)
    expect(motivation.tierStyle.value).toBe('theme')
    expect(motivation.ownTier.value).toBeNull()
    expect(motivation.publicTier.value).toBeNull()
  })

  it('hides the public tier unless shared with everyone', () => {
    const motivation = useMotivation()
    const profile = useProfile()
    profile.prefs.value = { showTier: 'me' }
    motivation.summary.value = { tier: 'gold' } as never
    expect(motivation.ownTier.value).toBe('gold')
    expect(motivation.publicTier.value).toBeNull()
    profile.prefs.value = { showTier: 'everyone' }
    expect(motivation.publicTier.value).toBe('gold')
    profile.prefs.value = { showTier: 'nobody' }
    expect(motivation.ownTier.value).toBeNull()
  })

  it('computes the tier and today load from activity and sessions', () => {
    const motivation = useMotivation()
    motivation.apply({ [dayKey(today)]: 6 }, [
      session() as never,
      session({ startedAt: '2020-01-01T00:00:00Z' }) as never,
    ])
    expect(motivation.today.value).toEqual({ repetitions: 6, newCards: 2, activeSeconds: 120 })
    expect(motivation.summary.value?.studiedToday).toBe(true)
  })

  it('publishes the tier and study days only when shared', async () => {
    const airspace = signIn()
    const profile = useProfile()
    profile.prefs.value = { showTier: 'everyone', showMotivation: 'everyone', showStats: 'me' }
    profile.loaded.value = true
    const motivation = useMotivation()
    motivation.apply({ [dayKey(today)]: 6 }, [session() as never])
    await vi.waitFor(() => expect(airspace.profile.put).toHaveBeenCalled())
    const saved = airspace.profile.put.mock.calls[0]![0] as Record<string, unknown>
    expect(saved).toMatchObject({ studyTier: expect.any(String), studyDays: expect.any(Array) })
    expect(saved.publicStats).toBeUndefined()

    airspace.profile.put.mockClear()
    await motivation.publish()
    expect(airspace.profile.put).not.toHaveBeenCalled()
  })

  it('does not publish while private or before the profile loaded', async () => {
    const airspace = signIn()
    const profile = useProfile()
    const motivation = useMotivation()
    profile.prefs.value = { showTier: 'everyone', showMotivation: 'everyone' }
    await motivation.publish()
    profile.loaded.value = true
    await motivation.publish()
    profile.prefs.value = {}
    await motivation.publish()
    expect(airspace.profile.put).not.toHaveBeenCalled()
  })

  it('refreshes from the progress map and sessions', async () => {
    signIn()
    const motivation = useMotivation()
    await motivation.refresh()
    expect(motivation.summary.value?.tier).toBe('bronze')
  })

  it('refreshes full stats when they are shared publicly', async () => {
    signIn()
    useProfile().prefs.value = { showStats: 'everyone' }
    const motivation = useMotivation()
    await motivation.refresh()
    expect(useStats().stats.value).not.toBeNull()
  })

  it('logs a failure to refresh', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { _setAirspace } = await import('~/composables/useAirspace')
    signIn()
    _setAirspace({
      progress: { list: () => Promise.reject(new Error('x')) },
      session: { list: () => Promise.reject(new Error('x')) },
      vault: { supported: () => Promise.resolve(false) },
    } as never)
    await useMotivation().refresh()
    expect(console.error).toHaveBeenCalled()
  })
})
