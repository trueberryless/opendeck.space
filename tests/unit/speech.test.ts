import { describe, expect, it } from 'vitest'
import { findVoice, shouldAutoSpeak, speechRateValue, type SpeechVoice } from '~/utils/speech'

const voice = (lang: string, over: Partial<SpeechVoice> = {}): SpeechVoice => ({
  default: false,
  lang,
  localService: true,
  name: `${lang} voice`,
  ...over,
})

describe('findVoice', () => {
  it('prefers an exact match over another region of the same language', () => {
    const voices = [voice('pt-PT'), voice('pt-BR')]
    expect(findVoice(voices, 'pt-BR')?.lang).toBe('pt-BR')
  })

  it('falls back to any region of the same language', () => {
    expect(findVoice([voice('en-US'), voice('es-ES')], 'es')?.lang).toBe('es-ES')
    expect(findVoice([voice('es-MX')], 'es-AR')?.lang).toBe('es-MX')
  })

  it('matches tags regardless of case and Android-style underscores', () => {
    expect(findVoice([voice('de_DE')], 'de-de')?.lang).toBe('de_DE')
    expect(findVoice([voice('ZH-cn')], 'zh-CN')?.lang).toBe('ZH-cn')
  })

  it('prefers the default voice, then an on-device one', () => {
    const online = voice('fr-FR', { localService: false, name: 'Google français' })
    const local = voice('fr-FR', { name: 'Thomas' })
    const preferred = voice('fr-FR', { default: true, localService: false, name: 'Amélie' })
    expect(findVoice([online, local], 'fr')?.name).toBe('Thomas')
    expect(findVoice([online, local, preferred], 'fr')?.name).toBe('Amélie')
  })

  it('only uses on-device voices while offline', () => {
    const online = voice('ja-JP', { localService: false })
    expect(findVoice([online], 'ja', { offline: false })).toBe(online)
    expect(findVoice([online], 'ja', { offline: true })).toBeUndefined()
  })

  it('finds nothing without a language or a matching voice', () => {
    expect(findVoice([voice('en-US')], undefined)).toBeUndefined()
    expect(findVoice([voice('en-US')], '  ')).toBeUndefined()
    expect(findVoice([voice('en-US')], 'ko')).toBeUndefined()
    expect(findVoice([], 'en')).toBeUndefined()
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
