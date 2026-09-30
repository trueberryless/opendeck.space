import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuestMessage, HostMessage } from '~/utils/battle/game'
import { signIn } from '../support/session'

interface FakePeer {
  did: string
  pc: { close: () => void }
  channel: object
}

const battle = vi.hoisted(() => ({
  links: [] as {
    peer: FakePeer
    onMessage: (m: unknown) => void
    onClose: () => void
    sent: unknown[]
    closed: boolean
  }[],
  onGuest: null as null | ((peer: FakePeer) => void),
  stop: vi.fn(),
  connect: vi.fn(),
}))

vi.mock('~/utils/battle/peer', () => ({
  acceptGuests: (_did: string, _id: string, _key: string, onGuest: (peer: FakePeer) => void) => {
    battle.onGuest = onGuest
    return battle.stop
  },
  connectToHost: (...args: unknown[]) => battle.connect(...args),
  link: (peer: FakePeer, onMessage: (m: unknown) => void, onClose: () => void) => {
    const entry = { peer, onMessage, onClose, sent: [] as unknown[], closed: false }
    battle.links.push(entry)
    return {
      send: (m: unknown) => void entry.sent.push(m),
      close: () => {
        if (entry.closed) return
        entry.closed = true
        onClose()
      },
    }
  },
}))

vi.mock('~/utils/bsky', () => ({
  getBskyProfile: async (did: string) =>
    did === 'did:plc:broken'
      ? Promise.reject(new Error('x'))
      : { did, handle: `${did}.test`, displayName: did === 'did:plc:g1' ? 'Guest One' : undefined, avatar: 'a.png' },
}))

const cards = Array.from({ length: 8 }, (_, i) => ({ front: `f${i}`, back: `b${i}` }))
const peer = (did: string): FakePeer => ({ did, pc: { close: vi.fn() }, channel: {} })

beforeEach(() => {
  battle.links.length = 0
  battle.onGuest = null
  battle.stop.mockReset()
  battle.connect.mockReset()
  useBattle().leave()
})

async function hostWithGuest(did = 'did:plc:g1') {
  signIn()
  const b = useBattle()
  const info = b.hostBattle('deck', cards)
  battle.onGuest!(peer(did))
  const guest = battle.links.at(-1)!
  guest.onMessage({ type: 'hello', tier: 'gold' })
  await vi.waitFor(() => expect(b.state.value.view?.players).toHaveLength(2))
  return { b, info, guest }
}

describe('hosting', () => {
  it('opens a lobby with the host seated', () => {
    signIn()
    const b = useBattle()
    const { id, key } = b.hostBattle('deck', cards)
    expect(b.state.value).toMatchObject({ role: 'host', id, key, hostDid: 'did:plc:me', status: 'connected' })
    expect(b.state.value.view).toMatchObject({ phase: 'lobby', deck: 'deck' })
    expect(b.state.value.view!.players.map((p) => p.did)).toEqual(['did:plc:me'])
  })

  it('seats guests and sends them the view', async () => {
    const { b, guest } = await hostWithGuest()
    expect(b.state.value.view!.players.map((p) => p.name)).toEqual(['me.test', 'Guest One'])
    expect(guest.sent.at(-1)).toMatchObject({ type: 'view' })
  })

  it('uses the did as name when the profile cannot be loaded', async () => {
    const { b } = await hostWithGuest('did:plc:broken')
    expect(b.state.value.view!.players[1]!.name).toBe('did:plc:broken')
  })

  it('starts the game, takes host and guest answers and reveals', async () => {
    const { b, guest } = await hostWithGuest()
    expect(b.start()).toBe(true)
    const view = b.state.value.view!
    expect(view.phase).toBe('question')
    b.answer(0)
    b.answer(1)
    expect(b.state.value.choice).toBe(0)
    guest.onMessage({ type: 'answer', round: view.round, choice: 2, ms: 100 } satisfies GuestMessage)
    expect(b.state.value.view!.phase).toBe('reveal')
    b.leave()
  })

  it('toggles the handicap and cannot start alone with too few cards', () => {
    signIn()
    const b = useBattle()
    b.hostBattle('deck', cards.slice(0, 2))
    expect(b.start()).toBe(false)
    b.setHandicap(false)
    expect(b.state.value.view!.handicap).toBe(false)
  })

  it('turns away guests when the room is full', async () => {
    signIn()
    const b = useBattle()
    b.hostBattle('deck', cards)
    for (let i = 0; i < 8; i++) {
      battle.onGuest!(peer(`did:plc:x${i}`))
      battle.links.at(-1)!.onMessage({ type: 'hello', tier: null })
    }
    await vi.waitFor(() =>
      expect(battle.links.some((l) => l.sent.some((m) => (m as HostMessage).type === 'full'))).toBe(true),
    )
    expect(battle.links.filter((l) => l.closed).length).toBeGreaterThan(0)
  })

  it('removes a guest who disconnects and replaces a duplicate connection', async () => {
    const { b, guest } = await hostWithGuest()
    guest.onClose()
    expect(b.state.value.view!.players.map((p) => p.did)).toEqual(['did:plc:me'])
    battle.onGuest!(peer('did:plc:g1'))
    battle.onGuest!(peer('did:plc:g1'))
    expect(battle.links.filter((l) => l.peer.did === 'did:plc:g1' && l.closed).length).toBeGreaterThanOrEqual(1)
  })

  it('tells guests when the host leaves', async () => {
    const { b, guest } = await hostWithGuest()
    b.leave()
    expect(guest.sent).toContainEqual({ type: 'closed' })
    expect(battle.stop).toHaveBeenCalled()
    expect(b.state.value).toMatchObject({ status: 'idle', role: null })
  })
})

