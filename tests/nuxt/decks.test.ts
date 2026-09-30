import { describe, expect, it, vi } from 'vitest'
import { CARD_NSID, DECK_NSID, recordUri, type DeckView } from '~/composables/useDecks'
import { signIn } from '../support/session'

const deckValue = { title: 'Spanish', sourceLang: 'es', targetLang: 'en' }

describe('recordUri', () => {
  it('builds at uris', () => {
    expect(recordUri('did:x', DECK_NSID, 'abc')).toBe('at://did:x/space.opendeck.deck/abc')
    expect(CARD_NSID).toBe('space.opendeck.card')
  })
})

describe('useDecks without a session', () => {
  it('refuses to list or write', async () => {
    const decks = useDecks()
    await expect(decks.listMyDecks()).rejects.toThrow('not authenticated')
    await expect(decks.createDeck(deckValue, 'public')).rejects.toThrow('not authenticated')
  })
})

describe('useDecks own decks', () => {
  it('creates public and private decks', async () => {
    const airspace = signIn()
    const decks = useDecks()
    const pub = await decks.createDeck(deckValue, 'public')
    const priv = await decks.createDeck({ title: 'Secret' }, 'private')
    expect(pub).toMatchObject({ visibility: 'public', author: 'did:plc:me', value: { title: 'Spanish' } })
    expect(pub.uri).toBe(`at://did:plc:me/space.opendeck.deck/${pub.rkey}`)
    expect(priv.visibility).toBe('private')
    expect(airspace.vault.manage.ensure).toHaveBeenCalledTimes(1)
    expect(airspace.deck.create).toHaveBeenCalledTimes(1)
  })

  it('falls back to a public deck when spaces are not supported', async () => {
    const airspace = signIn()
    airspace.vault.supported.mockResolvedValue(false)
    const deck = await useDecks().createDeck({ title: 'x' }, 'private')
    expect(deck.visibility).toBe('public')
    expect(airspace.deck.create).toHaveBeenCalled()
  })

  it('lists public and private decks newest first and caches them', async () => {
    signIn()
    const decks = useDecks()
    await decks.createDeck({ title: 'first' }, 'public')
    await new Promise((r) => setTimeout(r, 5))
    await decks.createDeck({ title: 'second' }, 'private')
    const list = await decks.listMyDecks()
    expect(list.map((d) => d.value.title)).toEqual(['second', 'first'])
    expect((await useSync().getCachedDecks('did:plc:me')).map((d) => d.value.title)).toEqual(['second', 'first'])
  })

  it('falls back to cached decks when listing fails', async () => {
    const airspace = signIn()
    const decks = useDecks()
    await decks.createDeck({ title: 'cached' }, 'public')
    await decks.listMyDecks()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    airspace.deck.list.mockRejectedValue(new Error('offline'))
    expect((await decks.listMyDecks()).map((d) => d.value.title)).toEqual(['cached'])
  })

  it('keeps cached private decks when the vault cannot be read', async () => {
    const airspace = signIn()
    const decks = useDecks()
    await decks.createDeck({ title: 'secret' }, 'private')
    await decks.listMyDecks()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    airspace.vault.deck.list.mockRejectedValue(new Error('vault down'))
    expect((await decks.listMyDecks()).map((d) => d.value.title)).toEqual(['secret'])
  })

  it('reads a single deck from either repository and falls back to the cache', async () => {
    const airspace = signIn()
    const decks = useDecks()
    const pub = await decks.createDeck({ title: 'pub' }, 'public')
    const priv = await decks.createDeck({ title: 'priv' }, 'private')
    expect((await decks.getMyDeck(pub.rkey))?.visibility).toBe('public')
    expect((await decks.getMyDeck(priv.rkey))?.visibility).toBe('private')
    expect(await decks.getMyDeck('missing')).toBeNull()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    airspace.deck.get.mockRejectedValue(new Error('offline'))
    expect((await decks.getMyDeck(pub.rkey))?.value.title).toBe('pub')
  })

  it('updates a deck and stamps updatedAt', async () => {
    const airspace = signIn()
    const decks = useDecks()
    const deck = await decks.createDeck({ title: 'a' }, 'public')
    await decks.updateDeck(deck.rkey, { ...deck.value, title: 'b' }, 'public')
    expect(airspace.deck.put).toHaveBeenCalledWith(
      deck.rkey,
      expect.objectContaining({ title: 'b', updatedAt: expect.any(String) }),
    )
    await decks.updateDeck('p', { title: 'c', createdAt: '' }, 'private')
    expect(airspace.vault.deck.put).toHaveBeenCalled()
  })

  it('deletes a deck together with its cards', async () => {
    const airspace = signIn()
    const decks = useDecks()
    const deck = await decks.createDeck({ title: 'a' }, 'public')
    await decks.createCard(deck.rkey, { front: 'f', back: 'b' }, 'public')
    await decks.createCard('other', { front: 'x', back: 'y' }, 'public')
    await decks.deleteDeck(deck.rkey, 'public')
    expect(airspace.card.delete).toHaveBeenCalledTimes(1)
    expect(airspace.deck.delete).toHaveBeenCalledWith(deck.rkey)

    const priv = await decks.createDeck({ title: 'p' }, 'private')
    await decks.createCard(priv.rkey, { front: 'f', back: 'b' }, 'private')
    await decks.deleteDeck(priv.rkey, 'private')
    expect(airspace.vault.card.delete).toHaveBeenCalledTimes(1)
    expect(airspace.vault.deck.delete).toHaveBeenCalledWith(priv.rkey)
  })
})

