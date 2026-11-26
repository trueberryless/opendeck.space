import type { DeckView } from '~/composables/useDecks'
import type { ParseResult } from '~/utils/import/types'
import {
  AnkiConnectError,
  type AnkiDeck,
  type AnkiProblem,
  connectAnki,
  createAnkiConnect,
  listAnkiDecks,
  readAnkiDeck,
  sendToAnki,
  type SendResult,
} from '~/utils/ankiConnect'

export const ANKI_KEY_STORAGE = 'opendeck-anki-key'

export type AnkiStatus = 'idle' | 'connecting' | 'connected' | 'error'

function savedKey(): string {
  try {
    return localStorage.getItem(ANKI_KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

export function useAnkiConnect() {
  const status = useState<AnkiStatus>('opendeck-anki-status', () => 'idle')
  const problem = useState<AnkiProblem | null>('opendeck-anki-problem', () => null)
  const detail = useState('opendeck-anki-detail', () => '')
  const key = useState('opendeck-anki-key', savedKey)

  const client = () => createAnkiConnect({ key: key.value || undefined })

  function setKey(value: string) {
    key.value = value.trim()
    try {
      if (key.value) localStorage.setItem(ANKI_KEY_STORAGE, key.value)
      else localStorage.removeItem(ANKI_KEY_STORAGE)
    } catch {}
  }

  function record(err: unknown) {
    status.value = 'error'
    if (err instanceof AnkiConnectError) {
      problem.value = err.problem
      detail.value = err.problem === 'failed' ? err.message : ''
    } else {
      problem.value = 'failed'
      detail.value = String((err as Error)?.message ?? err)
    }
  }

  async function guarded<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      record(err)
      throw err
    }
  }

  async function connect(): Promise<boolean> {
    status.value = 'connecting'
    problem.value = null
    detail.value = ''
    try {
      await connectAnki(client(), Boolean(key.value))
      status.value = 'connected'
      return true
    } catch (err) {
      record(err)
      return false
    }
  }

  function listDecks(): Promise<AnkiDeck[]> {
    return guarded(() => listAnkiDecks(client()))
  }

  function readDecks(names: string[]): Promise<ParseResult> {
    return guarded(async () => {
      const anki = client()
      const result: ParseResult = { decks: [], warnings: [] }
      for (const name of names) {
        const { deck, missingMedia } = await readAnkiDeck(anki, name)
        result.decks.push(deck)
        if (missingMedia) result.warnings.push(`${name}: ${missingMedia} media file(s) were not found in Anki.`)
      }
      return result
    })
  }

  async function sendDeck(deck: DeckView, onProgress?: (done: number, total: number) => void): Promise<SendResult> {
    const exported = await useExport().exportDecks([deck], true)
    return guarded(() => sendToAnki(client(), exported.decks[0]!, onProgress))
  }

  return { status, problem, detail, key, setKey, connect, listDecks, readDecks, sendDeck }
}