describe('joining', () => {
  it('connects, says hello and follows the hosts views', async () => {
    signIn('did:plc:guest')
    const hostLink = { peer: peer('did:plc:host') }
    battle.connect.mockResolvedValue(hostLink.peer)
    const b = useBattle()
    await b.join('did:plc:host', 'id1', 'key1')
    const link = battle.links.at(-1)!
    expect(b.state.value).toMatchObject({ role: 'guest', status: 'connected', hostDid: 'did:plc:host' })
    expect(link.sent).toContainEqual({ type: 'hello', tier: null })

    const view = {
      phase: 'question' as const,
      round: 0,
      rounds: 10,
      deck: 'd',
      handicap: true,
      players: [],
      question: { prompt: 'p', options: ['a', 'b', 'c', 'd'], optionReadings: [] },
      answer: null,
      remainingMs: 15000,
    }
    link.onMessage({ type: 'view', view } satisfies HostMessage)
    expect(b.state.value.view).toMatchObject({ phase: 'question' })
    b.answer(2)
    expect(link.sent.at(-1)).toMatchObject({ type: 'answer', round: 0, choice: 2 })
    b.answer(1)
    expect(link.sent.filter((m) => (m as GuestMessage).type === 'answer')).toHaveLength(1)

    link.onMessage({ type: 'view', view: { ...view, round: 1 } })
    expect(b.state.value.choice).toBeNull()
    link.onMessage({ type: 'full' })
    expect(b.state.value.status).toBe('full')
    link.onMessage({ type: 'closed' })
    expect(b.state.value.status).toBe('closed')
  })

  it('marks the battle closed when the connection drops', async () => {
    signIn('did:plc:guest')
    battle.connect.mockResolvedValue(peer('did:plc:host'))
    const b = useBattle()
    await b.join('did:plc:host', 'id1', 'key1')
    battle.links.at(-1)!.onClose()
    expect(b.state.value.status).toBe('closed')
  })

  it('fails when the host cannot be reached', async () => {
    signIn('did:plc:guest')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    battle.connect.mockRejectedValue(new Error('timeout'))
    const b = useBattle()
    await expect(b.join('did:plc:host', 'id1', 'key1')).rejects.toThrow('timeout')
    expect(b.state.value.status).toBe('failed')
  })

  it('drops a connection that finished after leaving', async () => {
    signIn('did:plc:guest')
    const late = peer('did:plc:host')
    battle.connect.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(late), 5)))
    const b = useBattle()
    const joining = b.join('did:plc:host', 'id1', 'key1')
    b.leave()
    await joining
    expect(late.pc.close).toHaveBeenCalled()
  })

  it('ignores answers outside a question', () => {
    const b = useBattle()
    b.answer(1)
    expect(b.start()).toBe(false)
    b.setHandicap(true)
  })
})