describe('useDecks cards', () => {
  it('creates, lists in order, updates and deletes cards', async () => {
    const airspace = signIn()
    const decks = useDecks()
    const deck = await decks.createDeck({ title: 'a' }, 'public')
    await decks.createCard(deck.rkey, { front: 'second', back: 'b', order: 2 }, 'public')
    await decks.createCard(deck.rkey, { front: 'first', back: 'b', order: 1 }, 'public')
    const cards = await decks.listMyCards(deck.rkey, 'public')
    expect(cards.map((c) => c.value.front)).toEqual(['first', 'second'])

    await decks.updateCard(cards[0]!.rkey, { ...cards[0]!.value, front: 'edited' }, 'public')
    expect(airspace.card.put).toHaveBeenCalledWith(
      cards[0]!.rkey,
      expect.objectContaining({ front: 'edited', updatedAt: expect.any(String) }),
    )
    await decks.deleteCard(cards[1]!.rkey, 'public')
    expect((await decks.listMyCards(deck.rkey, 'public')).map((c) => c.value.front)).toEqual(['edited'])
  })

  it('handles private cards', async () => {
    const airspace = signIn()
    const decks = useDecks()
    const deck = await decks.createDeck({ title: 'a' }, 'private')
    const res = await decks.createCard(deck.rkey, { front: 'f', back: 'b' }, 'private')
    await decks.updateCard(res.rkey, { front: 'g', back: 'b', deck: deck.rkey, createdAt: '' }, 'private')
    expect((await decks.listMyCards(deck.rkey, 'private'))[0]!.value.front).toBe('g')
    await decks.deleteCard(res.rkey, 'private')
    expect(airspace.vault.card.delete).toHaveBeenCalled()
  })

  it('falls back to cached cards when offline', async () => {
    const airspace = signIn()
    const decks = useDecks()
    const deck = await decks.createDeck({ title: 'a' }, 'public')
    await decks.createCard(deck.rkey, { front: 'f', back: 'b' }, 'public')
    await decks.listMyCards(deck.rkey, 'public')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    airspace.card.list.mockRejectedValue(new Error('offline'))
    expect((await decks.listMyCards(deck.rkey, 'public')).map((c) => c.value.front)).toEqual(['f'])
  })

  it('lists the cards of all decks with one request per visibility', async () => {
    const airspace = signIn()
    const decks = useDecks()
    const pub = await decks.createDeck({ title: 'a' }, 'public')
    const priv = await decks.createDeck({ title: 'b' }, 'private')
    await decks.createCard(pub.rkey, { front: 'p', back: 'b' }, 'public')
    await decks.createCard(priv.rkey, { front: 'q', back: 'b' }, 'private')
    const map = await decks.listAllMyCards([pub, priv])
    expect(map.get(pub.uri)!.map((c) => c.value.front)).toEqual(['p'])
    expect(map.get(priv.uri)!.map((c) => c.value.front)).toEqual(['q'])
    expect(airspace.card.list).toHaveBeenCalledTimes(1)
  })

  it('uses cached cards for a visibility that cannot be fetched', async () => {
    const airspace = signIn()
    const decks = useDecks()
    const pub = await decks.createDeck({ title: 'a' }, 'public')
    await decks.createCard(pub.rkey, { front: 'p', back: 'b' }, 'public')
    await decks.listAllMyCards([pub])
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    airspace.card.list.mockRejectedValue(new Error('offline'))
    expect((await decks.listAllMyCards([pub])).get(pub.uri)!.map((c) => c.value.front)).toEqual(['p'])
  })
})

