import { vi } from 'vitest'
import type { SpeechVoice } from '~/utils/speech'

export class FakeUtterance extends EventTarget {
  lang = ''
  rate = 1
  voice: SpeechVoice | null = null

  constructor(readonly text: string) {
    super()
  }

  finish() {
    this.dispatchEvent(new Event('end'))
  }
}

export function stubSpeech(initial: SpeechVoice[] = [voice('es-ES'), voice('en-US')]) {
  let voices = initial
  const spoken: FakeUtterance[] = []
  const synth = Object.assign(new EventTarget(), {
    getVoices: () => voices,
    speak: vi.fn((utterance: FakeUtterance) => spoken.push(utterance)),
    cancel: vi.fn(),
  })
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)

  function setVoices(next: SpeechVoice[]) {
    voices = next
    synth.dispatchEvent(new Event('voiceschanged'))
  }

  return { setVoices, spoken, synth }
}

export function voice(lang: string, over: Partial<SpeechVoice> = {}): SpeechVoice {
  return { default: false, lang, localService: true, name: `${lang} voice`, ...over }
}
