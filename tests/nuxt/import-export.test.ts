import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ParsedDeck } from '~/utils/import/types'
import { signIn } from '../support/session'

const parsed = (title: string, cards = 3): ParsedDeck => ({
  title,
  summary: 's',
  tags: ['t'],
  cards: Array.from({ length: cards }, (_, i) => ({ front: `f${i}`, back: `b${i}` })),
})

describe('useImport', () => {
  it('creates decks and cards in batches and reports the result', async () => {
    const airspace = signIn()
    const { progress, runImport } = useImport()
    await runImport([parsed('A', 25), parsed('B', 1)], 'public')
    expect(progress.value).toMatchObject({
      status: 'done',
      totalDecks: 2,
      doneDecks: 2,
      totalCards: 26,
      doneCards: 26,
      errors: [],
    })
    expect(progress.value.created.map((c) => [c.title, c.actor])).toEqual([
      ['A', 'me.test'],
      ['B', 'me.test'],
    ])
    expect(airspace.batch).toHaveBeenCalledTimes(4)
    expect(airspace.card.rows.size).toBe(26)
  })

  it('imports into the private space', async () => {
    const airspace = signIn()
    await useImport().runImport([parsed('P', 2)], 'private')
    expect(airspace.vault.batch).toHaveBeenCalledTimes(1)
    expect(airspace.vault.card.rows.size).toBe(2)
  })

  it('uploads media before creating the cards', async () => {
    const airspace = signIn()
    const deck: ParsedDeck = {
      title: 'M',
      cards: [
        {
          front: 'a',
          back: 'b',
          image: { filename: 'x.png', bytes: new Uint8Array([1]), mime: 'image/png', kind: 'image' },
          audio: { filename: 'x.mp3', bytes: new Uint8Array([2]), mime: 'audio/mpeg', kind: 'audio' },
        },
      ],
    }
    const { progress, runImport } = useImport()
    await runImport([deck], 'public')
    expect(airspace.blobs.upload).toHaveBeenCalledTimes(2)
    expect(progress.value).toMatchObject({ doneMedia: 2, totalMedia: 2, status: 'done' })
    expect([...airspace.card.rows.values()][0]).toMatchObject({ image: expect.anything(), audio: expect.anything() })
  })

  it('reports an error and stops', async () => {
    const airspace = signIn()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    airspace.deck.create.mockRejectedValue(new Error('boom'))
    const { progress, runImport } = useImport()
    await runImport([parsed('A')], 'public')
    expect(progress.value).toMatchObject({ status: 'error', errors: ['boom'] })
  })

  it('can be cancelled and reset', async () => {
    const airspace = signIn()
    const imp = useImport()
    airspace.deck.create.mockImplementation(async () => {
      imp.cancel()
      return { uri: 'at://did:plc:me/space.opendeck.deck/x', cid: 'c', rkey: 'x' }
    })
    await imp.runImport([parsed('A', 30)], 'public')
    expect(imp.progress.value.status).toBe('cancelled')
    imp.reset()
    expect(imp.progress.value.status).toBe('idle')
  })

  describe('rate limits', () => {
    beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] }))
    afterEach(() => vi.useRealTimers())

    it('pauses and retries after a rate limit error', async () => {
      const airspace = signIn()
      airspace.deck.create.mockRejectedValueOnce({ status: 429, headers: { 'retry-after': '2' } })
      const { progress, runImport } = useImport()
      const run = runImport([parsed('A', 1)], 'public')
      await vi.advanceTimersByTimeAsync(0)
      await vi.waitFor(() => expect(progress.value.status).toBe('paused'))
      expect(progress.value.pauseSeconds).toBeGreaterThan(0)
      await vi.advanceTimersByTimeAsync(3000)
      await run
      expect(progress.value.status).toBe('done')
    })
  })
})

describe('useExport', () => {
  it('exports decks with cards and media', async () => {
    const airspace = signIn()
    const decks = useDecks()
    const deck = await decks.createDeck({ title: 'E', tags: ['x'] }, 'public')
    await decks.createCard(deck.rkey, { front: 'f', back: 'b', image: { cid: 'img' } as never, hint: 'h' }, 'public')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } })),
    )
    const data = await useExport().exportAll()
    expect(data).toMatchObject({ app: 'opendeck', version: 2, decks: [{ title: 'E', tags: ['x'] }] })
    const [card] = data.decks[0]!.cards
    expect(card).toMatchObject({ front: 'f', hint: 'h' })
    expect(card!.image).toMatchObject({ filename: 'image.png', mime: 'image/png', base64: btoa('\x01\x02\x03') })
    expect(airspace.blobs.url).toHaveBeenCalled()
  })

  it('can skip media and tolerates media that cannot be fetched', async () => {
    signIn()
    const decks = useDecks()
    const deck = await decks.createDeck({ title: 'E' }, 'public')
    await decks.createCard(
      deck.rkey,
      { front: 'f', back: 'b', image: { cid: 'img' } as never, audio: { cid: 'a' } as never },
      'public',
    )
    const withoutMedia = await useExport().exportAll(false)
    expect(withoutMedia.decks[0]!.cards[0]).not.toHaveProperty('image')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    )
    const failed = await useExport().exportAll(true)
    expect(failed.decks[0]!.cards[0]!.image).toBeUndefined()
  })

  it('downloads the export as a json file', () => {
    const click = vi.fn()
    const create = vi
      .spyOn(document, 'createElement')
      .mockReturnValue({ click, set href(_: string) {}, set download(_: string) {} } as never)
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }))
    useExport().download({ app: 'opendeck', version: 2, exportedAt: '', decks: [] })
    expect(create).toHaveBeenCalledWith('a')
    expect(click).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x')
  })
})

describe('useMedia', () => {
  it('uploads through the session client', async () => {
    const airspace = signIn()
    const media = useMedia()
    const blob = await media.uploadImage(new Uint8Array([1]), 'image/png')
    expect(blob.blob).toMatchObject({ mimeType: 'image/png' })
    await media.uploadAudio(new Uint8Array([1]), 'audio/mpeg')
    expect(airspace.blobs.upload).toHaveBeenCalledTimes(2)
  })

  it('resolves urls from my client, the offline cache or other people', async () => {
    const airspace = signIn()
    const media = useMedia()
    expect(await media.blobUrl('did:plc:me', null)).toBeNull()
    expect(await media.blobUrl('did:plc:me', { cid: 'abc' })).toBe('https://blobs.test/abc')

    airspace.blobs.url.mockRejectedValueOnce(new Error('x'))
    expect(await media.blobUrl('did:plc:me', { cid: 'abc' })).toBeNull()

    const createObjectURL = vi.fn(() => 'blob:cached')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    const { getDb } = await import('~/utils/db')
    const { cidFromBlob } = await import('airspace')
    const blob = { $type: 'blob', ref: { $link: 'bafkreiabc' }, mimeType: 'image/png', size: 1 }
    const cid = cidFromBlob(blob)
    if (cid) {
      await getDb().media.put({ cid, blob: new Blob(['x']) })
      expect(await media.blobUrl('did:plc:me', blob)).toBe('blob:cached')
    }
  })

  it('has no url without a client and only revokes blob urls', async () => {
    const media = useMedia()
    const { _setAirspace } = await import('~/composables/useAirspace')
    _setAirspace(null)
    expect(await media.blobUrl('did:plc:me', { cid: 'x' })).toBeNull()
    const revoke = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { revokeObjectURL: revoke }))
    media.releaseUrl('https://x')
    media.releaseUrl(null)
    media.releaseUrl('blob:y')
    expect(revoke).toHaveBeenCalledOnce()
  })
})
