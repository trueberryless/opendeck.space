import { describe, expect, it, vi } from 'vitest'
import {
  ANKI_MODEL,
  AnkiConnectError,
  ankiDeckName,
  ankiModel,
  cardToNote,
  connectAnki,
  createAnkiConnect,
  deckQuery,
  escapeHtml,
  listAnkiDecks,
  mediaFilename,
  noteToCard,
  readAnkiDeck,
  sendToAnki,
} from '~/utils/ankiConnect'
import type { ExportedDeck } from '~/utils/import/json'
import { createFakeAnki, type FakeAnkiOptions } from '../support/anki'

const PNG = Buffer.from([137, 80, 78, 71]).toString('base64')
const MP3 = Buffer.from([73, 68, 51]).toString('base64')

function connected(options: FakeAnkiOptions = {}, key?: string) {
  const fake = createFakeAnki(options)
  return { fake, anki: createAnkiConnect({ key, fetch: fake.fetch }) }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('createAnkiConnect', () => {
  it('posts version 6 requests to the local AnkiConnect port and unwraps the result', async () => {
    const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      json({ result: ['Default'], error: null }),
    )
    const anki = createAnkiConnect({ fetch })
    await expect(anki.call('deckNames')).resolves.toEqual(['Default'])
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:8765', expect.objectContaining({ method: 'POST' }))
    const init = fetch.mock.calls[0]![1] as RequestInit & { targetAddressSpace?: string }
    expect(JSON.parse(String(init.body))).toEqual({ action: 'deckNames', version: 6, params: {} })
    expect(init.targetAddressSpace).toBe('loopback')
    expect(new Headers(init.headers).has('content-type')).toBe(false)
  })

  it('adds the API key to every request and to each request inside multi', async () => {
    const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      json({ result: [{ result: 6, error: null }], error: null }),
    )
    await createAnkiConnect({ key: 'secret', fetch }).multi([{ action: 'version' }])
    expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body))).toEqual({
      action: 'multi',
      version: 6,
      params: { actions: [{ action: 'version', version: 6, params: {}, key: 'secret' }] },
      key: 'secret',
    })
  })

  it('skips the request for an empty multi', async () => {
    const fetch = vi.fn()
    await expect(createAnkiConnect({ fetch }).multi([])).resolves.toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch')), 'unreachable'],
    ['a forbidden origin', async () => json({}, 403), 'denied'],
    ['a server error', async () => json({}, 500), 'failed'],
    ['a reply that is not JSON', async () => new Response('<html>'), 'failed'],
    ['a missing API key', async () => json({ result: null, error: 'valid api key must be provided' }), 'key'],
    ['an action error', async () => json({ result: null, error: 'deck was not found: X' }), 'failed'],
  ])('reports %s as a %s problem', async (_, impl, problem) => {
    const anki = createAnkiConnect({ fetch: vi.fn(impl) as typeof fetch })
    await expect(anki.call('deckNames')).rejects.toMatchObject({ name: 'AnkiConnectError', problem })
  })

  it('uses the global fetch by default', async () => {
    const fetch = vi.fn(async () => json({ result: 6, error: null }))
    vi.stubGlobal('fetch', fetch)
    await expect(createAnkiConnect().call('version')).resolves.toBe(6)
    expect(fetch).toHaveBeenCalledOnce()
  })
})

describe('connectAnki', () => {
  it('asks for permission and checks that requests go through', async () => {
    const { fake, anki } = connected()
    await connectAnki(anki, false)
    expect(fake.requests.map((r) => r.action)).toEqual(['requestPermission', 'version'])
  })

  it('fails when Anki declines', async () => {
    const { anki } = connected({ permission: 'denied' })
    await expect(connectAnki(anki, false)).rejects.toMatchObject({ problem: 'denied' })
  })

  it('fails for AnkiConnect versions before API version 6', async () => {
    const { anki } = connected({ version: 5 })
    await expect(connectAnki(anki, false)).rejects.toMatchObject({ problem: 'outdated' })
  })

  it('asks for a key when AnkiConnect requires one', async () => {
    const { anki } = connected({ apiKey: 'secret' })
    await expect(connectAnki(anki, false)).rejects.toMatchObject({ problem: 'key' })
  })

  it('reports a wrong key', async () => {
    const { anki } = connected({ apiKey: 'secret' }, 'wrong')
    await expect(connectAnki(anki, true)).rejects.toMatchObject({ problem: 'key' })
  })

  it('connects with the right key', async () => {
    const { anki } = connected({ apiKey: 'secret' }, 'secret')
    await expect(connectAnki(anki, true)).resolves.toBeUndefined()
  })
})

