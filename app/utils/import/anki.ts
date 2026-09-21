import {
  htmlToText,
  mediaKind,
  type MediaRef,
  mimeFor,
  type ParsedCard,
  type ParsedDeck,
  type ParseResult,
} from './types'

const FIELD_SEP = String.fromCharCode(0x1f)

export async function parseAnki(file: File, fieldMap?: Record<string, [number, number]>): Promise<ParseResult> {
  const warnings: string[] = []
  const { unzipSync, strFromU8 } = await import('fflate')
  const buf = new Uint8Array(await file.arrayBuffer())
  const files = unzipSync(buf)

  let dbBytes: Uint8Array | undefined
  if (files['collection.anki21b']) {
    const { decompress } = await import('fzstd')
    dbBytes = decompress(files['collection.anki21b'])
  } else if (files['collection.anki21']) {
    dbBytes = files['collection.anki21']
  } else if (files['collection.anki2']) {
    dbBytes = files['collection.anki2']
  }
  if (!dbBytes) throw new Error('No Anki collection found in this file.')

  const initSqlJs = (await import('sql.js')).default
  const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' })
  const db = new SQL.Database(dbBytes)

  try {
    const deckNames = readDeckNames(db)
    const noteDeck = readNoteDecks(db)
    const nameToNum = readMediaMap(files, strFromU8)

    const byDeck = new Map<string, ParsedCard[]>()

    for (const note of getRows(db, 'SELECT id, mid, flds FROM notes')) {
      const mid = Number(note.mid)
      const flds = String(note.flds).split(FIELD_SEP)
      const map = fieldMap?.[String(mid)]
      const [fi, bi] = map ?? [0, 1]
      const frontRaw = flds[fi] ?? flds[0] ?? ''
      const backRaw = flds[bi] ?? flds[1] ?? ''

      const f = extractMedia(frontRaw)
      const b = extractMedia(backRaw)
      const front = f.text
      const back = b.text || f.text // single-field notes: keep something on the back

      const imageName = [...f.images, ...b.images].find((n) => mediaKind(n) === 'image')
      const soundName = [...f.sounds, ...b.sounds].find((n) => mediaKind(n) === 'audio')

      const card: ParsedCard = { front, back }
      const image = imageName ? buildMedia(imageName, files, nameToNum) : undefined
      const audio = soundName ? buildMedia(soundName, files, nameToNum) : undefined
      if (image) card.image = image
      if (audio) card.audio = audio
      if ((imageName && !image) || (soundName && !audio)) warnings.push(`Missing media for a card in note ${note.id}.`)

      const deckId = noteDeck.get(Number(note.id))
      const deckName = (deckId != null ? deckNames.get(deckId) : undefined) || 'Imported'
      const list = byDeck.get(deckName) ?? []
      if (front || back) list.push(card)
      byDeck.set(deckName, list)
    }

    const decks: ParsedDeck[] = [...byDeck.entries()]
      .filter(([, cards]) => cards.length > 0)
      .map(([title, cards]) => ({ title, cards, tags: ['anki'] }))

    if (decks.length === 0) warnings.push('No cards found in this Anki file.')
    return { decks, warnings }
  } finally {
    db.close()
  }
}

type Row = Record<string, any>

function getRows(db: import('sql.js').Database, sql: string): Row[] {
  try {
    const res = db.exec(sql)
    if (!res.length || !res[0]) return []
    const { columns, values } = res[0]
    return values.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])))
  } catch {
    return []
  }
}

function readDeckNames(db: import('sql.js').Database): Map<number, string> {
  const out = new Map<number, string>()
  const col = getRows(db, 'SELECT decks FROM col')[0]
  if (col?.decks) {
    try {
      const decks = JSON.parse(String(col.decks)) as Record<string, { name: string }>
      for (const did of Object.keys(decks)) out.set(Number(did), decks[did]!.name)
    } catch {}
  }
  if (out.size === 0) for (const r of getRows(db, 'SELECT id, name FROM decks')) out.set(Number(r.id), String(r.name))
  return out
}

function readNoteDecks(db: import('sql.js').Database): Map<number, number> {
  const out = new Map<number, number>()
  for (const c of getRows(db, 'SELECT nid, did FROM cards')) {
    if (!out.has(Number(c.nid))) out.set(Number(c.nid), Number(c.did))
  }
  return out
}

function readMediaMap(files: Record<string, Uint8Array>, strFromU8: (u: Uint8Array) => string): Map<string, string> {
  const map = new Map<string, string>()
  if (!files['media']) return map
  try {
    const json = JSON.parse(strFromU8(files['media'])) as Record<string, string>
    for (const num of Object.keys(json)) map.set(json[num]!, num)
  } catch {}
  return map
}

function extractMedia(html: string): { text: string; images: string[]; sounds: string[] } {
  const images = [...html.matchAll(/<img[^>]+src=["']?([^"'>\s]+)["']?/gi)].map((m) => decodeURIComponent(m[1]!))
  const sounds = [...html.matchAll(/\[sound:([^\]]+)\]/gi)].map((m) => m[1]!)
  const text = htmlToText(html.replace(/\[sound:[^\]]+\]/gi, ''))
  return { text, images, sounds }
}

function buildMedia(
  filename: string,
  files: Record<string, Uint8Array>,
  nameToNum: Map<string, string>,
): MediaRef | undefined {
  const num = nameToNum.get(filename)
  const bytes = num ? files[num] : files[filename]
  if (!bytes) return undefined
  const kind = mediaKind(filename)
  if (!kind) return undefined
  return { filename, bytes, mime: mimeFor(filename), kind }
}
