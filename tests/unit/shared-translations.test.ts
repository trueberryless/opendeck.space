import { describe, expect, it } from 'vitest'
import {
  englishLanguageName,
  filePath,
  formatReview,
  isUiPart,
  issueUrl,
  parseReview,
  parseVerificationPath,
  pendingKeys,
  placeholders,
  pluralFormCount,
  reviewableStrings,
  reviewUrl,
  samePlaceholders,
  sourceText,
  stringFingerprint,
  translatableStrings,
  uiPart,
  verificationPath,
} from '~~/shared/translations'

describe('uiPart / isUiPart', () => {
  it('maps a key to the review part of its group', () => {
    expect(uiPart('deck.title')).toBe('decks')
    expect(uiPart('legal.x')).toBeUndefined()
    expect(uiPart('privacy.intro')).toBe('legal')
  })

  it('recognises part ids', () => {
    expect(isUiPart('basics')).toBe(true)
    expect(isUiPart('nope')).toBe(false)
  })
})

describe('paths', () => {
  it('builds verification and file paths for ui and packs', () => {
    expect(verificationPath('ui', 'de')).toBe('app/data/verifications/ui/de.json')
    expect(verificationPath('garden', 'de')).toBe('app/data/verifications/packs/garden/de.json')
    expect(filePath('ui', 'de')).toBe('i18n/de.json')
    expect(filePath('garden', 'de')).toBe('app/data/starter-packs/garden/de.json')
  })

  it('parses verification paths back', () => {
    expect(parseVerificationPath('app/data/verifications/ui/de.json')).toEqual({ scope: 'ui', language: 'de' })
    expect(parseVerificationPath('app/data/verifications/packs/garden/de.json')).toEqual({
      scope: 'garden',
      language: 'de',
    })
    expect(parseVerificationPath('README.md')).toBeUndefined()
  })
})

describe('urls', () => {
  it('builds review urls with optional query', () => {
    expect(reviewUrl()).toBe('https://opendeck.space/translations/review')
    expect(reviewUrl('de', 'ui')).toBe('https://opendeck.space/translations/review?lang=de&file=ui')
  })

  it('builds issue urls, skipping empty fields and encoding values', () => {
    expect(issueUrl('t.yaml', { a: 'x y', b: undefined })).toBe(
      'https://github.com/trueberryless/opendeck.space/issues/new?template=t.yaml&a=x%20y',
    )
  })
})

describe('englishLanguageName', () => {
  it('falls back from locales to names to the code', () => {
    const locales = [{ code: 'de', englishName: 'German' }]
    expect(englishLanguageName('de', locales, {})).toBe('German')
    expect(englishLanguageName('xx', locales, { xx: 'Xish' })).toBe('Xish')
    expect(englishLanguageName('yy', locales, {})).toBe('yy')
  })
})

describe('translatableStrings', () => {
  it('flattens ui files to dotted keys', () => {
    expect([...translatableStrings('ui', { a: { b: 'x' }, c: 'y', n: 3 })]).toEqual([
      ['a.b', 'x'],
      ['c', 'y'],
    ])
  })

  it('reads only entries for packs', () => {
    expect([...translatableStrings('garden', { title: 'no', entries: { rose: { text: 'Rose' } } })]).toEqual([
      ['entries.rose.text', 'Rose'],
    ])
    expect(translatableStrings('garden', {}).size).toBe(0)
  })
})

describe('sourceText / reviewableStrings', () => {
  const english = new Map([['entries.rose.text', 'Rose']])

  it('maps reading keys to the english text', () => {
    expect(sourceText(english, 'entries.rose.text')).toBe('Rose')
    expect(sourceText(english, 'entries.rose.reading')).toBe('Rose')
    expect(sourceText(english, 'entries.other.text')).toBeUndefined()
  })

  it('keeps only strings that have an english source', () => {
    const target = new Map([
      ['entries.rose.text', 'Rose'],
      ['entries.gone.text', 'x'],
    ])
    expect([...reviewableStrings(english, target).keys()]).toEqual(['entries.rose.text'])
  })
})

describe('fingerprints and pending keys', () => {
  const strings = new Map([
    ['a', { source: 'A', value: 'a' }],
    ['b', { source: 'B', value: 'b' }],
  ])

  it('is stable and depends on both source and value', () => {
    expect(stringFingerprint({ source: 'A', value: 'a' })).toBe(stringFingerprint({ source: 'A', value: 'a' }))
    expect(stringFingerprint({ source: 'A', value: 'a' })).not.toBe(stringFingerprint({ source: 'A', value: 'b' }))
    expect(stringFingerprint({ source: 'A', value: 'a' })).not.toBe(stringFingerprint({ source: 'B', value: 'a' }))
  })

  it('lists strings that no check has approved at their current text', () => {
    const check = { strings: { a: stringFingerprint(strings.get('a')!), b: 'stale' } }
    expect(pendingKeys(strings, [check])).toEqual(['b'])
    expect(pendingKeys(strings, [])).toEqual(['a', 'b'])
    expect(pendingKeys(strings, [{ strings: undefined as never }])).toEqual(['a', 'b'])
  })
})

describe('placeholders', () => {
  it('extracts unique sorted placeholders', () => {
    expect(placeholders('{b} and {a} and {b}')).toEqual(['{a}', '{b}'])
  })

  it('compares sets of placeholders', () => {
    expect(samePlaceholders('{n} cards', '{n} Karten')).toBe(true)
    expect(samePlaceholders('{n} cards', 'Karten')).toBe(false)
  })
})

describe('pluralFormCount', () => {
  it('counts pipe separated forms', () => {
    expect(pluralFormCount('a')).toBe(1)
    expect(pluralFormCount('a | b | c')).toBe(3)
  })
})

describe('formatReview / parseReview', () => {
  const review = { language: 'de', scope: 'ui', commit: 'abc', fluency: 'native' as const, changes: { a: 'b' } }

  it('round-trips a review', () => {
    expect(parseReview(formatReview(review))).toEqual(review)
  })

  it('accepts fenced json and optional fields', () => {
    const text = '```json\n' + formatReview({ ...review, part: 'basics', keys: ['a'] }) + '\n```'
    expect(parseReview(text)).toEqual({ ...review, part: 'basics', keys: ['a'] })
  })

  it.each([
    ['invalid json', '{'],
    ['non-object', '3'],
    ['missing language', JSON.stringify({ scope: 'ui', commit: 'x' })],
    ['bad fluency', JSON.stringify({ ...review, fluency: 'none' })],
    ['array changes', JSON.stringify({ ...review, changes: [] })],
    ['non-string change', JSON.stringify({ ...review, changes: { a: 1 } })],
    ['bad part', JSON.stringify({ ...review, part: 1 })],
    ['bad keys', JSON.stringify({ ...review, keys: [1] })],
    ['keys not an array', JSON.stringify({ ...review, keys: 'a' })],
  ])('rejects %s', (_, text) => {
    expect(parseReview(text)).toBeUndefined()
  })

  it('defaults to no changes', () => {
    expect(parseReview(JSON.stringify({ language: 'de', scope: 'ui', commit: 'x' }))?.changes).toEqual({})
  })
})
