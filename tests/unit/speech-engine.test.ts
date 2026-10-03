import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSpeechEngine, type SpeechRequest, type SpeechState } from '~/utils/speechEngine'
import { FakeSynth, FakeUtterance, voice } from '../support/speech'

function setup(synth = new FakeSynth()) {
  const states: (SpeechState | null)[] = []
  const keepAlive = { acquire: vi.fn(() => Promise.resolve()), release: vi.fn() }
  const onError = vi.fn()
  const engine = createSpeechEngine({
    synth: synth as unknown as SpeechSynthesis,
    keepAlive,
    createUtterance: (text) => new FakeUtterance(text) as unknown as SpeechSynthesisUtterance,
    onChange: (state) => states.push(state),
    onError,
  })
  const state = () => states.at(-1) ?? null
  return { engine, keepAlive, onError, state, synth }
}

const request = (text: string, over: Partial<SpeechRequest> = {}): SpeechRequest => ({
  key: text,
  rate: 1,
  text: `${text}.`,
  voice: voice('es-ES') as unknown as SpeechSynthesisVoice,
  ...over,
})

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createSpeechEngine', () => {
  it('wakes the audio output, speaks and goes idle when the voice ends', async () => {
    const { engine, keepAlive, state, synth } = setup()

    engine.speak(request('hola', { rate: 0.7 }))
    expect(state()).toEqual({ key: 'hola', status: 'pending' })
    expect(keepAlive.acquire).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(0)

    expect(synth.spoken[0]).toMatchObject({ text: 'hola.', lang: 'es-ES', rate: 0.7 })
    expect(state()).toEqual({ key: 'hola', status: 'speaking' })
    synth.end()
    expect(state()).toBeNull()
    expect(keepAlive.release).toHaveBeenCalledTimes(1)
  })

  it('lets a cancelled voice settle before speaking, which Chrome needs', async () => {
    const synth = new FakeSynth()
    synth.speaking = true
    const { engine } = setup(synth)

    engine.speak(request('hola'))
    expect(synth.cancel).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    expect(synth.speak).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(50)
    expect(synth.speak).toHaveBeenCalledTimes(1)
  })

  it('resumes an engine that got stuck paused', async () => {
    const synth = new FakeSynth()
    synth.paused = true
    const { engine } = setup(synth)
    engine.speak(request('hola'))
    await vi.advanceTimersByTimeAsync(0)
    expect(synth.resume).toHaveBeenCalled()
  })

  it('only speaks the latest of several quick requests', async () => {
    const { engine, state, synth } = setup()
    engine.speak(request('uno'))
    engine.speak(request('dos'))
    engine.speak(request('tres'))
    await vi.advanceTimersByTimeAsync(0)

    expect(synth.spoken.map((u) => u.text)).toEqual(['tres.'])
    expect(state()).toEqual({ key: 'tres', status: 'speaking' })
  })

  it('switches to another text and ignores the end of the one it replaced', async () => {
    const { engine, state, synth } = setup()
    engine.speak(request('uno'))
    await vi.advanceTimersByTimeAsync(0)
    engine.speak(request('dos'))
    await vi.advanceTimersByTimeAsync(200)

    expect(synth.spoken.map((u) => u.text)).toEqual(['uno.', 'dos.'])
    expect(state()).toEqual({ key: 'dos', status: 'speaking' })
  })

  it('ignores a double click and stops on a later one', async () => {
    const { engine, state, synth } = setup()
    engine.toggle(request('hola'))
    await vi.advanceTimersByTimeAsync(100)
    engine.toggle(request('hola'))
    expect(state()?.status).toBe('speaking')

    await vi.advanceTimersByTimeAsync(400)
    engine.toggle(request('hola'))
    expect(state()).toBeNull()
    expect(synth.speaking).toBe(false)
  })

  it('retries once when the voice never starts, then reports the failure', async () => {
    const synth = new FakeSynth()
    synth.autoStart = false
    const { engine, onError, state } = setup(synth)
    synth.speak.mockImplementation((utterance) => synth.spoken.push(utterance))

    engine.speak(request('hola'))
    await vi.advanceTimersByTimeAsync(2500)
    expect(state()?.status).toBe('pending')
    await vi.advanceTimersByTimeAsync(200)
    expect(synth.spoken).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(2500)

    expect(state()).toBeNull()
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ key: 'hola' }), 'failed')
  })

  it('treats a voice that speaks without a start event as speaking', async () => {
    const synth = new FakeSynth()
    synth.autoStart = false
    const { engine, state } = setup(synth)
    engine.speak(request('hola'))
    await vi.advanceTimersByTimeAsync(2500)
    expect(state()?.status).toBe('speaking')
  })

  it('notices a voice that ended without an end event', async () => {
    const { engine, state, synth } = setup()
    engine.speak(request('hola'))
    await vi.advanceTimersByTimeAsync(0)
    synth.speaking = false
    await vi.advanceTimersByTimeAsync(250)
    expect(state()).toBeNull()
  })

  it('gives up on a voice that never ends', async () => {
    const { engine, state, synth } = setup()
    engine.speak(request('hola'))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(state()).toBeNull()
    expect(synth.cancel).toHaveBeenCalled()
  })

  it('reports blocked and failed speech, but not interruptions', async () => {
    const { engine, onError, synth } = setup()
    engine.speak(request('uno'))
    await vi.advanceTimersByTimeAsync(0)
    synth.fail('interrupted')
    expect(onError).not.toHaveBeenCalled()

    engine.speak(request('dos', { auto: true }))
    await vi.advanceTimersByTimeAsync(0)
    synth.fail('not-allowed')
    expect(onError).toHaveBeenLastCalledWith(expect.objectContaining({ auto: true }), 'not-allowed')

    engine.speak(request('tres'))
    await vi.advanceTimersByTimeAsync(0)
    synth.fail('synthesis-failed')
    expect(onError).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'tres' }), 'failed')
  })

  it('stops speaking and releases the audio output', async () => {
    const { engine, keepAlive, state, synth } = setup()
    engine.stop()
    expect(synth.cancel).not.toHaveBeenCalled()

    engine.speak(request('hola'))
    await vi.advanceTimersByTimeAsync(0)
    engine.stop()
    expect(state()).toBeNull()
    expect(synth.speaking).toBe(false)
    expect(keepAlive.release).toHaveBeenCalledTimes(1)
  })

  it('drops a request that was stopped while the output was waking up', async () => {
    const { engine, synth } = setup()
    engine.speak(request('hola'))
    engine.stop()
    await vi.advanceTimersByTimeAsync(0)
    expect(synth.speak).not.toHaveBeenCalled()
  })
})