describe('deckQuery', () => {
  it('matches one deck without its subdecks', () => {
    expect(deckQuery('Spanish')).toBe('deck:"Spanish" -deck:"Spanish::*"')
  })

  it('escapes quotes, backslashes and wildcards', () => {
    expect(deckQuery('a"b\\c*d_e')).toBe('deck:"a\\"b\\\\c\\*d\\_e" -deck:"a\\"b\\\\c\\*d\\_e::*"')
  })
})

describe('listAnkiDecks', () => {
  it('lists decks that have notes, sorted by name, with their note count', async () => {
    const { anki } = connected({
      decks: ['Empty'],
      notes: [
        { deck: 'Spanish', fields: { Front: 'hola', Back: 'hello' } },
        { deck: 'Spanish', fields: { Front: 'adiós', Back: 'bye' } },
        { deck: 'Lang::French', fields: { Front: 'salut', Back: 'hi' } },
      ],
    })
    await expect(listAnkiDecks(anki)).resolves.toEqual([
      { name: 'Lang::French', notes: 1 },
      { name: 'Spanish', notes: 2 },
    ])
  })
})

describe('noteToCard', () => {
  const field = (value: string, order: number) => ({ value, order })

  it('uses the first two fields by order and keeps the front when the back is empty', () => {
    expect(
      noteToCard({ noteId: 1, modelName: 'Basic', fields: { B: field('', 1), A: field('<b>hola</b>', 0) } }),
    ).toEqual({ card: { front: 'hola', back: 'hola' }, image: undefined, audio: undefined })
  })

  it('finds the first image and sound on either side', () => {
    const read = noteToCard({
      noteId: 1,
      fields: { Front: field('<img src="cat.png">gato', 0), Back: field('cat [sound:cat.mp3]', 1) },
    })
    expect(read).toEqual({ card: { front: 'gato', back: 'cat' }, image: 'cat.png', audio: 'cat.mp3' })
  })

  it('handles notes without fields', () => {
    expect(noteToCard({ noteId: 1 }).card).toEqual({ front: '', back: '' })
  })

  it('reads every field of notes OpenDeck sent to Anki', () => {
    const note = cardToNote(
      {
        front: 'こんにちは',
        back: 'hello',
        hint: 'greeting',
        frontReading: 'konnichiwa',
        backReading: 'heh-low',
        examples: ['こんにちは、元気？', 'Hello, how are you?'],
      },
      'Japanese',
    )
    const fields = Object.fromEntries(
      Object.entries({ ...note.fields, Image: '<img src="a.png">', Audio: '[sound:a.mp3]' }).map(([k, v], i) => [
        k,
        field(v, i),
      ]),
    )
    expect(noteToCard({ noteId: 1, modelName: ANKI_MODEL, fields })).toEqual({
      card: {
        front: 'こんにちは',
        back: 'hello',
        hint: 'greeting',
        frontReading: 'konnichiwa',
        backReading: 'heh-low',
        examples: ['こんにちは、元気？', 'Hello, how are you?'],
      },
      image: 'a.png',
      audio: 'a.mp3',
    })
  })

  it('leaves out empty optional fields of OpenDeck notes', () => {
    expect(
      noteToCard({ noteId: 1, modelName: ANKI_MODEL, fields: { Front: field('a', 0), Back: field('b', 1) } }).card,
    ).toEqual({ front: 'a', back: 'b' })
  })
})

