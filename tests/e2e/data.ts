export const ME = { did: 'did:plc:abcdefghijklmnopqrstuvwx', handle: 'me.test' }

export interface SeedCard {
  rkey: string
  front: string
  back: string
  hint?: string
  dueAt?: string
}

export interface SeedDeck {
  rkey: string
  title: string
  cards: SeedCard[]
  visibility?: 'public' | 'private'
  sourceLang?: string
  targetLang?: string
  createdAt?: string
}

export interface Seed {
  decks: SeedDeck[]
  prefs?: Record<string, unknown>
}

export const SPANISH: SeedDeck = {
  rkey: 'deck1',
  title: 'Spanish basics',
  sourceLang: 'es',
  targetLang: 'en',
  createdAt: '2026-01-01T00:00:00.000Z',
  cards: [
    { rkey: 'c1', front: 'hola', back: 'hello' },
    { rkey: 'c2', front: 'adiós', back: 'goodbye', hint: 'farewell' },
    { rkey: 'c3', front: 'gracias', back: 'thank you' },
  ],
}

export const GERMAN: SeedDeck = {
  rkey: 'deck2',
  title: 'German verbs',
  createdAt: '2026-02-01T00:00:00.000Z',
  cards: [{ rkey: 'g1', front: 'gehen', back: 'to go' }],
}

export const deckUri = (deck: SeedDeck) => `at://${ME.did}/space.opendeck.deck/${deck.rkey}`
export const cardUri = (card: SeedCard) => `at://${ME.did}/space.opendeck.card/${card.rkey}`
