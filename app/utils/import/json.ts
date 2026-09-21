import { mediaKind, type MediaRef, type ParsedCard, type ParsedDeck, type ParseResult } from './types'

export interface ExportedMedia {
  filename: string
  mime: string
  base64: string
}
export interface ExportedCard {
  front: string
  back: string
  hint?: string
  phonetic?: string
  examples?: string[]
  image?: ExportedMedia
  audio?: ExportedMedia
}
export interface ExportedDeck {
  title: string
  summary?: string
  sourceLang?: string
  targetLang?: string
  tags?: string[]
  cards: ExportedCard[]
}
export interface OpenDeckExport {
  app: 'opendeck'
  version: 1
  exportedAt: string
  decks: ExportedDeck[]
}

export function parseOpenDeckJson(text: string): ParseResult {
  const warnings: string[] = []
  let data: OpenDeckExport
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Not valid JSON.')
  }
  if (!Array.isArray(data?.decks)) throw new Error('Not an OpenDeck export.')

  const decks: ParsedDeck[] = data.decks.map((d) => ({
    title: d.title,
    summary: d.summary,
    sourceLang: d.sourceLang,
    targetLang: d.targetLang,
    tags: d.tags,
    cards: d.cards.map((c) => toCard(c, warnings)),
  }))
  return { decks, warnings }
}

function toCard(c: ExportedCard, warnings: string[]): ParsedCard {
  const card: ParsedCard = { front: c.front, back: c.back, hint: c.hint, phonetic: c.phonetic, examples: c.examples }
  const image = c.image ? toMedia(c.image, warnings) : undefined
  const audio = c.audio ? toMedia(c.audio, warnings) : undefined
  if (image) card.image = image
  if (audio) card.audio = audio
  return card
}

function toMedia(m: ExportedMedia, warnings: string[]): MediaRef | undefined {
  try {
    return {
      filename: m.filename,
      bytes: base64ToBytes(m.base64),
      mime: m.mime,
      kind: mediaKind(m.filename) ?? (m.mime.startsWith('audio') ? 'audio' : 'image'),
    }
  } catch {
    warnings.push(`Could not decode media ${m.filename}.`)
    return undefined
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
