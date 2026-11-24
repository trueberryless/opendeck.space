import type { ExportedCard, ExportedDeck, ExportedMedia } from '~/utils/import/json'
import { extractMedia } from '~/utils/import/anki'
import { mediaKind, mimeFor, type MediaRef, type ParsedCard, type ParsedDeck } from '~/utils/import/types'
import { chunks } from '~/utils/ratelimit'

export const ANKI_CONNECT_URL = 'http://127.0.0.1:8765'
export const ANKI_CONNECT_ADDON = '2055492159'
export const ANKI_CONNECT_ADDON_URL = `https://ankiweb.net/shared/info/${ANKI_CONNECT_ADDON}`
export const ANKI_MODEL = 'OpenDeck'
export const ANKI_TAG = 'opendeck'

const API_VERSION = 6
const NOTES_PER_READ = 200
const MEDIA_PER_READ = 20
const NOTES_PER_WRITE = 25

export type AnkiProblem = 'unreachable' | 'denied' | 'key' | 'outdated' | 'failed'

export class AnkiConnectError extends Error {
  constructor(
    readonly problem: AnkiProblem,
    message: string = problem,
  ) {
    super(message)
    this.name = 'AnkiConnectError'
  }
}

interface Reply<T> {
  result: T
  error: string | null
}

export interface AnkiRequest {
  action: string
  params?: Record<string, unknown>
}

export interface AnkiConnect {
  call<T>(action: string, params?: Record<string, unknown>): Promise<T>
  multi<T>(requests: AnkiRequest[]): Promise<Reply<T>[]>
}

export interface AnkiConnectOptions {
  key?: string
  url?: string
  fetch?: typeof fetch
}

function problemOf(error: string): AnkiProblem {
  return /api ?key/i.test(error) ? 'key' : 'failed'
}

function unwrap<T>(reply: Reply<T>): T {
  if (reply.error) throw new AnkiConnectError(problemOf(reply.error), reply.error)
  return reply.result
}

export function createAnkiConnect(options: AnkiConnectOptions = {}): AnkiConnect {
  const url = options.url ?? ANKI_CONNECT_URL
  const fetcher = options.fetch ?? ((input, init) => globalThis.fetch(input, init))
  const withKey = (body: Record<string, unknown>) => (options.key ? { ...body, key: options.key } : body)

  async function post<T>(request: AnkiRequest): Promise<Reply<T>> {
    let response: Response
    try {
      response = await fetcher(url, {
        method: 'POST',
        body: JSON.stringify(withKey({ action: request.action, version: API_VERSION, params: request.params ?? {} })),
        targetAddressSpace: 'loopback',
      } as RequestInit)
    } catch {
      throw new AnkiConnectError('unreachable')
    }
    if (response.status === 403) throw new AnkiConnectError('denied', `HTTP ${response.status}`)
    if (!response.ok) throw new AnkiConnectError('failed', `HTTP ${response.status}`)
    try {
      return (await response.json()) as Reply<T>
    } catch {
      throw new AnkiConnectError('failed', 'Anki sent an unexpected reply.')
    }
  }

  return {
    async call<T>(action: string, params?: Record<string, unknown>) {
      return unwrap(await post<T>({ action, params }))
    },
    async multi<T>(requests: AnkiRequest[]) {
      if (requests.length === 0) return []
      const actions = requests.map((r) => withKey({ action: r.action, version: API_VERSION, params: r.params ?? {} }))
      return unwrap(await post<Reply<T>[]>({ action: 'multi', params: { actions } }))
    },
  }
}

interface Permission {
  permission: 'granted' | 'denied'
  requireApikey?: boolean
  version?: number
}

export async function connectAnki(anki: AnkiConnect, hasKey: boolean): Promise<void> {
  const permission = await anki.call<Permission>('requestPermission')
  if (permission.permission !== 'granted') throw new AnkiConnectError('denied')
  if ((permission.version ?? 0) < API_VERSION) throw new AnkiConnectError('outdated')
  if (permission.requireApikey && !hasKey) throw new AnkiConnectError('key')
  await anki.call('version')
}

