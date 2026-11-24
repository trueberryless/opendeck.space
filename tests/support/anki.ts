interface FakeAnkiNote {
  noteId: number
  deck: string
  modelName: string
  fields: Record<string, string>
  tags: string[]
}

export interface FakeAnkiOptions {
  notes?: (Omit<FakeAnkiNote, 'noteId' | 'tags' | 'modelName'> & Partial<Pick<FakeAnkiNote, 'modelName' | 'tags'>>)[]
  decks?: string[]
  media?: Record<string, string>
  models?: string[]
  permission?: 'granted' | 'denied'
  version?: number
  apiKey?: string
  requireApikey?: boolean
}

interface Request {
  action: string
  version?: number
  params?: Record<string, any>
  key?: string
}

interface Reply {
  result: unknown
  error: string | null
}

const BASIC = ['Front', 'Back']

export function createFakeAnki(options: FakeAnkiOptions = {}) {
  let nextId = 1000
  const notes: FakeAnkiNote[] = (options.notes ?? []).map((n) => ({
    noteId: nextId++,
    deck: n.deck,
    fields: n.fields,
    modelName: n.modelName ?? 'Basic',
    tags: n.tags ?? [],
  }))
  const decks = new Set(['Default', ...(options.decks ?? []), ...notes.map((n) => n.deck)])
  const models = new Map<string, string[]>((options.models ?? ['Basic']).map((m) => [m, BASIC]))
  const media = new Map(Object.entries(options.media ?? {}))
  const requests: Request[] = []

  function deckOf(query: string): string {
    const match = /^deck:"((?:\\.|[^"\\])*)"/.exec(query)
    if (!match) throw new Error(`unsupported query: ${query}`)
    return match[1]!.replace(/\\(.)/g, '$1')
  }

  function canAdd(note: { deckName: string; fields: Record<string, string> }): boolean {
    const front = note.fields.Front ?? Object.values(note.fields)[0] ?? ''
    if (!front) return false
    return !notes.some((n) => n.deck === note.deckName && (n.fields.Front ?? '') === front)
  }

  function addNote(note: {
    deckName: string
    modelName: string
    fields: Record<string, string>
    tags?: string[]
    picture?: { filename: string; data: string; fields: string[] }[]
    audio?: { filename: string; data: string; fields: string[] }[]
  }): number {
    if (!decks.has(note.deckName)) throw new Error(`deck was not found: ${note.deckName}`)
    if (!models.has(note.modelName)) throw new Error(`model was not found: ${note.modelName}`)
    const fields = { ...note.fields }
    for (const file of note.picture ?? []) {
      media.set(file.filename, file.data)
      for (const f of file.fields) fields[f] = `${fields[f] ?? ''}<img src="${file.filename}">`
    }
    for (const file of note.audio ?? []) {
      media.set(file.filename, file.data)
      for (const f of file.fields) fields[f] = `${fields[f] ?? ''}[sound:${file.filename}]`
    }
    const stored = { noteId: nextId++, deck: note.deckName, modelName: note.modelName, fields, tags: note.tags ?? [] }
    notes.push(stored)
    return stored.noteId
  }

  function run(action: string, params: Record<string, any>): unknown {
    switch (action) {
      case 'version':
        return 6
      case 'deckNames':
        return [...decks]
      case 'createDeck':
        decks.add(params.deck)
        return 1
      case 'modelNames':
        return [...models.keys()]
      case 'createModel':
        models.set(params.modelName, params.inOrderFields)
        return {}
      case 'findNotes': {
        const deck = deckOf(params.query)
        return notes.filter((n) => n.deck === deck).map((n) => n.noteId)
      }
      case 'notesInfo':
        return (params.notes as number[]).map((id) => {
          const note = notes.find((n) => n.noteId === id)
          if (!note) return {}
          const order = models.get(note.modelName) ?? Object.keys(note.fields)
          const names = [...new Set([...order, ...Object.keys(note.fields)])]
          return {
            noteId: note.noteId,
            modelName: note.modelName,
            tags: note.tags,
            fields: Object.fromEntries(names.map((name, i) => [name, { value: note.fields[name] ?? '', order: i }])),
          }
        })
      case 'retrieveMediaFile':
        return media.get(params.filename) ?? false
      case 'canAddNotes':
        return (params.notes as { deckName: string; fields: Record<string, string> }[]).map(canAdd)
      case 'addNotes': {
        const batch = params.notes as Parameters<typeof addNote>[0][]
        if (!batch.every(canAdd)) throw new Error('cannot create note because it is a duplicate')
        return batch.map(addNote)
      }
      default:
        throw new Error(`unsupported action: ${action}`)
    }
  }

  function reply(request: Request): Reply {
    requests.push(request)
    if (request.action === 'requestPermission') {
      return options.permission === 'denied'
        ? { result: { permission: 'denied' }, error: null }
        : {
            result: {
              permission: 'granted',
              requireApikey: options.requireApikey ?? Boolean(options.apiKey),
              version: options.version ?? 6,
            },
            error: null,
          }
    }
    if (options.apiKey && request.key !== options.apiKey) {
      return { result: null, error: 'valid api key must be provided' }
    }
    try {
      if (request.action === 'multi') {
        return { result: ((request.params?.actions ?? []) as Request[]).map(reply), error: null }
      }
      return { result: run(request.action, request.params ?? {}), error: null }
    } catch (err) {
      return { result: null, error: (err as Error).message }
    }
  }

  async function fetch(_url: string | URL | globalThis.Request, init?: RequestInit): Promise<Response> {
    return new Response(JSON.stringify(reply(JSON.parse(String(init?.body)))))
  }

  return { notes, decks, models, media, requests, reply, fetch }
}

export type FakeAnki = ReturnType<typeof createFakeAnki>
