import { createRequire } from 'node:module'
import { zipSync, strToU8 } from 'fflate'
import { describe, expect, it, vi } from 'vitest'

vi.mock('sql.js', async () => {
  const require = createRequire(import.meta.url)
  const init = (await import(require.resolve('sql.js'))).default
  const wasm = require.resolve('sql.js/dist/sql-wasm.wasm')
  return { default: (config: object) => init({ ...config, locateFile: () => wasm }) }
})

import { parseAnki } from '~/utils/import/anki'

const SEP = String.fromCharCode(0x1f)

async function ankiFile(options: {
  notes: [number, number, string][]
  cards: [number, number][]
  media?: Record<string, string>
  files?: Record<string, Uint8Array>
  decks?: object
  name?: string
}) {
  const require = createRequire(import.meta.url)
  const init = (await import(require.resolve('sql.js'))).default
  const SQL = await init({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') })
  const db = new SQL.Database()
  db.run('CREATE TABLE col (decks TEXT)')
  db.run('CREATE TABLE notes (id INTEGER, mid INTEGER, flds TEXT)')
  db.run('CREATE TABLE cards (nid INTEGER, did INTEGER)')
  db.run('INSERT INTO col VALUES (?)', [
    JSON.stringify(options.decks ?? { '1': { name: 'Spanish' }, '2': { name: 'French' } }),
  ])
  for (const [id, mid, flds] of options.notes) db.run('INSERT INTO notes VALUES (?, ?, ?)', [id, mid, flds])
  for (const [nid, did] of options.cards) db.run('INSERT INTO cards VALUES (?, ?)', [nid, did])
  const bytes = db.export()
  db.close()
  const zip = zipSync({
    [options.name ?? 'collection.anki2']: bytes,
    media: strToU8(JSON.stringify(options.media ?? {})),
    ...options.files,
  })
  return new File([zip as BlobPart], 'deck.apkg')
}

describe('parseAnki', () => {
  it('groups notes by deck and strips html', async () => {
    const file = await ankiFile({
      notes: [
        [10, 1, `<b>hola</b>${SEP}hello`],
        [11, 1, `adiós${SEP}bye`],
        [12, 1, `salut${SEP}hi`],
      ],
      cards: [
        [10, 1],
        [11, 1],
        [12, 2],
      ],
    })
    const { decks, warnings } = await parseAnki(file)
    expect(warnings).toEqual([])
    expect(decks.map((d) => [d.title, d.cards.map((c) => [c.front, c.back])])).toEqual([
      [
        'Spanish',
        [
          ['hola', 'hello'],
          ['adiós', 'bye'],
        ],
      ],
      ['French', [['salut', 'hi']]],
    ])
    expect(decks[0]!.tags).toEqual(['anki'])
  })

  it('uses a field map per note type and falls back for single-field notes', async () => {
    const file = await ankiFile({
      notes: [
        [10, 5, `x${SEP}front${SEP}back`],
        [11, 1, 'only'],
      ],
      cards: [
        [10, 1],
        [11, 1],
      ],
    })
    const { decks } = await parseAnki(file, { '5': [1, 2] })
    expect(decks[0]!.cards).toEqual([
      { front: 'front', back: 'back' },
      { front: 'only', back: 'only' },
    ])
  })

  it('extracts images and sounds through the media map', async () => {
    const file = await ankiFile({
      notes: [[10, 1, `<img src="cat%20pic.png">cat${SEP}[sound:meow.mp3]cat`]],
      cards: [[10, 1]],
      media: { '0': 'cat pic.png', '1': 'meow.mp3' },
      files: { '0': new Uint8Array([1, 2]), '1': new Uint8Array([3]) },
    })
    const { decks, warnings } = await parseAnki(file)
    const card = decks[0]!.cards[0]!
    expect(warnings).toEqual([])
    expect(card.image).toMatchObject({ filename: 'cat pic.png', kind: 'image', mime: 'image/png' })
    expect([...card.image!.bytes]).toEqual([1, 2])
    expect(card.audio).toMatchObject({ filename: 'meow.mp3', kind: 'audio' })
  })

  it('warns about missing media and files a card without deck under Imported', async () => {
    const file = await ankiFile({
      notes: [[10, 1, `<img src="gone.png">a${SEP}b`]],
      cards: [],
      decks: {},
    })
    const { decks, warnings } = await parseAnki(file)
    expect(warnings).toEqual(['Missing media for a card in note 10.'])
    expect(decks[0]!.title).toBe('Imported')
  })

  it('warns when the collection has no cards', async () => {
    const file = await ankiFile({ notes: [], cards: [] })
    expect(await parseAnki(file)).toEqual({ decks: [], warnings: ['No cards found in this Anki file.'] })
  })

  it('reads the anki21 collection name and rejects files without a collection', async () => {
    const file = await ankiFile({ notes: [[10, 1, `a${SEP}b`]], cards: [[10, 1]], name: 'collection.anki21' })
    expect((await parseAnki(file)).decks).toHaveLength(1)

    const empty = new File([zipSync({ other: new Uint8Array([1]) }) as BlobPart], 'x.apkg')
    await expect(parseAnki(empty)).rejects.toThrow('No Anki collection found in this file.')
  })
})
