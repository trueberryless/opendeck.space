import { describe, expect, it } from 'vitest'
import {
  buildPackCards,
  easiestPackCards,
  groupPackCards,
  packToParsedDeck,
  PACK_CATEGORIES,
  type StarterPack,
} from '~/composables/useStarterPacks'

const pack: StarterPack = {
  id: 'test',
  category: 'essentials',
  sections: ['greetings', 'empty'],
  entries: [
    { key: 'hello', section: 'greetings', order: 2, note: 'default note' },
    { key: 'bye', section: 'greetings', order: 1 },
    { key: 'missing', section: 'greetings', order: 3 },
  ],
  languages: ['de', 'ja'],
  translations: {
    de: { hello: { text: 'Hallo' }, bye: { text: 'Tschüss', note: 'informal' } },
    ja: { hello: { text: 'こんにちは', reading: 'konnichiwa' }, bye: { text: 'さようなら', reading: 'sayounara' } },
  },
}

describe('buildPackCards', () => {
  it('pairs the two languages and skips entries missing in either', () => {
    expect(buildPackCards(pack, 'de', 'ja')).toEqual([
      {
        section: 'greetings',
        order: 2,
        front: 'Hallo',
        back: 'こんにちは',
        reading: 'konnichiwa',
        frontReading: undefined,
        hint: 'default note',
      },
      {
        section: 'greetings',
        order: 1,
        front: 'Tschüss',
        back: 'さようなら',
        reading: 'sayounara',
        frontReading: undefined,
        hint: 'informal',
      },
    ])
  })

  it('returns nothing for unknown languages', () => {
    expect(buildPackCards(pack, 'de', 'xx')).toEqual([])
    expect(buildPackCards(pack, 'xx', 'de')).toEqual([])
  })
})

describe('easiestPackCards', () => {
  const card = (front: string, order: number) => ({ section: 'a', order, front, back: front })
  const cards = [card('hard', 3), card('easy', 1), card('medium', 2)]

  it('returns every card when there is no limit or the limit covers them all', () => {
    expect(easiestPackCards(cards)).toBe(cards)
    expect(easiestPackCards(cards, 3)).toBe(cards)
  })

  it('takes the cards with the lowest order, easiest first', () => {
    expect(easiestPackCards(cards, 2).map((c) => c.front)).toEqual(['easy', 'medium'])
    expect(easiestPackCards(cards, 0)).toEqual([])
  })

  it('leaves the given cards untouched', () => {
    easiestPackCards(cards, 1)
    expect(cards.map((c) => c.front)).toEqual(['hard', 'easy', 'medium'])
  })
})

describe('groupPackCards', () => {
  it('groups by section in order and drops empty sections', () => {
    const cards = buildPackCards(pack, 'de', 'ja')
    expect(groupPackCards(pack.sections, cards).map((g) => [g.section, g.cards.length])).toEqual([['greetings', 2]])
  })
})

describe('packToParsedDeck', () => {
  it('builds a deck with the reading mode of the available readings', () => {
    expect(packToParsedDeck(pack, 'de', 'ja', 'Title', 'Summary')).toMatchObject({
      title: 'Title',
      summary: 'Summary',
      sourceLang: 'de',
      targetLang: 'ja',
      readingMode: 'answer',
      tags: ['test', 'starter'],
    })
    expect(packToParsedDeck(pack, 'ja', 'de', 't', 's').readingMode).toBe('prompt')
    expect(packToParsedDeck(pack, 'de', 'de', 't', 's').readingMode).toBe('off')
  })

  it('keeps only the easiest cards when a limit is given', () => {
    expect(packToParsedDeck(pack, 'de', 'ja', 't', 's').cards).toHaveLength(2)
    expect(packToParsedDeck(pack, 'de', 'ja', 't', 's', 1).cards.map((c) => c.front)).toEqual(['Tschüss'])
  })
})

describe('useStarterPacks', () => {
  it('lists the shipped packs ordered by category', () => {
    const packs = useStarterPacks().list()
    expect(packs.length).toBeGreaterThan(10)
    const ranks = packs.map((p) => PACK_CATEGORIES.indexOf(p.category))
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    for (const p of packs) {
      expect(p.languages).toContain('en')
      expect(p.entries.length).toBeGreaterThan(0)
    }
  })

  it('finds a pack by id', () => {
    const { list, get } = useStarterPacks()
    const first = list()[0]!
    expect(get(first.id)).toBe(first)
    expect(get('nope')).toBeUndefined()
  })

  it('builds cards for every pair of shipped languages of a pack', () => {
    const p = useStarterPacks().list()[0]!
    const cards = buildPackCards(
      p,
      'en',
      p.languages.find((l) => l !== 'en')!,
    )
    expect(cards.length).toBe(p.entries.length)
  })
})
