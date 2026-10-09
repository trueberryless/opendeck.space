import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSpeechEngine, type SpeechRequest } from '~/utils/speechEngine'
import { FakeSynth, FakeUtterance, voice } from '../support/speech'

function setup(synth = new FakeSynth()) {
  const keys: (string | null)[] = []
  const onError = vi.fn()
  const engine = createSpeechEngine({
    synth: synth as unknown as SpeechSynthesis,
    createUtterance: (text) => new FakeUtterance(text) as unknown as SpeechSynthesisUtterance,
    onChange: (key) => keys.push(key),
    onError,
  })
  const speaking = () => keys.at(-1) ?? null
  return { engine, onError, speaking, synth }
}

const request = (text: string, over: Partial<SpeechRequest> = {}): SpeechRequest => ({
  key: text,
  rate: 1,
  text,
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
  it('speaks right away and goes idle when the voice ends', () => {
    const { engine, speaking, synth } = setup()

    engine.speak(request('hola', { rate: 0.7 }))
    expect(synth.spoken[0]).toMatchObject({ text: 'hola', lang: 'es-ES', rate: 0.7 })
    expect(speaking()).toBe('hola')
    synth.end()
    expect(speaking()).toBeNull()
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

  it('also waits when the voice was cancelled just before', async () => {
    const { engine, synth } = setup()
    engine.speak(request('uno'))
    engine.stop()
    engine.speak(request('dos'))
    expect(synth.spoken.map((u) => u.text)).toEqual(['uno'])
    await vi.advanceTimersByTimeAsync(120)
    expect(synth.spoken.map((u) => u.text)).toEqual(['uno', 'dos'])
  })

  it('resumes an engine that got stuck paused', () => {
    const synth = new FakeSynth()
    synth.paused = true
    const { engine } = setup(synth)
    engine.speak(request('hola'))
    expect(synth.resume).toHaveBeenCalled()
  })

  it('only speaks the last of several quick clicks', async () => {
    const { engine, speaking, synth } = setup()
    engine.speak(request('uno'))
    engine.speak(request('dos'))
    engine.speak(request('tres'))
    await vi.advanceTimersByTimeAsync(200)

    expect(synth.spoken.map((u) => u.text)).toEqual(['uno', 'tres'])
    expect(speaking()).toBe('tres')
    expect(synth.speaking).toBe(true)
  })

  it('ignores the end of the voice it replaced', async () => {
    const { engine, speaking } = setup()
    engine.speak(request('uno'))
    engine.speak(request('dos'))
    await vi.advanceTimersByTimeAsync(200)
    expect(speaking()).toBe('dos')
  })

  it('ignores a double click and stops on a later one', async () => {
    const { engine, speaking, synth } = setup()
    engine.toggle(request('hola'))
    await vi.advanceTimersByTimeAsync(100)
    engine.toggle(request('hola'))
    expect(speaking()).toBe('hola')

    await vi.advanceTimersByTimeAsync(400)
    engine.toggle(request('hola'))
    expect(speaking()).toBeNull()
    expect(synth.speaking).toBe(false)
  })

  it('reports a voice that never starts', async () => {
    const synth = new FakeSynth()
    synth.autoStart = false
    synth.speak.mockImplementation((utterance) => synth.spoken.push(utterance))
    const { engine, onError, speaking } = setup(synth)

    engine.speak(request('hola'))
    await vi.advanceTimersByTimeAsync(2500)
    expect(speaking()).toBeNull()
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ key: 'hola' }), 'failed')
  })

  it('accepts a voice that speaks without a start event', async () => {
    const synth = new FakeSynth()
    synth.autoStart = false
    const { engine, onError, speaking } = setup(synth)
    engine.speak(request('hola'))
    await vi.advanceTimersByTimeAsync(2500)
    expect(speaking()).toBe('hola')
    expect(onError).not.toHaveBeenCalled()
  })

  it('notices a voice that ended without an end event', async () => {
    const { engine, speaking, synth } = setup()
    engine.speak(request('hola'))
    synth.speaking = false
    await vi.advanceTimersByTimeAsync(250)
    expect(speaking()).toBeNull()
  })

  it('reports blocked and failed speech, but not interruptions', () => {
    const { engine, onError, synth } = setup()
    engine.speak(request('uno'))
    synth.fail('interrupted')
    expect(onError).not.toHaveBeenCalled()

    engine.speak(request('dos', { auto: true }))
    synth.fail('not-allowed')
    expect(onError).toHaveBeenLastCalledWith(expect.objectContaining({ auto: true }), 'not-allowed')

    engine.speak(request('tres'))
    synth.fail('synthesis-failed')
    expect(onError).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'tres' }), 'failed')
  })

  it('stops speaking', () => {
    const { engine, speaking, synth } = setup()
    engine.stop()
    expect(synth.cancel).not.toHaveBeenCalled()

    engine.speak(request('hola'))
    engine.stop()
    expect(speaking()).toBeNull()
    expect(synth.speaking).toBe(false)
  })

  it('drops a request that was stopped while the previous voice settled', async () => {
    const synth = new FakeSynth()
    synth.speaking = true
    const { engine } = setup(synth)
    engine.speak(request('hola'))
    engine.stop()
    await vi.advanceTimersByTimeAsync(200)
    expect(synth.speak).not.toHaveBeenCalled()
  })
})
