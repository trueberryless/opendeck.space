export const AUTO_SPEAK_MODES = ['off', 'prompt', 'answer', 'both'] as const
export const SPEECH_RATES = { normal: 1, slow: 0.7 } as const

const LANGUAGE_ALIASES: Record<string, string> = { fil: 'tl', in: 'id', iw: 'he', ji: 'yi', nb: 'no' }
const LOW_QUALITY_VOICE_RE =
  /^(?:(?:Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley) \(|(?:Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Fred|Good News|Jester|Junior|Kathy|Organ|Ralph|Superstar|Trinoids|Whisper|Wobble|Zarvox)$)/
const HIGH_QUALITY_VOICE_RE = /premium|enhanced|natural|neural|wavenet|studio/i
const SLASH_RE = /\s+\/\s+/g
const WHITESPACE_RE = /\s+/g
const TERMINAL_RE = /[\p{P}\p{S}]$/u
const ANDROID_RE = /android/i
const IOS_RE = /iphone|ipad|ipod/i
const MAC_RE = /macintosh|mac os x/i
const WINDOWS_RE = /windows/i
const FIREFOX_RE = /firefox\//i
const FULL_STOP: Record<string, string> = { ja: '。', yue: '。', zh: '。' }

export type SpeechPlatform = 'android' | 'ios' | 'macos' | 'windows' | 'other'
export type AutoSpeakMode = (typeof AUTO_SPEAK_MODES)[number]
export type SpeechRate = keyof typeof SPEECH_RATES
export type CardSide = 'prompt' | 'answer'

export interface SpeechVoice {
  default: boolean
  lang: string
  localService: boolean
  name: string
  voiceURI: string
}

export function rankVoices<T extends SpeechVoice>(
  voices: readonly T[],
  lang: string | undefined,
  options?: VoiceOptions,
): T[] {
  const wanted = parseLang(lang)
  if (!wanted) return []

  return voices
    .filter((v) => !options?.offline || v.localService)
    .map((voice) => ({ voice, tag: parseLang(voice.lang) }))
    .filter(({ tag }) => tag?.language === wanted.language)
    .map(({ voice, tag }) => ({ voice, score: scoreVoice(voice, tag!.region === wanted.region) }))
    .sort((a, b) => b.score - a.score)
    .map(({ voice }) => voice)
}

export function findVoice<T extends SpeechVoice>(
  voices: readonly T[],
  lang: string | undefined,
  options?: VoiceOptions,
): T | undefined {
  const ranked = rankVoices(voices, lang, options)
  return ranked.find((v) => v.voiceURI === options?.preferred) ?? ranked[0]
}

export function speechLanguage(lang: string | undefined): string | undefined {
  return parseLang(lang)?.language
}

export function prepareSpeechText(text: string, lang: string | undefined): string {
  const clean = text.replace(SLASH_RE, ', ').replace(WHITESPACE_RE, ' ').trim()
  if (!clean || TERMINAL_RE.test(clean)) return clean

  return `${clean}${FULL_STOP[speechLanguage(lang) ?? ''] ?? '.'}`
}

export function languageName(lang: string, displayLocale: string = lang): string {
  try {
    return new Intl.DisplayNames([displayLocale], { type: 'language' }).of(lang) ?? lang
  } catch {
    return lang
  }
}

export function uniqueSpeechLanguages(langs: readonly (string | undefined)[]): string[] {
  const byLanguage = new Map<string, string>()
  for (const lang of langs) {
    const language = speechLanguage(lang)
    if (lang && language && !byLanguage.has(language)) byLanguage.set(language, lang)
  }
  return [...byLanguage.values()]
}

export function speechTimeout(text: string, rate: number): number {
  return Math.min(120_000, 4000 + (text.length * 150) / rate)
}

export function detectSpeechPlatform(userAgent: string, maxTouchPoints = 0): SpeechPlatform {
  if (ANDROID_RE.test(userAgent)) return 'android'
  if (IOS_RE.test(userAgent) || (MAC_RE.test(userAgent) && maxTouchPoints > 1)) return 'ios'
  if (MAC_RE.test(userAgent)) return 'macos'
  if (WINDOWS_RE.test(userAgent)) return 'windows'
  return 'other'
}

export function isFirefox(userAgent: string): boolean {
  return FIREFOX_RE.test(userAgent)
}

export function isNaturalVoice(voice: SpeechVoice): boolean {
  return HIGH_QUALITY_VOICE_RE.test(voice.name)
}

export function shouldAutoSpeak(mode: string, side: CardSide): boolean {
  return mode === 'both' || mode === side
}

export function speechRateValue(rate: string): number {
  return Object.hasOwn(SPEECH_RATES, rate) ? SPEECH_RATES[rate as SpeechRate] : SPEECH_RATES.normal
}

function parseLang(lang: string | undefined): { language: string; region?: string } | undefined {
  const tag = lang?.trim().replaceAll('_', '-')
  if (!tag) return undefined

  try {
    const locale = new Intl.Locale(tag)
    const language = LANGUAGE_ALIASES[locale.language] ?? locale.language
    return { language, region: locale.maximize().region }
  } catch {
    const [language = '', region] = tag.toLowerCase().split('-')
    return { language: LANGUAGE_ALIASES[language] ?? language, region: region?.toUpperCase() }
  }
}

function scoreVoice(voice: SpeechVoice, sameRegion: boolean): number {
  let score = 0
  if (sameRegion) score += 4
  if (LOW_QUALITY_VOICE_RE.test(voice.name)) score -= 20
  if (HIGH_QUALITY_VOICE_RE.test(voice.name)) score += 3
  if (voice.localService) score += 2
  if (voice.default) score += 1
  return score
}

interface VoiceOptions {
  offline?: boolean
  preferred?: string
}
