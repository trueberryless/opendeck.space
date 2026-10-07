import { describe, expect, it } from 'vitest'
import type { StarterPack } from '~/composables/useStarterPacks'
import {
  loadReviewChecks,
  loadReviewStrings,
  requiredSeconds,
  restoreProgress,
  reviewSections,
  reviewStorageKey,
  REVIEW_MIN_SECONDS,
  type ReviewSection,
} from '~/utils/translationReview'

const english = new Map(Array.from({ length: 60 }, (_, i) => [`group.key${i}`, `English ${i}`]))
const target = new Map(english.entries().map(([key, value]) => [key, value.replace('English', 'Deutsch')]))

const pack: StarterPack = {
  id: 'p',
  category: 'essentials',
  sections: ['s1', 's2'],
  languages: ['en', 'de'],
  entries: [
    { key: 'a', section: 's1', order: 1 },
    { key: 'b', section: 's2', order: 2 },
  ],
  translations: {
    en: { a: { text: 'A', note: 'n' }, b: { text: 'B' } },
    de: { a: { text: 'AA', reading: 'r', note: 'nn' }, b: { text: 'BB' } },
  },
}

describe('reviewSections', () => {
  it('groups interface strings by their first key segment and splits long groups evenly', () => {
    const sections = reviewSections(english, target)
    expect(sections.map((s) => s.id)).toEqual(['group-1', 'group-2'])
    expect(sections.map((s) => s.rows.length)).toEqual([30, 30])
    expect(sections[0]).toMatchObject({ group: 'group', part: 1, parts: 2 })
    expect(sections[0]!.rows[0]).toEqual({ key: 'group.key0', source: 'English 0', value: 'Deutsch 0', reading: false })
  })

  it('keeps a small group as one section and skips untranslated keys', () => {
    const small = new Map([
      ['a.x', 'X'],
      ['b.y', 'Y'],
    ])
    const sections = reviewSections(small, new Map([['a.x', 'XX']]))
    expect(sections.map((s) => s.id)).toEqual(['a'])
  })

  it('limits the sections to the given keys', () => {
    const sections = reviewSections(english, target, undefined, new Set(['group.key3']))
    expect(sections).toHaveLength(1)
    expect(sections[0]!.rows.map((r) => r.key)).toEqual(['group.key3'])
  })

  it('builds pack sections in entry order, including readings and notes', () => {
    const en = new Map([
      ['entries.a.text', 'A'],
      ['entries.a.note', 'n'],
      ['entries.b.text', 'B'],
    ])
    const de = new Map([
      ['entries.a.text', 'AA'],
      ['entries.a.reading', 'r'],
      ['entries.a.note', 'nn'],
      ['entries.b.text', 'BB'],
    ])
    const sections = reviewSections(en, de, pack)
    expect(sections.map((s) => s.group)).toEqual(['s1', 's2'])
    expect(sections[0]!.rows.map((r) => [r.key, r.reading])).toEqual([
      ['entries.a.text', false],
      ['entries.a.reading', true],
      ['entries.a.note', false],
    ])
  })
})

describe('requiredSeconds', () => {
  it('needs one second per string but at least the minimum', () => {
    const section = (n: number) => ({ rows: Array.from({ length: n }) }) as ReviewSection
    expect(requiredSeconds(section(2))).toBe(REVIEW_MIN_SECONDS)
    expect(requiredSeconds(section(20))).toBe(20)
  })
})

describe('restoreProgress', () => {
  const sections = reviewSections(english, target)

  it('starts empty', () => {
    const progress = restoreProgress(undefined, sections)
    expect(progress).toMatchObject({ edits: {}, confirmed: [], read: {} })
    expect(Object.keys(progress.fingerprints)).toEqual(['group-1', 'group-2'])
  })

  it('keeps confirmations of unchanged sections only', () => {
    const first = restoreProgress(undefined, sections)
    const changed = reviewSections(english, new Map([...target, ['group.key0', 'Geändert']]))
    const restored = restoreProgress(
      { ...first, confirmed: ['group-1', 'group-2'], read: { 'group-1': 9, 'group-2': 9 }, fluency: 'native' },
      changed,
    )
    expect(restored.confirmed).toEqual(['group-2'])
    expect(restored.read).toEqual({ 'group-2': 9 })
    expect(restored.fluency).toBe('native')
  })

  it('keeps edits only for existing keys whose translation still differs', () => {
    const restored = restoreProgress({ edits: { 'group.key0': 'Neu', 'group.key1': 'Deutsch 1', gone: 'x' } }, sections)
    expect(restored.edits).toEqual({ 'group.key0': 'Neu' })
  })
})

describe('reviewStorageKey', () => {
  it('distinguishes the review mode', () => {
    expect(reviewStorageKey('de', 'ui', 'all')).toBe('opendeck-translation-review:de:ui')
    expect(reviewStorageKey('de', 'ui', 'changes')).toBe('opendeck-translation-review:de:ui:changes')
  })
})

describe('loading', () => {
  it('loads and flattens interface files', async () => {
    const strings = await loadReviewStrings('ui', 'de')
    expect(strings!.english.get('common.cancel') ?? strings!.english.size).toBeTruthy()
    expect(strings!.target.size).toBe(strings!.english.size)
    expect(await loadReviewStrings('ui', 'xx')).toBeUndefined()
  })

  it('reads pack strings from the given pack', async () => {
    const strings = await loadReviewStrings('p', 'de', pack)
    expect(strings!.english.get('entries.a.text')).toBe('A')
    expect(await loadReviewStrings('p', 'fr', pack)).toBeUndefined()
    expect(await loadReviewStrings('p', 'de')).toBeUndefined()
  })

  it('loads recorded checks for a file or an empty list', async () => {
    const checks = await loadReviewChecks('ui', 'de')
    expect(Array.isArray(checks)).toBe(true)
    expect(await loadReviewChecks('ui', 'xx')).toEqual([])
  })
})
