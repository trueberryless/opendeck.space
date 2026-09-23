import type { OpenDeckAirspace } from '~/composables/useAirspace'
import { parseAtUri } from 'airspace'

export type Visibility = 'public' | 'private'
export type ReadingMode = 'off' | 'answer' | 'prompt' | 'hint'

export type CardInput = Parameters<OpenDeckAirspace['card']['create']>[0]

export interface DeckValue {
  title: string
  summary?: string
  sourceLang?: string
  targetLang?: string
  readingMode?: ReadingMode
  tags?: string[]
  copiedFrom?: string
  createdAt: string
  updatedAt?: string
}

export interface CardValue {
  deck: string
  front: string
  back: string
  hint?: string
  examples?: string[]
  phonetic?: string
  phoneticFront?: string
  image?: unknown
  imageAlt?: string
  audio?: unknown
  order?: number
  createdAt: string
}

export interface DeckView {
  uri: string
  cid: string
  rkey: string
  author: string
  value: DeckValue
  visibility: Visibility
}

export interface CardView {
  uri: string
  cid: string
  rkey: string
  value: CardValue
}

const now = () => new Date().toISOString()

let vaultConfigured = false

const sharingDecks = new Map<string, Promise<boolean>>()

function sharesDecks(did: string): Promise<boolean> {
  let shared = sharingDecks.get(did)
  if (!shared) {
    shared = readAirspace(did)
      .profile.get()
      .then((r) => Boolean((r?.value as { showDecksOnProfile?: boolean } | undefined)?.showDecksOnProfile))
      .catch(() => {
        sharingDecks.delete(did)
        return false
      })
    sharingDecks.set(did, shared)
  }
  return shared
}

const COPY_BATCH_SIZE = 10

async function copyBlob(did: string, blob: unknown): Promise<unknown> {
  if (!blob) return undefined
  const url = await readAirspace(did).blobs.url(blob)
  if (!url) return undefined
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not download media (${res.status})`)
  const data = await res.blob()
  const mimeType = (blob as { mimeType?: string }).mimeType || data.type || undefined
  return (await requireAirspace().blobs.upload(data, { mimeType })).blob
}

export const DECK_NSID = 'space.opendeck.deck'
export const CARD_NSID = 'space.opendeck.card'

export function recordUri(author: string, collection: string, rkey: string): string {
  return `at://${author}/${collection}/${rkey}`
}