export function deckQuery(name: string): string {
  const escaped = name.replace(/[\\"*_]/g, (c) => `\\${c}`)
  return `deck:"${escaped}" -deck:"${escaped}::*"`
}

export interface AnkiDeck {
  name: string
  notes: number
}

export async function listAnkiDecks(anki: AnkiConnect): Promise<AnkiDeck[]> {
  const names = (await anki.call<string[]>('deckNames')).sort((a, b) => a.localeCompare(b))
  const replies = await anki.multi<number[]>(
    names.map((name) => ({ action: 'findNotes', params: { query: deckQuery(name) } })),
  )
  return names.map((name, i) => ({ name, notes: replies[i]?.result?.length ?? 0 })).filter((deck) => deck.notes > 0)
}

export interface AnkiNoteInfo {
  noteId: number
  modelName?: string
  fields?: Record<string, { value: string; order: number }>
}

export interface AnkiCard {
  card: ParsedCard
  image?: string
  audio?: string
}

const lines = (html: string) =>
  extractMedia(html)
    .text.split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

export function noteToCard(note: AnkiNoteInfo): AnkiCard {
  const fields = note.fields ?? {}
  const ordered = Object.values(fields)
    .sort((a, b) => a.order - b.order)
    .map((f) => f.value)
  const own = note.modelName === ANKI_MODEL
  const field = (name: string, index: number) => (own ? (fields[name]?.value ?? '') : (ordered[index] ?? ''))
  const front = extractMedia(field('Front', 0))
  const back = extractMedia(field('Back', 1))
  const media = own ? [extractMedia(field('Image', -1)), extractMedia(field('Audio', -1))] : [front, back]

  const card: ParsedCard = { front: front.text, back: back.text || front.text }
  if (own) {
    const hint = extractMedia(field('Hint', -1)).text
    const frontReading = extractMedia(field('Front reading', -1)).text
    const backReading = extractMedia(field('Back reading', -1)).text
    const examples = lines(field('Examples', -1))
    if (hint) card.hint = hint
    if (frontReading) card.frontReading = frontReading
    if (backReading) card.backReading = backReading
    if (examples.length) card.examples = examples
  }
  return {
    card,
    image: media.flatMap((m) => m.images).find((n) => mediaKind(n) === 'image'),
    audio: media.flatMap((m) => m.sounds).find((n) => mediaKind(n) === 'audio'),
  }
}

function fromBase64(data: string): Uint8Array {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function readMedia(anki: AnkiConnect, names: string[]): Promise<Map<string, MediaRef>> {
  const out = new Map<string, MediaRef>()
  for (const group of chunks(names, MEDIA_PER_READ)) {
    const replies = await anki.multi<string | false>(
      group.map((filename) => ({ action: 'retrieveMediaFile', params: { filename } })),
    )
    group.forEach((filename, i) => {
      const data = replies[i]?.result
      const kind = mediaKind(filename)
      if (typeof data === 'string' && kind) {
        out.set(filename, { filename, bytes: fromBase64(data), mime: mimeFor(filename), kind })
      }
    })
  }
  return out
}

export interface AnkiDeckRead {
  deck: ParsedDeck
  missingMedia: number
}

export async function readAnkiDeck(anki: AnkiConnect, name: string): Promise<AnkiDeckRead> {
  const ids = await anki.call<number[]>('findNotes', { query: deckQuery(name) })
  const cards: ParsedCard[] = []
  let missingMedia = 0
  for (const group of chunks(ids, NOTES_PER_READ)) {
    const notes = await anki.call<AnkiNoteInfo[]>('notesInfo', { notes: group })
    const read = notes.filter((n) => n.fields).map(noteToCard)
    const wanted = [...new Set(read.flatMap((r) => [r.image, r.audio]).filter((n): n is string => Boolean(n)))]
    const media = await readMedia(anki, wanted)
    for (const { card, image, audio } of read) {
      if (!card.front && !card.back) continue
      for (const [file, slot] of [
        [image, 'image'],
        [audio, 'audio'],
      ] as const) {
        if (!file) continue
        const ref = media.get(file)
        if (ref) card[slot] = ref
        else missingMedia++
      }
      cards.push(card)
    }
  }
  return { deck: { title: name, cards, tags: ['anki'] }, missingMedia }
}

export const ANKI_FIELDS = ['Front', 'Back', 'Hint', 'Front reading', 'Back reading', 'Examples', 'Image', 'Audio']

const FRONT_TEMPLATE = [
  '{{Image}}',
  '<div class="front">{{Front}}</div>',
  '{{#Front reading}}<div class="reading">{{Front reading}}</div>{{/Front reading}}',
  '{{#Hint}}<div class="hint">{{hint:Hint}}</div>{{/Hint}}',
].join('\n')

const BACK_TEMPLATE = [
  '{{FrontSide}}',
  '<hr id="answer">',
  '<div class="back">{{Back}}</div>',
  '{{#Back reading}}<div class="reading">{{Back reading}}</div>{{/Back reading}}',
  '{{Audio}}',
  '{{#Examples}}<div class="examples">{{Examples}}</div>{{/Examples}}',
].join('\n')

const CSS = [
  '.card { font-family: system-ui, sans-serif; font-size: 24px; text-align: center; }',
  '.front { font-weight: 600; }',
  '.reading, .hint, .examples { font-size: 16px; opacity: 0.7; margin-top: 8px; }',
  'img { max-width: 100%; max-height: 40vh; }',
].join('\n')

export function ankiModel() {
  return {
    modelName: ANKI_MODEL,
    inOrderFields: ANKI_FIELDS,
    css: CSS,
    cardTemplates: [{ Name: 'Card', Front: FRONT_TEMPLATE, Back: BACK_TEMPLATE }],
  }
}

export function escapeHtml(text: string | undefined): string {
  return (text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\r?\n/g, '<br>')
}

export function ankiDeckName(title: string): string {
  return title.replace(/::/g, ':').trim() || ANKI_MODEL
}

function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function mediaFilename(media: ExportedMedia): string {
  const ext = media.filename.split('.').pop() || 'bin'
  return `opendeck-${hash(media.base64)}.${ext}`
}

export interface AnkiNote {
  deckName: string
  modelName: string
  fields: Record<string, string>
  tags: string[]
  options: { allowDuplicate: boolean; duplicateScope: 'deck' }
  picture?: { filename: string; data: string; fields: string[] }[]
  audio?: { filename: string; data: string; fields: string[] }[]
}

export function cardToNote(card: ExportedCard, deckName: string): AnkiNote {
  const note: AnkiNote = {
    deckName,
    modelName: ANKI_MODEL,
    fields: {
      Front: escapeHtml(card.front),
      Back: escapeHtml(card.back),
      Hint: escapeHtml(card.hint),
      'Front reading': escapeHtml(card.frontReading),
      'Back reading': escapeHtml(card.backReading),
      Examples: (card.examples ?? []).map(escapeHtml).join('<br>'),
      Image: '',
      Audio: '',
    },
    tags: [ANKI_TAG],
    options: { allowDuplicate: false, duplicateScope: 'deck' },
  }
  if (card.image) note.picture = [{ filename: mediaFilename(card.image), data: card.image.base64, fields: ['Image'] }]
  if (card.audio) note.audio = [{ filename: mediaFilename(card.audio), data: card.audio.base64, fields: ['Audio'] }]
  return note
}

export interface SendResult {
  deckName: string
  added: number
  skipped: number
}

export async function sendToAnki(
  anki: AnkiConnect,
  deck: ExportedDeck,
  onProgress?: (done: number, total: number) => void,
): Promise<SendResult> {
  const models = await anki.call<string[]>('modelNames')
  if (!models.includes(ANKI_MODEL)) await anki.call('createModel', ankiModel())
  const deckName = ankiDeckName(deck.title)
  await anki.call('createDeck', { deck: deckName })

  const notes = deck.cards.map((c) => cardToNote(c, deckName))
  const addable = await anki.call<boolean[]>('canAddNotes', {
    notes: notes.map(({ picture: _picture, audio: _audio, ...rest }) => rest),
  })
  const fronts = new Set<string>()
  const pending = notes.filter((note, i) => {
    if (!addable[i] || fronts.has(note.fields.Front!)) return false
    fronts.add(note.fields.Front!)
    return true
  })

  let added = 0
  onProgress?.(0, pending.length)
  for (const group of chunks(pending, NOTES_PER_WRITE)) {
    const ids = await anki.call<(number | null)[]>('addNotes', { notes: group })
    added += ids.filter((id) => id != null).length
    onProgress?.(added, pending.length)
  }
  return { deckName, added, skipped: notes.length - added }
}
