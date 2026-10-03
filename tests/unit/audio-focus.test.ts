import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAudioFocus, createNoiseWav } from '~/utils/audioFocus'

class FakeAudio {
  static instances: FakeAudio[] = []
  static allowPlay = true
  static playDelay = 0
  currentTime = 5
  loop = false
  paused = true
  preload = ''

  constructor(readonly src: string) {
    FakeAudio.instances.push(this)
  }

  play = vi.fn(() => {
    if (!FakeAudio.allowPlay) return Promise.reject(new Error('NotAllowedError'))
    this.paused = false
    return new Promise<void>((resolve) => setTimeout(resolve, FakeAudio.playDelay))
  })

  pause = vi.fn(() => {
    this.paused = true
  })
}

const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'
let session: { type: string } | undefined

function stubBrowser(userAgent = MAC, withSession = true) {
  session = withSession ? { type: 'auto' } : undefined
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints: 0, audioSession: session })
}

async function hold(focus: { acquire: () => Promise<void> }) {
  const acquired = focus.acquire()
  await vi.advanceTimersByTimeAsync(0)
  await acquired
}

async function settled(promise: Promise<void>) {
  let done = false
  void promise.then(() => (done = true))
  await vi.advanceTimersByTimeAsync(0)
  return () => done
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeAudio.instances = []
  FakeAudio.allowPlay = true
  FakeAudio.playDelay = 0
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:noise' })
  stubBrowser()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('createAudioFocus', () => {
  it('plays a short looping sound so the system lowers other audio, then waits for it to settle', async () => {
    const focus = createAudioFocus({ warmupMs: 300 })
    const done = await settled(focus.acquire())

    const audio = FakeAudio.instances[0]!
    expect(audio).toMatchObject({ src: 'blob:noise', loop: true, paused: false, currentTime: 0 })
    expect(session?.type).toBe('transient')
    expect(done()).toBe(false)
    await vi.advanceTimersByTimeAsync(300)
    expect(done()).toBe(true)
  })

  it('keeps a slow start going instead of giving up, and takes the focus once it plays', async () => {
    FakeAudio.playDelay = 1000
    const focus = createAudioFocus({ tailMs: 1500, warmupMs: 300 })
    const done = await settled(focus.acquire())
    await vi.advanceTimersByTimeAsync(600)
    expect(done()).toBe(true)

    const audio = FakeAudio.instances[0]!
    await vi.advanceTimersByTimeAsync(400)
    expect(audio.pause).not.toHaveBeenCalled()
    expect(session?.type).toBe('transient')

    focus.release()
    await vi.advanceTimersByTimeAsync(1500)
    expect(audio.paused).toBe(true)
    expect(session?.type).toBe('auto')
  })

  it('lets go of a slow start that finishes after the speech is already over', async () => {
    FakeAudio.playDelay = 1000
    const focus = createAudioFocus({ tailMs: 1500 })
    void focus.acquire()
    await vi.advanceTimersByTimeAsync(600)
    focus.release()
    await vi.advanceTimersByTimeAsync(400 + 1500)
    expect(FakeAudio.instances[0]?.paused).toBe(true)
  })

  it('prepares the sound ahead of time', () => {
    createAudioFocus().prepare()
    expect(FakeAudio.instances[0]).toMatchObject({ loop: true, preload: 'auto', paused: true })
  })

  it('reuses the playing sound without waiting again', async () => {
    const focus = createAudioFocus({ warmupMs: 300 })
    const first = focus.acquire()
    const second = focus.acquire()
    await vi.advanceTimersByTimeAsync(300)
    await Promise.all([first, second])

    const done = await settled(focus.acquire())
    expect(done()).toBe(true)
    expect(FakeAudio.instances).toHaveLength(1)
    expect(FakeAudio.instances[0]?.play).toHaveBeenCalledTimes(1)
  })

  it('gives the focus back after the tail so other audio comes back up', async () => {
    const focus = createAudioFocus({ tailMs: 1500, warmupMs: 0 })
    await hold(focus)
    focus.release()
    focus.release()

    const audio = FakeAudio.instances[0]!
    await vi.advanceTimersByTimeAsync(1499)
    expect(audio.paused).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(audio.paused).toBe(true)
    expect(session?.type).toBe('auto')
  })

  it('keeps the focus when speech starts again during the tail', async () => {
    const focus = createAudioFocus({ tailMs: 1500, warmupMs: 0 })
    await hold(focus)
    focus.release()
    await vi.advanceTimersByTimeAsync(1000)
    await hold(focus)
    await vi.advanceTimersByTimeAsync(5000)
    expect(FakeAudio.instances[0]?.paused).toBe(false)
  })

  it('releases once started when released while starting', async () => {
    const focus = createAudioFocus({ tailMs: 100, warmupMs: 300 })
    void focus.acquire()
    focus.release()
    await vi.advanceTimersByTimeAsync(300)
    await vi.advanceTimersByTimeAsync(100)
    expect(FakeAudio.instances[0]?.paused).toBe(true)
  })

  it('carries on without waiting when the browser blocks playback', async () => {
    FakeAudio.allowPlay = false
    const focus = createAudioFocus()
    const done = await settled(focus.acquire())
    expect(done()).toBe(true)
    expect(session?.type).toBe('auto')
    focus.release()
    await vi.advanceTimersByTimeAsync(5000)
    expect(FakeAudio.instances[0]?.pause).not.toHaveBeenCalled()
  })

  it('stays out of the way on iOS without the Audio Session API, where it would pause music', async () => {
    stubBrowser(IPHONE, false)
    const focus = createAudioFocus()
    await hold(focus)
    expect(FakeAudio.instances).toHaveLength(0)

    stubBrowser(IPHONE, true)
    const withSession = createAudioFocus({ warmupMs: 0 })
    await hold(withSession)
    expect(FakeAudio.instances).toHaveLength(1)
  })

  it('carries on when the sound cannot be created', async () => {
    vi.stubGlobal('URL', {
      createObjectURL: () => {
        throw new TypeError('Not a Blob')
      },
    })
    const focus = createAudioFocus()
    const done = await settled(focus.acquire())
    expect(done()).toBe(true)
    expect(session?.type).toBe('auto')
  })

  it('does nothing without media elements', async () => {
    vi.stubGlobal('Audio', undefined)
    const focus = createAudioFocus()
    await hold(focus)
    focus.release()
    expect(session?.type).toBe('auto')
  })
})

describe('createNoiseWav', () => {
  it('builds a one second, near-silent 16-bit mono WAV', () => {
    const wav = createNoiseWav(1, 2)
    const view = new DataView(wav.buffer)
    const ascii = (offset: number, length: number) => String.fromCharCode(...wav.slice(offset, offset + length))

    expect(ascii(0, 4)).toBe('RIFF')
    expect(ascii(8, 8)).toBe('WAVEfmt ')
    expect(ascii(36, 4)).toBe('data')
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(8000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(40, true)).toBe(16_000)
    expect(wav.length).toBe(44 + 16_000)
    for (let i = 44; i < wav.length; i += 2) expect(Math.abs(view.getInt16(i, true))).toBeLessThanOrEqual(2)
  })
})