export function useDecks() {
  const { supported, ensure } = useSpacesSupport()

  async function ensureVaultConfigured(): Promise<void> {
    if (vaultConfigured) return
    vaultConfigured = true
    try {
      await requireAirspace().vault.manage.ensure()
    } catch (err) {
      vaultConfigured = false
      console.error('[opendeck] failed to configure vault space', err)
    }
  }

  function toDeckView(
    r: { uri: string; cid: string; rkey: string; author: string; value: unknown },
    visibility: Visibility,
  ): DeckView {
    return {
      uri: recordUri(r.author, DECK_NSID, r.rkey),
      cid: r.cid,
      rkey: r.rkey,
      author: r.author,
      value: r.value as DeckValue,
      visibility,
    }
  }

  function toCardView(r: { cid: string; rkey: string; author: string; value: unknown }): CardView {
    return { uri: recordUri(r.author, CARD_NSID, r.rkey), cid: r.cid, rkey: r.rkey, value: r.value as CardValue }
  }

  async function listMyDecks(): Promise<DeckView[]> {
    const airspace = requireAirspace()
    const decks: DeckView[] = []
    const pub = await airspace.deck.list()
    decks.push(...pub.map((r) => toDeckView(r, 'public')))

    if (await ensure()) {
      try {
        const priv = await airspace.vault.deck.list()
        decks.push(...priv.map((r) => toDeckView(r, 'private')))
      } catch (err) {
        console.error('[opendeck] failed to list private decks', err)
      }
    }
    return decks.sort((a, b) => (b.value.createdAt || '').localeCompare(a.value.createdAt || ''))
  }

  async function createDeck(input: Omit<DeckValue, 'createdAt'>, visibility: Visibility): Promise<DeckView> {
    const airspace = requireAirspace()
    const value: DeckValue = { ...input, createdAt: now() }
    const private_ = visibility === 'private' && (await ensure())
    if (private_) await ensureVaultConfigured()
    const res = private_ ? await airspace.vault.deck.create(value) : await airspace.deck.create(value)
    const author = parseAtUri(res.uri).authority
    return {
      uri: recordUri(author, DECK_NSID, res.rkey),
      cid: res.cid,
      rkey: res.rkey,
      author,
      value,
      visibility: private_ ? 'private' : 'public',
    }
  }

  async function updateDeck(rkey: string, value: DeckValue, visibility: Visibility): Promise<void> {
    const airspace = requireAirspace()
    const next = { ...value, updatedAt: now() }
    if (visibility === 'private') await airspace.vault.deck.put(rkey, next)
    else await airspace.deck.put(rkey, next)
  }

  async function deleteDeck(rkey: string, visibility: Visibility): Promise<void> {
    const airspace = requireAirspace()
    const cards = await listMyCards(rkey, visibility)
    if (visibility === 'private') {
      for (const c of cards) await airspace.vault.card.delete(c.rkey)
      await airspace.vault.deck.delete(rkey)
    } else {
      for (const c of cards) await airspace.card.delete(c.rkey)
      await airspace.deck.delete(rkey)
    }
  }

  async function getMyDeck(rkey: string): Promise<DeckView | null> {
    const airspace = requireAirspace()
    const pub = await airspace.deck.get(rkey)
    if (pub) return toDeckView(pub, 'public')
    if (await ensure()) {
      const priv = await airspace.vault.deck.get(rkey)
      if (priv) return toDeckView(priv, 'private')
    }
    return null
  }

  async function listMyCards(deckRkey: string, visibility: Visibility): Promise<CardView[]> {
    const airspace = requireAirspace()
    const list = visibility === 'private' ? await airspace.vault.card.list() : await airspace.card.list()
    return list
      .filter((r) => (r.value as CardValue).deck === deckRkey)
      .map(toCardView)
      .sort((a, b) => (a.value.order ?? 0) - (b.value.order ?? 0))
  }

  async function createCard(deckRkey: string, input: Omit<CardValue, 'deck' | 'createdAt'>, visibility: Visibility) {
    const airspace = requireAirspace()
    if (visibility === 'private') await ensureVaultConfigured()
    const value = { ...input, deck: deckRkey, createdAt: now() } as CardInput
    return visibility === 'private' ? airspace.vault.card.create(value) : airspace.card.create(value)
  }

  async function updateCard(rkey: string, value: CardValue, visibility: Visibility) {
    const airspace = requireAirspace()
    const input = value as unknown as CardInput
    return visibility === 'private' ? airspace.vault.card.put(rkey, input) : airspace.card.put(rkey, input)
  }

  async function deleteCard(rkey: string, visibility: Visibility) {
    const airspace = requireAirspace()
    return visibility === 'private' ? airspace.vault.card.delete(rkey) : airspace.card.delete(rkey)
  }

  async function getForeignDeck(did: string, rkey: string): Promise<DeckView | null> {
    if (!(await sharesDecks(did))) return null
    const r = await readAirspace(did).deck.get(rkey)
    return r ? toDeckView(r, 'public') : null
  }

  async function listForeignCards(did: string, deckRkey: string): Promise<CardView[]> {
    if (!(await sharesDecks(did))) return []
    const list = await readAirspace(did).card.list()
    return list
      .filter((r) => (r.value as CardValue).deck === deckRkey)
      .map(toCardView)
      .sort((a, b) => (a.value.order ?? 0) - (b.value.order ?? 0))
  }

  async function listDecksOf(did: string): Promise<DeckView[]> {
    if (!(await sharesDecks(did))) return []
    const list = await readAirspace(did).deck.list()
    return list
      .map((r) => toDeckView(r, 'public'))
      .sort((a, b) => (b.value.createdAt || '').localeCompare(a.value.createdAt || ''))
  }

  async function copyDeck(source: DeckView, visibility: Visibility): Promise<DeckView> {
    const airspace = requireAirspace()
    const cards = await listForeignCards(source.author, source.rkey)
    const created = await createDeck(
      {
        title: source.value.title,
        summary: source.value.summary,
        sourceLang: source.value.sourceLang,
        targetLang: source.value.targetLang,
        readingMode: source.value.readingMode,
        tags: source.value.tags,
        copiedFrom: source.uri,
      },
      visibility,
    )
    for (let i = 0; i < cards.length; i += COPY_BATCH_SIZE) {
      const values: CardInput[] = []
      for (const c of cards.slice(i, i + COPY_BATCH_SIZE)) {
        values.push({
          deck: created.rkey,
          front: c.value.front,
          back: c.value.back,
          hint: c.value.hint,
          examples: c.value.examples,
          phonetic: c.value.phonetic,
          phoneticFront: c.value.phoneticFront,
          image: await copyBlob(source.author, c.value.image),
          imageAlt: c.value.imageAlt,
          audio: await copyBlob(source.author, c.value.audio),
          order: c.value.order,
          createdAt: now(),
        } as CardInput)
      }
      if (created.visibility === 'private') {
        await airspace.vault.batch((b) => {
          for (const v of values) b.card.create(v)
        })
      } else {
        await airspace.batch((b) => {
          for (const v of values) b.card.create(v)
        })
      }
    }
    return created
  }

  async function findCopyOf(sourceUri: string): Promise<DeckView | null> {
    return (await listMyDecks()).find((d) => d.value.copiedFrom === sourceUri) ?? null
  }

  async function likeDeck(deck: DeckView): Promise<void> {
    const airspace = requireAirspace()
    await airspace.like.create({ subject: { uri: deck.uri, cid: deck.cid }, createdAt: now() })
  }

  return {
    spacesSupported: supported,
    listMyDecks,
    createDeck,
    updateDeck,
    deleteDeck,
    getMyDeck,
    listMyCards,
    createCard,
    updateCard,
    deleteCard,
    getForeignDeck,
    listForeignCards,
    listDecksOf,
    copyDeck,
    findCopyOf,
    likeDeck,
  }
}
