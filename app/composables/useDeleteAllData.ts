import { collections } from '~~/shared/atproto/collections'
import { clearLocalData } from '~/utils/db'

export const DATA_DELETED_KEY = 'opendeck-data-deleted'

type CollectionName = keyof typeof collections

const DELETE_LAST: readonly CollectionName[] = ['deck', 'profile']
const BATCH_SIZE = 10
const DEVICE_KEYS = ['opendeck-accent', 'opendeck-last-reminder', 'opendeck-last-did', 'opendeck-install-dismissed']

interface BatchDelete {
  delete: (rkey?: string) => void
}

function deletionOrder(): CollectionName[] {
  const names = Object.keys(collections) as CollectionName[]
  return [...names.filter((n) => !DELETE_LAST.includes(n)), ...DELETE_LAST.filter((n) => names.includes(n))]
}

async function listRkeys(service: string, did: string, nsid: string): Promise<string[]> {
  const rkeys: string[] = []
  let cursor: string | undefined
  do {
    const url = new URL('/xrpc/com.atproto.repo.listRecords', service)
    url.searchParams.set('repo', did)
    url.searchParams.set('collection', nsid)
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('cursor', cursor)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`listRecords ${nsid} failed with ${res.status}`)
    const body = (await res.json()) as { records: { uri: string }[]; cursor?: string }
    for (const r of body.records) {
      const rkey = r.uri.split('/').pop()
      if (rkey) rkeys.push(rkey)
    }
    cursor = body.records.length ? body.cursor : undefined
  } while (cursor)
  return rkeys
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (;;) {
    try {
      return await fn()
    } catch (err) {
      const wait = retryAfterMs(err)
      if (wait == null) throw err
      await sleep(wait)
    }
  }
}

export function useDeleteAllData() {
  const running = useState('opendeck-delete-all-running', () => false)
  const done = useState('opendeck-delete-all-done', () => 0)
  const total = useState('opendeck-delete-all-total', () => 0)

  async function deleteVault(): Promise<boolean> {
    const vault = requireAirspace().vault
    const supported = await vault.supported().catch(() => false)
    if (!supported) return false
    const exists = await vault.manage.exists().catch(() => false)
    if (!exists) return false
    await withRetry(() => vault.manage.delete())
    return true
  }

  async function deleteAll(): Promise<void> {
    if (running.value) return
    const airspace = requireAirspace()
    running.value = true
    done.value = 0
    total.value = 0
    try {
      await clearLocalData()
      const { did, service } = await airspace.identity()

      const plan: { name: CollectionName; rkeys: string[] }[] = []
      for (const name of deletionOrder()) {
        const listed = await listRkeys(service, did, collections[name].nsid)
        const rkeys = collections[name].singleton ? listed.filter((k) => k === 'self') : listed
        if (rkeys.length) plan.push({ name, rkeys })
      }
      total.value = plan.reduce((n, p) => n + p.rkeys.length, 1)

      await deleteVault()
      done.value += 1

      for (const { name, rkeys } of plan) {
        for (let i = 0; i < rkeys.length; i += BATCH_SIZE) {
          const chunk = rkeys.slice(i, i + BATCH_SIZE)
          await withRetry(() =>
            airspace.batch((b) => {
              const target = b[name] as unknown as BatchDelete
              for (const rkey of chunk) {
                if (collections[name].singleton) target.delete()
                else target.delete(rkey)
              }
            }),
          )
          done.value += chunk.length
        }
      }

      try {
        for (const key of DEVICE_KEYS) localStorage.removeItem(key)
        sessionStorage.setItem(DATA_DELETED_KEY, '1')
      } catch {}
      await signOut()
    } finally {
      running.value = false
    }
  }

  return { running, done, total, deleteAll }
}
