import type { CardValue, ProgressValue, SessionValue } from '~/utils/records'
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

class OpenDeckDB extends Dexie {
  outboxProgress!: Table<OutboxProgress, string>
  cards!: Table<CachedCard, string>
  progress!: Table<CachedProgress, string>
  outboxSessions!: Table<OutboxSession, string>

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
  }
}

let _db: OpenDeckDB | null = null

export function getDb(): OpenDeckDB {
  if (!_db) _db = new OpenDeckDB()
  return _db
}

export async function clearLocalData(): Promise<void> {
  const db = getDb()
  await Promise.all(db.tables.map((t) => t.clear()))
}
