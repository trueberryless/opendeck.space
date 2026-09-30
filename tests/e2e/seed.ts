import type { Page } from '@playwright/test'
import { cardUri, deckUri, ME, type Seed } from './data'

const STORES: Record<string, { keyPath: string; indexes?: string[] }> = {
  outboxProgress: { keyPath: 'cardUri' },
  cards: { keyPath: 'uri', indexes: ['deckUri'] },
  progress: { keyPath: 'cardUri' },
  outboxSessions: { keyPath: 'rkey' },
  decks: { keyPath: 'uri', indexes: ['author'] },
  sessions: { keyPath: 'rkey' },
  media: { keyPath: 'cid' },
  offlineChoices: { keyPath: 'deckUri' },
  meta: { keyPath: 'key' },
}

function rows(seed: Seed) {
  return {
    decks: seed.decks.map((d) => ({
      uri: deckUri(d),
      cid: `cid-${d.rkey}`,
      rkey: d.rkey,
      author: ME.did,
      visibility: d.visibility ?? 'public',
      value: {
        title: d.title,
        sourceLang: d.sourceLang,
        targetLang: d.targetLang,
        createdAt: d.createdAt ?? '2026-01-01T00:00:00.000Z',
      },
    })),
    cards: seed.decks.flatMap((d) =>
      d.cards.map((c, order) => ({
        uri: cardUri(c),
        deckUri: deckUri(d),
        rkey: c.rkey,
        cid: `cid-${c.rkey}`,
        value: {
          deck: d.rkey,
          front: c.front,
          back: c.back,
          hint: c.hint,
          order,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      })),
    ),
    meta: [
      ...(seed.prefs ? [{ key: 'prefs', value: seed.prefs }] : []),
      { key: 'me', value: { did: ME.did, handle: ME.handle, displayName: 'Test Learner' } },
    ],
  }
}

export async function signInOffline(page: Page, seed: Seed) {
  await page.addInitScript(
    ({ identity }) => {
      try {
        if (!localStorage.getItem('opendeck-identity'))
          localStorage.setItem('opendeck-identity', JSON.stringify(identity))
      } catch {}
      Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false, configurable: true })
    },
    { identity: ME },
  )

  await page.goto('/terms')
  await page.evaluate(
    async ({ stores, data }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('opendeck', 30)
        request.addEventListener('upgradeneeded', () => {
          const db = request.result
          for (const [name, { keyPath, indexes }] of Object.entries(stores)) {
            const store = db.createObjectStore(name, { keyPath })
            for (const index of indexes ?? []) store.createIndex(index, index)
          }
        })
        request.addEventListener('error', () => reject(request.error))
        request.addEventListener('success', () => {
          const db = request.result
          const tx = db.transaction(Object.keys(data), 'readwrite')
          for (const [name, list] of Object.entries(data))
            for (const row of list as unknown[]) tx.objectStore(name).put(row)
          tx.addEventListener('complete', () => {
            db.close()
            resolve()
          })
          tx.addEventListener('error', () => reject(tx.error))
        })
      })
    },
    { stores: STORES, data: rows(seed) },
  )
}
