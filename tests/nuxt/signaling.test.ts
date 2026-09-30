import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readAirspace } from '~/composables/useAirspace'
import { battleUri, deleteSignal, sendSignal, watchSignals, type Signal } from '~/utils/battle/signaling'
import { signIn } from '../support/session'

const linked = vi.hoisted(() => ({ dids: [] as string[] }))

vi.mock('~/utils/constellation', () => ({
  getBacklinkDids: async () => ({ total: linked.dids.length, dids: linked.dids, cursor: null }),
}))

class FakeSocket {
  static instances: FakeSocket[] = []
  listeners: Record<string, ((event: unknown) => void)[]> = {}
  closed = false
  constructor(public url: URL) {
    FakeSocket.instances.push(this)
  }
  addEventListener(type: string, fn: (event: unknown) => void) {
    ;(this.listeners[type] ??= []).push(fn)
  }
  emit(type: string, event: unknown = {}) {
    for (const fn of this.listeners[type] ?? []) fn(event)
  }
  close() {
    this.closed = true
  }
}

const subject = battleUri('did:plc:host', 'b1')
const fresh = () => new Date().toISOString()
const commit = (record: unknown, operation = 'create', did = 'did:plc:guest', rkey = 'r1') =>
  JSON.stringify({
    did,
    time_us: 1,
    kind: 'commit',
    commit: { rev: 'x', operation, collection: 'space.opendeck.signal', rkey, record, cid: 'c' },
  })

beforeEach(() => {
  FakeSocket.instances = []
  linked.dids = []
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
})

afterEach(() => vi.useRealTimers())

describe('battleUri', () => {
  it('builds the record uri', () => {
    expect(subject).toBe('at://did:plc:host/space.opendeck.battle/b1')
  })
})

describe('sendSignal / deleteSignal', () => {
  it('creates a signal record about a subject', async () => {
    const airspace = signIn()
    const signal = await sendSignal(subject, 'payload')
    expect(airspace.signal.create).toHaveBeenCalledWith(expect.objectContaining({ subject, payload: 'payload' }))
    expect(signal).toMatchObject({ did: 'did:plc:me', payload: 'payload' })
    expect(signal.uri).toBe(`at://did:plc:me/space.opendeck.signal/${signal.rkey}`)
  })

  it('deletes a signal and only logs failures', async () => {
    const airspace = signIn()
    await deleteSignal('r1')
    expect(airspace.signal.delete).toHaveBeenCalledWith('r1')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    airspace.signal.delete.mockRejectedValue(new Error('x'))
    await deleteSignal('r2')
    expect(console.error).toHaveBeenCalled()
  })
})

describe('watchSignals', () => {
  it('delivers signals from the jetstream once and ignores other subjects, stale and deleted records', () => {
    const onSignal = vi.fn<(s: Signal) => void>()
    const stop = watchSignals(subject, onSignal)
    const [socket] = FakeSocket.instances
    expect(String(socket!.url)).toContain('wantedCollections=space.opendeck.signal')
    const message = (data: string) => socket!.emit('message', { data })

    message(commit({ subject, payload: 'p1', createdAt: fresh() }))
    message(commit({ subject, payload: 'p1', createdAt: fresh() }))
    message(commit({ subject: 'other', payload: 'p', createdAt: fresh() }, 'create', 'did:plc:g', 'r2'))
    message(commit({ subject, payload: 'p', createdAt: '2000-01-01T00:00:00Z' }, 'create', 'did:plc:g', 'r3'))
    message(commit({ subject, payload: 'p', createdAt: fresh() }, 'delete', 'did:plc:g', 'r4'))
    message(commit({ subject, payload: 5, createdAt: fresh() }, 'create', 'did:plc:g', 'r5'))
    expect(onSignal).toHaveBeenCalledTimes(1)
    expect(onSignal.mock.calls[0]![0]).toEqual({
      did: 'did:plc:guest',
      rkey: 'r1',
      uri: 'at://did:plc:guest/space.opendeck.signal/r1',
      payload: 'p1',
    })
    stop()
    expect(socket!.closed).toBe(true)
    message(commit({ subject, payload: 'late', createdAt: fresh() }, 'create', 'did:plc:g', 'r9'))
    expect(onSignal).toHaveBeenCalledTimes(1)
  })

  it('filters the stream by author when listening for one account', () => {
    watchSignals(subject, vi.fn(), 'did:plc:host')
    expect(String(FakeSocket.instances[0]!.url)).toContain('wantedDids=did%3Aplc%3Ahost')
  })

  it('polls the repository of the given account and de-duplicates', async () => {
    signIn()
    const list = vi
      .spyOn(readAirspace('did:plc:host').signal, 'list')
      .mockResolvedValue([{ rkey: 'r1', value: { subject, payload: 'p', createdAt: fresh() } }] as never)
    const onSignal = vi.fn()
    const stop = watchSignals(subject, onSignal, 'did:plc:host')
    await vi.advanceTimersByTimeAsync(4100)
    expect(list).toHaveBeenCalled()
    expect(onSignal).toHaveBeenCalledTimes(1)
    stop()
  })

  it('polls accounts linked through constellation when no account is given and survives errors', async () => {
    signIn()
    linked.dids = ['did:plc:a', 'did:plc:b']
    vi.spyOn(readAirspace('did:plc:a').signal, 'list').mockResolvedValue([
      { rkey: 'r1', value: { subject, payload: 'a', createdAt: fresh() } },
    ] as never)
    vi.spyOn(readAirspace('did:plc:b').signal, 'list').mockRejectedValue(new Error('x'))
    const onSignal = vi.fn()
    const stop = watchSignals(subject, onSignal)
    await vi.advanceTimersByTimeAsync(0)
    expect(onSignal).toHaveBeenCalledWith(expect.objectContaining({ did: 'did:plc:a', payload: 'a' }))
    stop()
  })

  it('reconnects with backoff to another jetstream', () => {
    const stop = watchSignals(subject, vi.fn())
    FakeSocket.instances[0]!.emit('open')
    FakeSocket.instances[0]!.emit('close')
    vi.advanceTimersByTime(1100)
    expect(FakeSocket.instances).toHaveLength(2)
    expect(String(FakeSocket.instances[1]!.url)).not.toBe(String(FakeSocket.instances[0]!.url))
    stop()
    FakeSocket.instances[1]!.emit('close')
    vi.advanceTimersByTime(60000)
    expect(FakeSocket.instances).toHaveLength(2)
  })
})
