import type { CardValue, DeckValue, ProgressValue, SessionValue, Visibility } from '~/utils/records'
import Dexie, { type Table } from 'dexie'

export interface OutboxProgress {
  cardUri: string
  cardRkey: string
  progressRkey: string | null
  value: ProgressValue
  queuedAt: string
}

export interface OutboxSession {
  rkey: string
  open: boolean
  value: SessionValue
}

export interface CachedCard {
  uri: string
  deckUri: string
  rkey: string
  cid: string
  value: CardValue
}

export interface CachedProgress {
  cardUri: string
  rkey: string
  value: ProgressValue
}

export interface CachedDeck {
  uri: string
  cid: string
  rkey: string
  author: string
  value: DeckValue
  visibility: Visibility
}

export interface CachedSession {
  rkey: string
  value: SessionValue
}

export interface CachedMedia {
  cid: string
  blob: Blob
}

export interface OfflineChoice {
  deckUri: string
  keep: boolean
}

export interface MetaEntry {
  key: string
  value: unknown
}

class OpenDeckDB extends Dexie {
  outboxProgress!: Table<OutboxProgress, string>
  cards!: Table<CachedCard, string>
  progress!: Table<CachedProgress, string>
  outboxSessions!: Table<OutboxSession, string>
  decks!: Table<CachedDeck, string>
  sessions!: Table<CachedSession, string>
  media!: Table<CachedMedia, string>
  offlineChoices!: Table<OfflineChoice, string>
  meta!: Table<MetaEntry, string>

  constructor() {
    super('opendeck')
    this.version(1).stores({
      outboxProgress: 'cardUri',
      cards: 'uri, deckUri',
      progress: 'cardUri',
    })
    this.version(2).stores({
      outboxSessions: 'rkey',
    })
    this.version(3).stores({
      decks: 'uri, author',
      sessions: 'rkey',
      media: 'cid',
      offlineChoices: 'deckUri',
      meta: 'key',
    })
  }
}

let _db: OpenDeckDB | null = null

export function getDb(): OpenDeckDB {
  if (!_db) _db = new OpenDeckDB()
  return _db
}

export function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  try {
    return (await getDb().meta.get(key))?.value as T | undefined
  } catch {
    return undefined
  }
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  try {
    await getDb().meta.put({ key, value: toPlain(value) })
  } catch (err) {
    console.error('[opendeck] failed to cache', key, err)
  }
}

export async function clearLocalData(): Promise<void> {
  const db = getDb()
  await Promise.all(db.tables.map((t) => t.clear()))
}
