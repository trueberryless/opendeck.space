import type { CardValue, DeckView } from '~/composables/useDecks'
import type { ExportedCard, ExportedDeck, ExportedMedia, OpenDeckExport } from '~/utils/import/json'

export function useExport() {
  const decks = useDecks()
  const media = useMedia()

  async function buildDeck(deck: DeckView, includeMedia: boolean): Promise<ExportedDeck> {
    const cards = await decks.listMyCards(deck.rkey, deck.visibility)
    const exportedCards = await Promise.all(cards.map((c) => buildCard(deck.author, c.value, includeMedia)))
    return {
      title: deck.value.title,
      summary: deck.value.summary,
      sourceLang: deck.value.sourceLang,
      targetLang: deck.value.targetLang,
      tags: deck.value.tags,
      cards: exportedCards,
    }
  }

  async function buildCard(did: string, card: CardValue, includeMedia: boolean): Promise<ExportedCard> {
    const ec: ExportedCard = {
      front: card.front,
      back: card.back,
      hint: card.hint,
      phonetic: card.phonetic,
      examples: card.examples,
    }
    if (includeMedia) {
      if (card.image) ec.image = await fetchMedia(did, card.image, 'image')
      if (card.audio) ec.audio = await fetchMedia(did, card.audio, 'audio')
    }
    return ec
  }

  async function fetchMedia(did: string, blob: unknown, kind: 'image' | 'audio'): Promise<ExportedMedia | undefined> {
    try {
      const url = await media.blobUrl(did, blob)
      if (!url) return undefined
      const resp = await fetch(url)
      const bytes = new Uint8Array(await resp.arrayBuffer())
      const mime = resp.headers.get('content-type') || (kind === 'audio' ? 'audio/mpeg' : 'image/jpeg')
      return { filename: `${kind}.${extFromMime(mime)}`, mime, base64: bytesToBase64(bytes) }
    } catch {
      return undefined
    }
  }

  async function exportDecks(list: DeckView[], includeMedia = true): Promise<OpenDeckExport> {
    const built = await Promise.all(list.map((d) => buildDeck(d, includeMedia)))
    return { app: 'opendeck', version: 1, exportedAt: new Date().toISOString(), decks: built }
  }

  async function exportAll(includeMedia = true): Promise<OpenDeckExport> {
    return exportDecks(await decks.listMyDecks(), includeMedia)
  }

  function download(data: OpenDeckExport, filename = 'opendeck-export.json') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return { exportDecks, exportAll, download }
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/mp4': 'm4a',
  }
  return map[mime] ?? 'bin'
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}
