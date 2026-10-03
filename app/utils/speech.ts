export const AUTO_SPEAK_MODES = ['off', 'prompt', 'answer', 'both'] as const
export const SPEECH_RATES = { normal: 1, slow: 0.7 } as const

export type AutoSpeakMode = (typeof AUTO_SPEAK_MODES)[number]
export type SpeechRate = keyof typeof SPEECH_RATES
export type CardSide = 'prompt' | 'answer'

export interface SpeechVoice {
  default: boolean
  lang: string
  localService: boolean
  name: string
}

export function findVoice<T extends SpeechVoice>(
  voices: readonly T[],
  lang: string | undefined,
  options?: FindVoiceOptions,
): T | undefined {
  const wanted = normalizeLang(lang)
  if (!wanted) return undefined

  const usable = options?.offline ? voices.filter((v) => v.localService) : voices
  const base = wanted.split('-')[0]
  const exact = usable.filter((v) => normalizeLang(v.lang) === wanted)
  const sameLanguage = usable.filter((v) => normalizeLang(v.lang)?.split('-')[0] === base)

  return pickPreferred(exact) ?? pickPreferred(sameLanguage)
}

export function shouldAutoSpeak(mode: string, side: CardSide): boolean {
  return mode === 'both' || mode === side
}

export function speechRateValue(rate: string): number {
  return Object.hasOwn(SPEECH_RATES, rate) ? SPEECH_RATES[rate as SpeechRate] : SPEECH_RATES.normal
}

function normalizeLang(lang: string | undefined): string | undefined {
  const value = lang?.trim().replaceAll('_', '-').toLowerCase()
  return value || undefined
}

function pickPreferred<T extends SpeechVoice>(voices: T[]): T | undefined {
  return voices.find((v) => v.default) ?? voices.find((v) => v.localService) ?? voices[0]
}

interface FindVoiceOptions {
  offline?: boolean
}