describe('useDecks other people', () => {
  const foreign: DeckView = {
    uri: 'at://did:plc:other/space.opendeck.deck/d1',
    cid: 'cid',
    rkey: 'd1',
    author: 'did:plc:other',
    value: { title: 'Theirs', tags: ['t'], createdAt: '2026-01-01T00:00:00Z' },
    visibility: 'public',
  }

  it('hides decks of people who do not share them', async () => {
    signIn()
    const decks = useDecks()
    expect(await decks.getForeignDeck('did:plc:nobody', 'd1')).toBeNull()
    expect(await decks.listForeignCards('did:plc:nobody', 'd1')).toEqual([])
    expect(await decks.listDecksOf('did:plc:nobody')).toEqual([])
  })

  it('copies a shared deck including media into my repository', async () => {
    const mine = signIn()
    const decks = useDecks()
    const { readAirspace } = await import('~/composables/useAirspace')
    const theirs = readAirspace('did:plc:other') as any
    const spy = (name: string, value: unknown) => vi.spyOn(theirs[name], 'list').mockResolvedValue(value as never)
    vi.spyOn(theirs.profile, 'get').mockResolvedValue({ value: { showDecksOnProfile: true } } as never)
    spy('card', [
      {
        rkey: 'c1',
        cid: 'cc',
        author: 'did:plc:other',
        value: {
          deck: 'd1',
          front: 'f',
          back: 'b',
          image: { cid: 'img', mimeType: 'image/png' },
          order: 0,
          createdAt: '',
        },
      },
      {
        rkey: 'c2',
        cid: 'cc',
        author: 'did:plc:other',
        value: { deck: 'elsewhere', front: 'x', back: 'y', createdAt: '' },
      },
    ])
    vi.spyOn(theirs.blobs, 'url').mockResolvedValue('https://blobs.test/img' as never)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Blob(['x'], { type: 'image/png' }))),
    )

    const copy = await decks.copyDeck(foreign, 'public')
    expect(copy.value).toMatchObject({ title: 'Theirs', copiedFrom: foreign.uri })
    expect(mine.card.rows.size).toBe(1)
    expect(mine.blobs.upload).toHaveBeenCalledTimes(1)
    expect((await decks.findCopyOf(foreign.uri))?.rkey).toBe(copy.rkey)
    expect(await decks.findCopyOf('at://nothing')).toBeNull()
  })

  it('likes a deck', async () => {
    const airspace = signIn()
    await useDecks().likeDeck(foreign)
    expect(airspace.like.create).toHaveBeenCalledWith(
      expect.objectContaining({ subject: { uri: foreign.uri, cid: 'cid' } }),
    )
  })
})
