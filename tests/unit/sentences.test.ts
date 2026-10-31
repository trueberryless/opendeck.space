import { describe, expect, it } from 'vitest'
import { splitSentences } from '~/utils/sentences'

describe('splitSentences', () => {
  it('splits text into sentences and tidies their spacing', () => {
    expect(splitSentences('Hola.   ¿Cómo estás?  Muy bien, gracias.', 'es')).toEqual([
      'Hola.',
      '¿Cómo estás?',
      'Muy bien, gracias.',
    ])
  })

  it('splits Japanese and Chinese on their full stops', () => {
    expect(splitSentences('おはようございます。今日はいい天気ですね！', 'ja')).toEqual([
      'おはようございます。',
      '今日はいい天気ですね！',
    ])
    expect(splitSentences('你好。我叫安娜。', 'zh')).toEqual(['你好。', '我叫安娜。'])
  })

  it('treats every line as its own sentence and skips lines without words', () => {
    expect(splitSentences('Guten Morgen\n\n---\nWie geht es dir\r\n  \n', 'de')).toEqual([
      'Guten Morgen',
      'Wie geht es dir',
    ])
  })

  it('stops at the limit', () => {
    expect(splitSentences('One. Two. Three. Four.', 'en', 2)).toEqual(['One.', 'Two.'])
  })

  it('works without a language or with an unknown tag', () => {
    expect(splitSentences('One. Two.', undefined)).toEqual(['One.', 'Two.'])
    expect(splitSentences('One. Two.', 'not a tag!')).toEqual(['One.', 'Two.'])
  })
})
