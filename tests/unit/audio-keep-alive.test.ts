import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAudioKeepAlive } from '~/utils/audioKeepAlive'

class FakeParam {
  value = 0
  setValueAtTime = vi.fn((value: number) => (this.value = value))
  linearRampToValueAtTime = vi.fn((value: number) => (this.value = value))
}

class FakeContext {
  static instances: FakeContext[] = []
  static startsRunning = true
  currentTime = 0
  sampleRate = 100
  destination = {}
  state: 'running' | 'suspended' = 'suspended'
  sources: { loop: boolean; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = []
  gains: FakeParam[] = []

  constructor() {
    FakeContext.instances.push(this)
  }

  resume = vi.fn(async () => {
    if (FakeContext.startsRunning) this.state = 'running'
  })

  suspend = vi.fn(async () => {
    this.state = 'suspended'
  })

  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length)
    return { getChannelData: () => data }
  }

  createGain() {
    const gain = new FakeParam()
    this.gains.push(gain)
    return { gain, connect: vi.fn() }
  }

  createBufferSource() {
    const source = { buffer: null, loop: false, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
    this.sources.push(source)
    return source
  }
}

let session: { type: string }

beforeEach(() => {
  vi.useFakeTimers()
  FakeContext.instances = []
  FakeContext.startsRunning = true
  session = { type: 'auto' }
  vi.stubGlobal('AudioContext', FakeContext)
  vi.stubGlobal('navigator', { audioSession: session })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function settled(promise: Promise<void>) {
  let done = false
  void promise.then(() => (done = true))
  await vi.advanceTimersByTimeAsync(0)
  return () => done
}

describe('createAudioKeepAlive', () => {
  it('plays an inaudible loop and waits for a sleeping output to wake up', async () => {
    const keepAlive = createAudioKeepAlive({ warmupMs: 250 })
    const done = await settled(keepAlive.acquire())

    const ctx = FakeContext.instances[0]!
    expect(ctx.sources[0]?.loop).toBe(true)
    expect(ctx.sources[0]?.start).toHaveBeenCalled()
    expect(session.type).toBe('transient')
    expect(done()).toBe(false)
    await vi.advanceTimersByTimeAsync(250)
    expect(done()).toBe(true)
  })

  it('reuses a running output without waiting again', async () => {
    const keepAlive = createAudioKeepAlive({ warmupMs: 250 })
    const first = keepAlive.acquire()
    const second = keepAlive.acquire()
    await vi.advanceTimersByTimeAsync(250)
    await Promise.all([first, second])

    const done = await settled(keepAlive.acquire())
    expect(done()).toBe(true)
    expect(FakeContext.instances[0]?.sources).toHaveLength(1)
  })

  it('fades out after the tail and gives the audio session back', async () => {
    const keepAlive = createAudioKeepAlive({ tailMs: 2000, warmupMs: 0 })
    await keepAlive.acquire()
    keepAlive.release()
    keepAlive.release()

    const ctx = FakeContext.instances[0]!
    await vi.advanceTimersByTimeAsync(1999)
    expect(ctx.sources[0]?.stop).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(ctx.sources[0]?.stop).toHaveBeenCalled()
    expect(ctx.gains[0]?.value).toBe(0)
    await vi.advanceTimersByTimeAsync(200)
    expect(ctx.suspend).toHaveBeenCalled()
    expect(session.type).toBe('auto')
  })

  it('keeps playing when speech starts again during the tail', async () => {
    const keepAlive = createAudioKeepAlive({ tailMs: 2000, warmupMs: 0 })
    await keepAlive.acquire()
    keepAlive.release()
    await vi.advanceTimersByTimeAsync(1000)
    await keepAlive.acquire()
    await vi.advanceTimersByTimeAsync(5000)
    expect(FakeContext.instances[0]?.sources[0]?.stop).not.toHaveBeenCalled()
  })

  it('releases once warmed up when released while waking up', async () => {
    const keepAlive = createAudioKeepAlive({ tailMs: 100, warmupMs: 250 })
    void keepAlive.acquire()
    keepAlive.release()
    await vi.advanceTimersByTimeAsync(250)
    await vi.advanceTimersByTimeAsync(100)
    expect(FakeContext.instances[0]?.sources[0]?.stop).toHaveBeenCalled()
  })

  it('carries on without waiting when the output cannot start', async () => {
    FakeContext.startsRunning = false
    const keepAlive = createAudioKeepAlive()
    const done = await settled(keepAlive.acquire())
    await vi.advanceTimersByTimeAsync(300)
    expect(done()).toBe(true)
    expect(FakeContext.instances[0]?.sources).toHaveLength(0)
    expect(session.type).toBe('auto')
  })

  it('does nothing without Web Audio', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const keepAlive = createAudioKeepAlive()
    await keepAlive.acquire()
    keepAlive.release()
    expect(FakeContext.instances).toHaveLength(0)
  })
})
