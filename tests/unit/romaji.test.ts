import { describe, expect, it } from 'vitest'
import { romajiToHiragana } from '~/utils/romaji'

describe('romajiToHiragana', () => {
  it('converts Hepburn romaji with long vowels, double consonants and n', () => {
    expect(romajiToHiragana('konnichiwa')).toBe('こんにちわ')
    expect(romajiToHiragana('ohayō gozaimasu')).toBe('おはよう ございます')
    expect(romajiToHiragana('kitte')).toBe('きって')
    expect(romajiToHiragana('matcha')).toBe('まっちゃ')
    expect(romajiToHiragana('shinbun')).toBe('しんぶん')
    expect(romajiToHiragana('onna')).toBe('おんな')
    expect(romajiToHiragana("kon'ya")).toBe('こんや')
    expect(romajiToHiragana('kyō wa tōkyō')).toBe('きょう わ とうきょう')
  })

  it('leaves kana and kanji alone', () => {
    expect(romajiToHiragana('東京 です')).toBe('東京 です')
  })
})