describe('readAnkiDeck', () => {
  it('reads the notes of one deck with their media', async () => {
    const { anki } = connected({
      media: { 'cat.png': PNG, 'cat.mp3': MP3 },
      notes: [
        { deck: 'Animals', fields: { Front: '<img src="cat.png">gato', Back: 'cat[sound:cat.mp3]' } },
        { deck: 'Animals', fields: { Front: '', Back: '' } },
        { deck: 'Animals::Birds', fields: { Front: 'pájaro', Back: 'bird' } },
      ],
    })
    const { deck, missingMedia } = await readAnkiDeck(anki, 'Animals')
    expect(missingMedia).toBe(0)
    expect(deck).toMatchObject({ title: 'Animals', tags: ['anki'] })
    expect(deck.cards).toHaveLength(1)
    expect(deck.cards[0]).toMatchObject({
      front: 'gato',
      back: 'cat',
      image: { filename: 'cat.png', mime: 'image/png', kind: 'image', bytes: new Uint8Array([137, 80, 78, 71]) },
      audio: { filename: 'cat.mp3', mime: 'audio/mpeg', kind: 'audio', bytes: new Uint8Array([73, 68, 51]) },
    })
  })

  it('counts media files that Anki does not have', async () => {
    const { anki } = connected({
      notes: [{ deck: 'A', fields: { Front: '<img src="gone.png">x', Back: 'y[sound:gone.mp3]' } }],
    })
    const { deck, missingMedia } = await readAnkiDeck(anki, 'A')
    expect(missingMedia).toBe(2)
    expect(deck.cards[0]).toEqual({ front: 'x', back: 'y' })
  })

  it('reads large decks in several requests', async () => {
    const { fake, anki } = connected({
      notes: Array.from({ length: 450 }, (_, i) => ({ deck: 'Big', fields: { Front: `f${i}`, Back: `b${i}` } })),
    })
    const { deck } = await readAnkiDeck(anki, 'Big')
    expect(deck.cards).toHaveLength(450)
    expect(fake.requests.filter((r) => r.action === 'notesInfo')).toHaveLength(3)
  })
})

