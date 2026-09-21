export interface MediaRef {
  filename: string
  bytes: Uint8Array
  mime: string
  kind: 'image' | 'audio'
}

export interface ParsedCard {
  front: string
  back: string
  hint?: string
  phonetic?: string
  examples?: string[]
  image?: MediaRef
  audio?: MediaRef
}

export interface ParsedDeck {
  title: string
  summary?: string
  sourceLang?: string
  targetLang?: string
  tags?: string[]
  cards: ParsedCard[]
}

export interface ParseResult {
  decks: ParsedDeck[]
  warnings: string[]
}

const IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif',
}
const AUDIO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  webm: 'audio/webm',
}

export function mediaKind(filename: string): 'image' | 'audio' | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (ext in IMAGE_MIME) return 'image'
  if (ext in AUDIO_MIME) return 'audio'
  return null
}

export function mimeFor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_MIME[ext] ?? AUDIO_MIME[ext] ?? 'application/octet-stream'
}

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function totalCards(decks: ParsedDeck[]): number {
  return decks.reduce((n, d) => n + d.cards.length, 0)
}

export function totalMedia(decks: ParsedDeck[]): number {
  return decks.reduce((n, d) => n + d.cards.reduce((m, c) => m + (c.image ? 1 : 0) + (c.audio ? 1 : 0), 0), 0)
}
