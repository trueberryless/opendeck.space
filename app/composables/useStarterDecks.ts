import type { ParsedDeck } from '~/utils/import/types'

export interface StarterCard {
  section?: string
  front: string
  back: string
  hint?: string
  phonetic?: string
  examples?: string[]
}

export interface StarterDeck {
  id: string
  title: string
  summary?: string
  sourceLang?: string
  targetLang?: string
  targetLangLabel?: string
  flag?: string
  level?: string
  sort?: number
  tags?: string[]
  attribution?: string
  cards: StarterCard[]
}

// Bundle every deck JSON in ~/data/starter-decks at build time. Adding a new
// language is a drop-in JSON file — no code change required.
const modules = import.meta.glob<{ default: StarterDeck }>('../data/starter-decks/*.json', { eager: true })

const ALL: StarterDeck[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999) || a.title.localeCompare(b.title))

/** Section groupings in the order they should appear in a preview. */
export function groupBySection(deck: StarterDeck): { section: string; cards: StarterCard[] }[] {
  const groups: { section: string; cards: StarterCard[] }[] = []
  const index = new Map<string, StarterCard[]>()
  for (const card of deck.cards) {
    const key = card.section || 'Cards'
    let bucket = index.get(key)
    if (!bucket) {
      bucket = []
      index.set(key, bucket)
      groups.push({ section: key, cards: bucket })
    }
    bucket.push(card)
  }
  return groups
}

/** Convert a starter deck into the shape the import pipeline consumes. */
export function toParsedDeck(deck: StarterDeck): ParsedDeck {
  return {
    title: deck.title,
    summary: deck.summary,
    sourceLang: deck.sourceLang,
    targetLang: deck.targetLang,
    tags: deck.tags,
    cards: deck.cards.map((c) => ({
      front: c.front,
      back: c.back,
      hint: c.hint,
      phonetic: c.phonetic,
      examples: c.examples,
    })),
  }
}

export function useStarterDecks() {
  function list(): StarterDeck[] {
    return ALL
  }

  function get(id: string): StarterDeck | undefined {
    return ALL.find((d) => d.id === id)
  }

  return { list, get, groupBySection, toParsedDeck }
}
