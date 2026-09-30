import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createKey, seal } from '~/utils/battle/crypto'

const signaling = vi.hoisted(() => ({
  watchers: [] as { subject: string; from?: string; cb: (s: unknown) => void; stop: () => void }[],
  sent: [] as { subject: string; payload: string }[],
  deleted: [] as string[],
}))

vi.mock('~/utils/battle/signaling', () => ({
  battleUri: (did: string, id: string) => `at://${did}/space.opendeck.battle/${id}`,
  sendSignal: async (subject: string, payload: string) => {
    signaling.sent.push({ subject, payload })
    return {
      did: 'did:plc:me',
      rkey: `rk${signaling.sent.length}`,
      uri: `at://did:plc:me/space.opendeck.signal/rk${signaling.sent.length}`,
      payload,
    }
  },
  deleteSignal: async (rkey: string) => void signaling.deleted.push(rkey),
  watchSignals: (subject: string, cb: (s: unknown) => void, from?: string) => {
    const watcher = { subject, from, cb, stop: vi.fn() }
    signaling.watchers.push(watcher)
    return watcher.stop
  },
}))

import { acceptGuests, connectToHost, link } from '~/utils/battle/peer'

class FakeChannel {
  readyState = 'open'
  sent: string[] = []
  listeners: Record<string, ((e: unknown) => void)[]> = {}
  addEventListener(type: string, fn: (e: unknown) => void) {
    ;(this.listeners[type] ??= []).push(fn)
  }
  emit(type: string, event: unknown = {}) {
    for (const fn of this.listeners[type] ?? []) fn(event)
  }
  send(data: string) {
    this.sent.push(data)
  }
  close = vi.fn(() => {
    this.readyState = 'closed'
    this.emit('close')
  })
}

class FakePC {
  static instances: FakePC[] = []
  iceGatheringState = 'complete'
  connectionState = 'new'
  localDescription: { toJSON: () => unknown } | null = null
  remote: unknown
  channel = new FakeChannel()
  listeners: Record<string, ((e: unknown) => void)[]> = {}
  closed = false
  constructor(public config: unknown) {
    FakePC.instances.push(this)
  }
  createDataChannel() {
    return this.channel
  }
  async createOffer() {
    return { type: 'offer', sdp: 'offer-sdp' }
  }
  async createAnswer() {
    return { type: 'answer', sdp: 'answer-sdp' }
  }
  async setLocalDescription(description: unknown) {
    this.localDescription = { toJSON: () => description }
  }
  async setRemoteDescription(description: unknown) {
    this.remote = description
    if ((description as { type: string }).type === 'offer') {
      queueMicrotask(() => setTimeout(() => this.emit('datachannel', { channel: this.channel }), 0))
    }
  }
  addEventListener(type: string, fn: (e: unknown) => void) {
    ;(this.listeners[type] ??= []).push(fn)
  }
  removeEventListener() {}
  emit(type: string, event: unknown = {}) {
    for (const fn of this.listeners[type] ?? []) fn(event)
  }
  close() {
    this.closed = true
  }
}

beforeEach(() => {
  FakePC.instances = []
  signaling.watchers.length = 0
  signaling.sent.length = 0
  signaling.deleted.length = 0
  vi.stubGlobal('RTCPeerConnection', FakePC)
})

afterEach(() => vi.useRealTimers())