describe('sending to Anki', () => {
  const deck = (cards: ExportedDeck['cards'], title = 'Spanish basics'): ExportedDeck => ({ title, cards })

  it('escapes text so it shows as written in Anki', () => {
    expect(escapeHtml('a < b & "c"\nd')).toBe('a &lt; b &amp; &quot;c&quot;<br>d')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('keeps deck names flat', () => {
    expect(ankiDeckName('  Kanji::N5 ')).toBe('Kanji:N5')
    expect(ankiDeckName(' ')).toBe(ANKI_MODEL)
  })

  it('names media after its content', () => {
    const a = mediaFilename({ filename: 'image.png', mime: 'image/png', base64: PNG })
    expect(a).toMatch(/^opendeck-[0-9a-f]{8}\.png$/)
    expect(mediaFilename({ filename: 'other.png', mime: 'image/png', base64: PNG })).toBe(a)
    expect(mediaFilename({ filename: 'image.png', mime: 'image/png', base64: MP3 })).not.toBe(a)
    expect(mediaFilename({ filename: '', mime: '', base64: PNG })).toMatch(/\.bin$/)
  })

  it('defines a note type with every card field', () => {
    const model = ankiModel()
    expect(model.modelName).toBe(ANKI_MODEL)
    const templates = model.cardTemplates[0]!.Front + model.cardTemplates[0]!.Back
    for (const field of model.inOrderFields) expect(templates).toMatch(new RegExp(`\\{\\{(\\w+:)?${field}\\}\\}`))
  })

  it('turns a card into a note with attached media', () => {
    const note = cardToNote(
      {
        front: 'gato',
        back: 'cat',
        examples: ['El gato duerme.'],
        image: { filename: 'image.png', mime: 'image/png', base64: PNG },
        audio: { filename: 'audio.mp3', mime: 'audio/mpeg', base64: MP3 },
      },
      'Animals',
    )
    expect(note).toMatchObject({
      deckName: 'Animals',
      modelName: ANKI_MODEL,
      tags: ['opendeck'],
      options: { allowDuplicate: false, duplicateScope: 'deck' },
      fields: { Front: 'gato', Back: 'cat', Hint: '', Examples: 'El gato duerme.', Image: '', Audio: '' },
      picture: [{ data: PNG, fields: ['Image'] }],
      audio: [{ data: MP3, fields: ['Audio'] }],
    })
  })

  it('creates the note type and deck, then adds the cards', async () => {
    const { fake, anki } = connected()
    const progress = vi.fn()
    const result = await sendToAnki(
      anki,
      deck([
        { front: 'hola', back: 'hello', image: { filename: 'image.png', mime: 'image/png', base64: PNG } },
        { front: 'adiós', back: 'goodbye' },
      ]),
      progress,
    )
    expect(result).toEqual({ deckName: 'Spanish basics', added: 2, skipped: 0 })
    expect(fake.models.get(ANKI_MODEL)).toEqual(ankiModel().inOrderFields)
    expect(fake.notes.map((n) => [n.deck, n.fields.Front, n.tags])).toEqual([
      ['Spanish basics', 'hola', ['opendeck']],
      ['Spanish basics', 'adiós', ['opendeck']],
    ])
    expect(fake.notes[0]!.fields.Image).toMatch(/^<img src="opendeck-[0-9a-f]{8}\.png">$/)
    expect([...fake.media.values()]).toEqual([PNG])
    expect(progress).toHaveBeenNthCalledWith(1, 0, 2)
    expect(progress).toHaveBeenLastCalledWith(2, 2)
    const check = fake.requests.find((r) => r.action === 'canAddNotes')!
    expect(check.params!.notes[0]).not.toHaveProperty('picture')
  })

  it('skips cards that are already in the Anki deck, duplicates and empty cards', async () => {
    const { fake, anki } = connected({
      models: ['Basic', ANKI_MODEL],
      notes: [{ deck: 'Spanish basics', modelName: ANKI_MODEL, fields: { Front: 'hola', Back: 'hello' } }],
    })
    const result = await sendToAnki(
      anki,
      deck([
        { front: 'hola', back: 'hello' },
        { front: 'gracias', back: 'thanks' },
        { front: 'gracias', back: 'thank you' },
        { front: '', back: 'nothing' },
      ]),
    )
    expect(result).toEqual({ deckName: 'Spanish basics', added: 1, skipped: 3 })
    expect(fake.requests.some((r) => r.action === 'createModel')).toBe(false)
    expect(fake.notes.map((n) => n.fields.Front)).toEqual(['hola', 'gracias'])
  })

  it('adds large decks in batches and counts notes older AnkiConnect versions rejected', async () => {
    const fake = createFakeAnki()
    const reply = fake.reply
    const anki = createAnkiConnect({
      fetch: async (_url, init) => {
        const body = JSON.parse(String(init?.body))
        if (body.action === 'addNotes') {
          const ids = (reply(body).result as number[]).map((id, i) => (i === 0 ? null : id))
          return json({ result: ids, error: null })
        }
        return json(reply(body))
      },
    })
    const cards = Array.from({ length: 60 }, (_, i) => ({ front: `f${i}`, back: `b${i}` }))
    const result = await sendToAnki(anki, deck(cards))
    expect(fake.requests.filter((r) => r.action === 'addNotes')).toHaveLength(3)
    expect(result).toEqual({ deckName: 'Spanish basics', added: 57, skipped: 3 })
  })

  it('stops when Anki rejects a batch', async () => {
    const fake = createFakeAnki()
    const anki = createAnkiConnect({
      fetch: async (_url, init) => {
        const body = JSON.parse(String(init?.body))
        if (body.action === 'addNotes') return json({ result: null, error: 'collection is busy' })
        return json(fake.reply(body))
      },
    })
    await expect(sendToAnki(anki, deck([{ front: 'a', back: 'b' }]))).rejects.toBeInstanceOf(AnkiConnectError)
  })
})
