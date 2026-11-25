import { describe, expect, it } from 'vitest'
import {
  comparesCharacters,
  diffTokens,
  expectedForms,
  normalizeSpeech,
  scoreSpeech,
  similarity,
  speechTokens,
} from '~/utils/speechScore'

describe('normalizeSpeech', () => {
  it('ignores case, punctuation and extra whitespace', () => {
    expect(normalizeSpeech('  ¿Cómo  estás, Ana?  ', 'es')).toBe('cómo estás ana')
    expect(normalizeSpeech('Guten Morgen!', 'de-DE')).toBe('guten morgen')
  })

  it('folds full-width characters and lowercases with the rules of the language', () => {
    expect(normalizeSpeech('ＡＢＣ　１２３', 'en')).toBe('abc 123')
    expect(normalizeSpeech('İSTANBUL', 'tr')).toBe('istanbul')
  })

  it('compares Japanese and Chinese by character and folds katakana into hiragana', () => {
    expect(normalizeSpeech('コーヒー を ください。', 'ja')).toBe('こーひーをください')
    expect(normalizeSpeech('你好，世界！', 'zh-CN')).toBe('你好世界')
    expect(comparesCharacters('ja-JP')).toBe(true)
    expect(comparesCharacters('es')).toBe(false)
    expect(comparesCharacters(undefined)).toBe(false)
  })

  it('falls back to plain lowercasing for tags it cannot read', () => {
    expect(normalizeSpeech('HELLO', 'not a tag!')).toBe('hello')
  })
})

describe('speechTokens', () => {
  it('splits words, or characters for languages without spaces', () => {
    expect(speechTokens('Buenos días.', 'es')).toEqual(['buenos', 'días'])
    expect(speechTokens('ありがとう', 'ja')).toEqual(['あ', 'り', 'が', 'と', 'う'])
    expect(speechTokens('。', 'ja')).toEqual([])
  })

  it('keeps combining marks with their letter', () => {
    expect(speechTokens('สวัสดี', 'th')).toEqual(['ส', 'วั', 'ส', 'ดี'])
  })
})

describe('diffTokens', () => {
  it('marks matching, changed, missing and extra words', () => {
    expect(diffTokens(['i', 'would', 'like', 'a', 'coffee'], ['i', 'like', 'the', 'coffee', 'please'])).toEqual([
      { kind: 'same', expected: 'i', heard: 'i' },
      { kind: 'missing', expected: 'would' },
      { kind: 'same', expected: 'like', heard: 'like' },
      { kind: 'changed', expected: 'a', heard: 'the' },
      { kind: 'same', expected: 'coffee', heard: 'coffee' },
      { kind: 'extra', heard: 'please' },
    ])
  })

  it('handles empty sides', () => {
    expect(diffTokens([], [])).toEqual([])
    expect(diffTokens(['hola'], [])).toEqual([{ kind: 'missing', expected: 'hola' }])
    expect(diffTokens([], ['hola'])).toEqual([{ kind: 'extra', heard: 'hola' }])
  })
})

describe('similarity', () => {
  it('scores by characters so a near miss on one word still counts', () => {
    expect(similarity('hola', 'Hola.', 'es')).toBe(1)
    expect(similarity('hola', 'ola', 'es')).toBe(0.75)
    expect(similarity('ice cream', 'icecream', 'en')).toBe(1)
    expect(similarity('', '', 'en')).toBe(0)
    expect(similarity('gracias', '', 'es')).toBe(0)
  })
})

describe('expectedForms', () => {
  it('offers the text, its readings and each alternative of a slash', () => {
    expect(expectedForms('Estoy enfermo / enferma', [undefined, ' '])).toEqual([
      'Estoy enfermo / enferma',
      'Estoy enfermo',
      'Estoy enferma',
    ])
    expect(expectedForms('der Arzt / die Ärztin')).toEqual(['der Arzt / die Ärztin', 'der Arzt', 'die Ärztin'])
    expect(expectedForms('犬', ['いぬ', 'いぬ'])).toEqual(['犬', 'いぬ'])
  })
})

describe('scoreSpeech', () => {
  it('gives a full score for a perfect answer and lists every word as matching', () => {
    const result = scoreSpeech('¿Dónde está la estación?', 'Dónde está la estación', 'es')
    expect(result.score).toBe(100)
    expect(result.parts.every((p) => p.kind === 'same')).toBe(true)
  })

  it('scores partial answers and shows what was missed', () => {
    const result = scoreSpeech('Where is the station?', 'where is station', 'en')
    expect(result.score).toBe(92)
    expect(result.parts).toContainEqual({ kind: 'missing', expected: 'the' })
  })

  it('matches Japanese written with kanji against the card text', () => {
    const result = scoreSpeech('お元気ですか？', 'お元気ですか', 'ja', ['おげんきですか'])
    expect(result).toMatchObject({ expected: 'お元気ですか？', score: 100 })
  })

  it('uses the kana reading when the transcript comes back in kana', () => {
    const result = scoreSpeech('元気です', 'げんきです', 'ja', ['げんきです'])
    expect(result).toMatchObject({ expected: 'げんきです', score: 100 })
    expect(scoreSpeech('元気です', 'げんきです', 'ja').score).toBeLessThan(50)
  })

  it('treats katakana in the transcript like the hiragana reading', () => {
    expect(scoreSpeech('珈琲', 'コーヒー', 'ja', ['こーひー']).score).toBe(100)
  })

  it('compares Chinese character by character', () => {
    const result = scoreSpeech('我想喝咖啡', '我想喝茶', 'zh')
    expect(result.score).toBe(67)
    expect(result.parts.map((p) => p.kind)).toEqual(['same', 'same', 'same', 'missing', 'changed'])
  })

  it('accepts こんにちわ and romaji for こんにちは, as the particle is said wa', () => {
    expect(scoreSpeech('こんにちは', 'こんにちわ', 'ja')).toMatchObject({ score: 100 })
    expect(scoreSpeech('こんにちは', 'Konnichiwa.', 'ja').score).toBe(100)
    expect(scoreSpeech('今日は', 'こんにちは', 'ja', ['konnichiwa']).score).toBe(100)
    expect(scoreSpeech('お早うございます', 'おはようございます', 'ja', ['ohayō gozaimasu']).score).toBe(100)
    expect(scoreSpeech('こんにちは', 'こんにちわ', 'ja').parts.every((p) => p.kind === 'same')).toBe(true)
  })

  it('forgives a near miss on a longer word but not a different short word', () => {
    const result = scoreSpeech('Ja, gerne!', 'ja gern', 'de')
    expect(result.score).toBe(95)
    expect(result.parts.map((p) => p.kind)).toEqual(['same', 'same'])
    expect(scoreSpeech('they are here', 'then are here', 'en').parts[0]?.kind).toBe('changed')
  })

  it('picks the closer alternative of a slash', () => {
    expect(scoreSpeech('Estoy enfermo / enferma', 'estoy enferma', 'es')).toMatchObject({
      expected: 'Estoy enferma',
      score: 100,
    })
    expect(scoreSpeech('Estoy enfermo / enferma', 'estoy enfermo', 'es')).toMatchObject({
      expected: 'Estoy enfermo',
      score: 100,
    })
  })

  it('scores nothing heard as zero', () => {
    expect(scoreSpeech('gracias', '', 'es')).toEqual({
      expected: 'gracias',
      score: 0,
      parts: [{ kind: 'missing', expected: 'gracias' }],
    })
  })
})