describe('connectToHost', () => {
  it('sends an encrypted offer and connects once the host answers', async () => {
    const key = createKey()
    const connecting = connectToHost('did:plc:host', 'b1', key)
    await vi.waitFor(() => expect(signaling.watchers).toHaveLength(1))
    const [watcher] = signaling.watchers
    expect(watcher!.subject).toBe('at://did:plc:me/space.opendeck.signal/rk1')
    expect(watcher!.from).toBe('did:plc:host')
    expect(signaling.sent[0]!.subject).toBe('at://did:plc:host/space.opendeck.battle/b1')

    watcher!.cb({ payload: await seal(createKey(), { type: 'answer', sdp: 'wrong key' }) })
    watcher!.cb({ payload: await seal(key, { type: 'answer', sdp: 'from-host' }) })
    const peer = await connecting
    expect(peer.did).toBe('did:plc:host')
    expect(FakePC.instances[0]!.remote).toEqual({ type: 'answer', sdp: 'from-host' })
    expect(watcher!.stop).toHaveBeenCalled()
    await vi.waitFor(() => expect(signaling.deleted).toEqual(['rk1']))
  })

  it('fails when the host never answers', async () => {
    vi.useFakeTimers()
    const connecting = connectToHost('did:plc:host', 'b1', createKey())
    const assertion = expect(connecting).rejects.toThrow('No answer')
    await vi.waitFor(() => expect(signaling.watchers).toHaveLength(1))
    await vi.advanceTimersByTimeAsync(46000)
    await assertion
    expect(FakePC.instances[0]!.closed).toBe(true)
  })
})

describe('acceptGuests', () => {
  it('answers an offer and hands over the connected guest', async () => {
    const key = createKey()
    const onGuest = vi.fn()
    const stop = acceptGuests('did:plc:me', 'b1', key, onGuest)
    const [watcher] = signaling.watchers
    expect(watcher!.subject).toBe('at://did:plc:me/space.opendeck.battle/b1')
    expect(stop).toBe(watcher!.stop)

    watcher!.cb({
      did: 'did:plc:guest',
      uri: 'at://did:plc:guest/space.opendeck.signal/g1',
      payload: await seal(key, { type: 'offer', sdp: 'o' }),
    })
    await vi.waitFor(() => expect(onGuest).toHaveBeenCalledTimes(1))
    expect(onGuest.mock.calls[0]![0]).toMatchObject({ did: 'did:plc:guest' })
    expect(signaling.sent[0]!.subject).toBe('at://did:plc:guest/space.opendeck.signal/g1')
    await vi.waitFor(() => expect(signaling.deleted).toHaveLength(1))
  })

  it('logs a guest that could not connect', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    acceptGuests('did:plc:me', 'b1', createKey(), vi.fn())
    signaling.watchers[0]!.cb({ did: 'd', uri: 'u', payload: 'garbage' })
    await vi.waitFor(() => expect(console.error).toHaveBeenCalled())
  })
})

describe('link', () => {
  const peer = () => {
    const pc = new FakePC({})
    return {
      did: 'did:plc:x',
      pc: pc as unknown as RTCPeerConnection,
      channel: pc.channel as unknown as RTCDataChannel,
      fake: pc,
    }
  }

  it('parses incoming messages and ignores malformed ones', () => {
    const p = peer()
    const onMessage = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    link(p, onMessage, vi.fn())
    p.fake.channel.emit('message', { data: '{"type":"hello"}' })
    p.fake.channel.emit('message', { data: 'nope' })
    expect(onMessage).toHaveBeenCalledOnce()
    expect(onMessage).toHaveBeenCalledWith({ type: 'hello' })
  })

  it('sends only while open and closes once', () => {
    const p = peer()
    const onClose = vi.fn()
    const l = link<unknown, unknown>(p, vi.fn(), onClose)
    l.send({ a: 1 })
    expect(p.fake.channel.sent).toEqual(['{"a":1}'])
    l.close()
    l.close()
    l.send({ b: 2 })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(p.fake.closed).toBe(true)
    expect(p.fake.channel.sent).toHaveLength(1)
  })

  it('closes when the connection fails', () => {
    const p = peer()
    const onClose = vi.fn()
    link(p, vi.fn(), onClose)
    p.fake.connectionState = 'connected'
    p.fake.emit('connectionstatechange')
    expect(onClose).not.toHaveBeenCalled()
    p.fake.connectionState = 'failed'
    p.fake.emit('connectionstatechange')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
