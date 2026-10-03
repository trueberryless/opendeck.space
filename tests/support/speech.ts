import { vi } from 'vitest'
import type { SpeechVoice } from '~/utils/speech'

export class FakeUtterance extends EventTarget {
  lang = ''
  rate = 1
  voice: SpeechVoice | null = null

  constructor(readonly text: string) {
    super()
  }
}

export class FakeSynth extends EventTarget {
  autoStart = true
  current: FakeUtterance | undefined
  paused = false
  pending = false
  speaking = false
  readonly spoken: FakeUtterance[] = []
  voices: SpeechVoice[]

  constructor(voices: SpeechVoice[] = [voice('es-ES'), voice('en-US')]) {
    super()
    this.voices = voices
  }

  getVoices = () => this.voices

  speak = vi.fn((utterance: FakeUtterance) => {
    this.spoken.push(utterance)
    this.current = utterance
    this.speaking = true
    if (this.autoStart) utterance.dispatchEvent(new Event('start'))
  })

  cancel = vi.fn(() => {
    const utterance = this.current
    this.current = undefined
    this.speaking = false
    if (utterance) this.fail('canceled', utterance)
  })

  resume = vi.fn(() => {
    this.paused = false
  })

  start() {
    this.current?.dispatchEvent(new Event('start'))
  }

  end() {
    const utterance = this.current
    this.current = undefined
    this.speaking = false
    utterance?.dispatchEvent(new Event('end'))
  }

  fail(error: string, utterance = this.current) {
    if (utterance === this.current) {
      this.current = undefined
      this.speaking = false
    }
    utterance?.dispatchEvent(Object.assign(new Event('error'), { error }))
  }

  setVoices(voices: SpeechVoice[]) {
    this.voices = voices
    this.dispatchEvent(new Event('voiceschanged'))
  }
}

export function stubSpeech(voices?: SpeechVoice[]): FakeSynth {
  const synth = new FakeSynth(voices)
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  return synth
}

export function voice(lang: string, over: Partial<SpeechVoice> = {}): SpeechVoice {
  const name = over.name ?? `${lang} voice`
  return { default: false, lang, localService: true, name, voiceURI: name, ...over }
}
