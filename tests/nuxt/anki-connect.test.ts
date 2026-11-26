import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AnkiConnectPanel from '~/components/AnkiConnectPanel.vue'
import { ANKI_KEY_STORAGE } from '~/composables/useAnkiConnect'
import { createFakeAnki, type FakeAnkiOptions } from '../support/anki'
import { signIn } from '../support/session'
import '../support/reset'

function stubAnki(options: FakeAnkiOptions = {}) {
  const fake = createFakeAnki(options)
  vi.stubGlobal('fetch', vi.fn(fake.fetch))
  return fake
}

describe('useAnkiConnect', () => {
  it('connects and remembers the connection for the whole app', async () => {
    stubAnki()
    const anki = useAnkiConnect()
    await expect(anki.connect()).resolves.toBe(true)
    expect(useAnkiConnect().status.value).toBe('connected')
    expect(anki.problem.value).toBeNull()
  })

  it('reports why it could not connect', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    )
    const anki = useAnkiConnect()
    await expect(anki.connect()).resolves.toBe(false)
    expect(anki.status.value).toBe('error')
    expect(anki.problem.value).toBe('unreachable')
    expect(anki.detail.value).toBe('')
  })

  it('keeps the API key in this browser and sends it', async () => {
    const fake = stubAnki({ apiKey: 'secret' })
    const anki = useAnkiConnect()
    expect(await anki.connect()).toBe(false)
    expect(anki.problem.value).toBe('key')
    anki.setKey('  secret ')
    expect(localStorage.getItem(ANKI_KEY_STORAGE)).toBe('secret')
    expect(await anki.connect()).toBe(true)
    expect(fake.requests.at(-1)).toMatchObject({ action: 'version', key: 'secret' })
    anki.setKey('')
    expect(localStorage.getItem(ANKI_KEY_STORAGE)).toBeNull()
  })

  it('reads a saved API key', () => {
    localStorage.setItem(ANKI_KEY_STORAGE, 'saved')
    expect(useAnkiConnect().key.value).toBe('saved')
  })

  it('lists and reads decks, with a warning for missing media', async () => {
    stubAnki({
      notes: [
        { deck: 'Spanish', fields: { Front: 'hola', Back: 'hello' } },
        { deck: 'French', fields: { Front: '<img src="gone.png">chat', Back: 'cat' } },
      ],
    })
    const anki = useAnkiConnect()
    await expect(anki.listDecks()).resolves.toEqual([
      { name: 'French', notes: 1 },
      { name: 'Spanish', notes: 1 },
    ])
    const result = await anki.readDecks(['Spanish', 'French'])
    expect(result.decks.map((d) => [d.title, d.cards.length])).toEqual([
      ['Spanish', 1],
      ['French', 1],
    ])
    expect(result.warnings).toEqual(['French: 1 media file(s) were not found in Anki.'])
  })

  it('records Anki errors from later requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ result: null, error: 'collection is not available' }))),
    )
    const anki = useAnkiConnect()
    await expect(anki.listDecks()).rejects.toThrow('collection is not available')
    expect(anki.status.value).toBe('error')
    expect(anki.problem.value).toBe('failed')
    expect(anki.detail.value).toBe('collection is not available')
  })

  it('records unexpected errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ result: null, error: null }))),
    )
    const anki = useAnkiConnect()
    await expect(anki.listDecks()).rejects.toBeInstanceOf(TypeError)
    expect(anki.problem.value).toBe('failed')
    expect(anki.detail.value).not.toBe('')
  })

  it('sends an OpenDeck deck with its cards', async () => {
    signIn()
    const fake = stubAnki()
    const decks = useDecks()
    const deck = await decks.createDeck({ title: 'Spanish basics' }, 'public')
    await decks.createCard(deck.rkey, { front: 'hola', back: 'hello', hint: 'greeting' }, 'public')
    await decks.createCard(deck.rkey, { front: 'adiós', back: 'goodbye' }, 'public')
    const progress = vi.fn()
    const result = await useAnkiConnect().sendDeck(deck, progress)
    expect(result).toEqual({ deckName: 'Spanish basics', added: 2, skipped: 0 })
    expect(fake.notes.map((n) => [n.deck, n.modelName, n.fields.Front, n.fields.Hint])).toEqual([
      ['Spanish basics', 'OpenDeck', 'hola', 'greeting'],
      ['Spanish basics', 'OpenDeck', 'adiós', ''],
    ])
    expect(progress).toHaveBeenLastCalledWith(2, 2)
  })
})

describe('AnkiConnectPanel', () => {
  it('shows the setup steps with a link to the add-on', async () => {
    const wrapper = await mountSuspended(AnkiConnectPanel)
    expect(wrapper.text()).toContain('2055492159')
    expect(wrapper.find('a').attributes('href')).toBe('https://ankiweb.net/shared/info/2055492159')
  })

  it('connects and tells the parent', async () => {
    stubAnki()
    const wrapper = await mountSuspended(AnkiConnectPanel)
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('connected')).toHaveLength(1)
    expect(wrapper.text()).toContain('Connected to Anki')
  })

  it('asks for the API key when AnkiConnect needs one, then uses it', async () => {
    stubAnki({ apiKey: 'secret' })
    const wrapper = await mountSuspended(AnkiConnectPanel)
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('needs an API key')
    await wrapper.find('input[type="password"]').setValue('secret')
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('connected')).toHaveLength(1)
    expect(localStorage.getItem(ANKI_KEY_STORAGE)).toBe('secret')
  })
})
