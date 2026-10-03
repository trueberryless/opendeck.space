import { describe, expect, it } from 'vitest'
import {
  findVoice,
  languageName,
  prepareSpeechText,
  rankVoices,
  shouldAutoSpeak,
  speechLanguage,
  speechRateValue,
  speechTimeout,
  uniqueSpeechLanguages,
} from '~/utils/speech'
import { voice } from '../support/speech'

const names = (voices: { name: string }[]) => voices.map((v) => v.name)

describe('rankVoices', () => {
  it('puts the natural voices of macOS ahead of the robotic Eloquence and novelty ones', () => {
    const voices = [
      voice('de-DE', { name: 'Eddy (German (Germany))' }),
      voice('de-DE', { name: 'Grandma (German (Germany))' }),
      voice('de-DE', { name: 'Anna' }),
      voice('ja-JP', { name: 'Rocko (Japanese (Japan))' }),
      voice('ja-JP', { name: 'Kyoko' }),
      voice('en-US', { name: 'Zarvox' }),
      voice('en-US', { name: 'Samantha' }),
    ]
    expect(rankVoices(voices, 'de')[0]?.name).toBe('Anna')
    expect(rankVoices(voices, 'ja')[0]?.name).toBe('Kyoko')
    expect(rankVoices(voices, 'en')[0]?.name).toBe('Samantha')
  })

  it('prefers premium and natural voices, then on-device ones, then the default', () => {
    const voices = [
      voice('de-DE', { name: 'Google Deutsch', localService: false }),
      voice('de-DE', { name: 'Anna' }),
      voice('de-DE', { name: 'Anna (Premium)' }),
      voice('de-DE', { name: 'Microsoft Katja Online (Natural) - German (Germany)', localService: false }),
    ]
    expect(names(rankVoices(voices, 'de-DE'))).toEqual([
      'Anna (Premium)',
      'Microsoft Katja Online (Natural) - German (Germany)',
      'Anna',
      'Google Deutsch',
    ])
    expect(
      names(rankVoices([voice('fr-FR', { name: 'A' }), voice('fr-FR', { name: 'B', default: true })], 'fr')),
    ).toEqual(['B', 'A'])
  })

  it('prefers the region of the tag, or the main region of the language', () => {
    const voices = [voice('pt-PT', { name: 'Joana' }), voice('pt-BR', { name: 'Luciana' })]
    expect(rankVoices(voices, 'pt-PT')[0]?.name).toBe('Joana')
    expect(rankVoices(voices, 'pt')[0]?.name).toBe('Luciana')
    expect(rankVoices([voice('de-CH'), voice('de-DE')], 'de')[0]?.lang).toBe('de-DE')
    expect(rankVoices([voice('zh-CN'), voice('zh-TW')], 'zh-Hant')[0]?.lang).toBe('zh-TW')
  })

  it('matches Android-style tags, case and old language codes', () => {
    expect(rankVoices([voice('de_DE')], 'de-de')).toHaveLength(1)
    expect(rankVoices([voice('nb-NO')], 'no')).toHaveLength(1)
    expect(rankVoices([voice('iw-IL')], 'he')).toHaveLength(1)
    expect(rankVoices([voice('fil-PH')], 'tl')).toHaveLength(1)
  })

  it('only uses on-device voices while offline', () => {
    const online = voice('ja-JP', { localService: false })
    expect(rankVoices([online], 'ja', { offline: false })).toEqual([online])
    expect(rankVoices([online], 'ja', { offline: true })).toEqual([])
  })

  it('finds nothing without a language or a matching voice', () => {
    expect(rankVoices([voice('en-US')], undefined)).toEqual([])
    expect(rankVoices([voice('en-US')], '  ')).toEqual([])
    expect(rankVoices([voice('en-US')], 'ko')).toEqual([])
    expect(rankVoices([voice('en-US'), voice('not a tag!')], '???')).toEqual([])
  })
})

describe('findVoice', () => {
  const voices = [voice('de-DE', { name: 'Anna' }), voice('de-DE', { name: 'Helena' })]

  it('uses the voice chosen on this device, or the best one', () => {
    expect(findVoice(voices, 'de')?.name).toBe('Anna')
    expect(findVoice(voices, 'de', { preferred: 'Helena' })?.name).toBe('Helena')
    expect(findVoice(voices, 'de', { preferred: 'Gone' })?.name).toBe('Anna')
  })
})

describe('prepareSpeechText', () => {
  it('ends the text like a sentence so voices finish naturally', () => {
    expect(prepareSpeechText('der Hund', 'de')).toBe('der Hund.')
    expect(prepareSpeechText('犬', 'ja-JP')).toBe('犬。')
    expect(prepareSpeechText('狗', 'zh')).toBe('狗。')
    expect(prepareSpeechText('¿Qué tal?', 'es')).toBe('¿Qué tal?')
    expect(prepareSpeechText('Hallo!', 'de')).toBe('Hallo!')
  })

  it('reads alternatives as a list and tidies whitespace', () => {
    expect(prepareSpeechText(' Estoy  enfermo / enferma ', 'es')).toBe('Estoy enfermo, enferma.')
    expect(prepareSpeechText('and/or', 'en')).toBe('and/or.')
    expect(prepareSpeechText('   ', 'en')).toBe('')
  })
})

describe('languageName', () => {
  it('names a language in itself or in the interface language', () => {
    expect(languageName('de')).toBe('Deutsch')
    expect(languageName('ja', 'en')).toBe('Japanese')
    expect(languageName('not a tag!')).toBe('not a tag!')
  })
})

describe('uniqueSpeechLanguages', () => {
  it('keeps the first tag of each language', () => {
    expect(uniqueSpeechLanguages(['de-DE', undefined, 'ja', 'de', 'en', 'nb'])).toEqual(['de-DE', 'ja', 'en', 'nb'])
    expect(speechLanguage('nb')).toBe('no')
  })
})

describe('speechTimeout', () => {
  it('grows with the text, slows with the rate and has a ceiling', () => {
    expect(speechTimeout('hola', 1)).toBeLessThan(speechTimeout('hola', 0.7))
    expect(speechTimeout('hola', 1)).toBeLessThan(speechTimeout('hola amigo', 1))
    expect(speechTimeout('x'.repeat(10_000), 1)).toBe(120_000)
  })
})

describe('shouldAutoSpeak', () => {
  it('speaks the sides the mode asks for', () => {
    expect(shouldAutoSpeak('off', 'prompt')).toBe(false)
    expect(shouldAutoSpeak('prompt', 'prompt')).toBe(true)
    expect(shouldAutoSpeak('prompt', 'answer')).toBe(false)
    expect(shouldAutoSpeak('answer', 'answer')).toBe(true)
    expect(shouldAutoSpeak('both', 'prompt')).toBe(true)
    expect(shouldAutoSpeak('both', 'answer')).toBe(true)
    expect(shouldAutoSpeak('unknown', 'answer')).toBe(false)
  })
})

describe('speechRateValue', () => {
  it('maps a rate to the utterance rate and falls back to normal', () => {
    expect(speechRateValue('normal')).toBe(1)
    expect(speechRateValue('slow')).toBeLessThan(1)
    expect(speechRateValue('turbo')).toBe(1)
    expect(speechRateValue('toString')).toBe(1)
  })
})
