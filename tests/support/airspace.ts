import { vi } from 'vitest'

const NSIDS = {
  deck: 'space.opendeck.deck',
  card: 'space.opendeck.card',
  progress: 'space.opendeck.progress',
  session: 'space.opendeck.session',
  follow: 'space.opendeck.follow',
  like: 'space.opendeck.like',
  signal: 'space.opendeck.signal',
  challenge: 'space.opendeck.challenge',
  challengeEntry: 'space.opendeck.challengeEntry',
} as const

type Name = keyof typeof NSIDS

interface FakeRecord {
  uri: string
  cid: string
  rkey: string
  author: string
  value: unknown
}

let counter = 0

function fakeCollection(did: string, nsid: string) {
  const rows = new Map<string, unknown>()
  const record = (rkey: string): FakeRecord => ({
    uri: `at://${did}/${nsid}/${rkey}`,
    cid: `cid-${rkey}`,
    rkey,
    author: did,
    value: rows.get(rkey),
  })
  const write = async (rkey: string, value: unknown) => {
    rows.set(rkey, structuredClone(value))
    return { uri: `at://${did}/${nsid}/${rkey}`, cid: `cid-${rkey}`, rkey }
  }
  return {
    rows,
    list: vi.fn(async () => [...rows.keys()].map(record)),
    get: vi.fn(async (rkey: string) => (rows.has(rkey) ? record(rkey) : null)),
    create: vi.fn(async (value: unknown) => write(`r${++counter}`, value)),
    put: vi.fn(write),
    delete: vi.fn(async (rkey: string) => void rows.delete(rkey)),
  }
}

type Collection = ReturnType<typeof fakeCollection>

function fakeProfile(did: string) {
  let value: unknown
  return {
    get: vi.fn(async () =>
      value === undefined
        ? null
        : { uri: `at://${did}/space.opendeck.profile/self`, cid: 'c', rkey: 'self', author: did, value },
    ),
    put: vi.fn(async (next: unknown) => void (value = structuredClone(next))),
    set: (next: unknown) => void (value = next),
  }
}

type Builder = Record<
  Name,
  { create: (v: unknown) => void; put: (k: string, v: unknown) => void; delete: (k: string) => void }
> & {
  profile: { delete: () => void }
}

function fakeBatch(targets: Record<Name, Collection>) {
  return vi.fn(async (fn: (b: Builder) => void) => {
    const ops: (() => Promise<unknown>)[] = []
    const builder = new Proxy(
      {},
      {
        get: (_, name: string) =>
          name === 'profile'
            ? { delete: () => undefined }
            : {
                create: (v: unknown) => ops.push(() => targets[name as Name].create(v)),
                put: (k: string, v: unknown) => ops.push(() => targets[name as Name].put(k, v)),
                delete: (k: string) => ops.push(() => targets[name as Name].delete(k)),
              },
      },
    ) as Builder
    fn(builder)
    for (const op of ops) await op()
  })
}

export function createFakeAirspace(did = 'did:plc:me') {
  const cols = Object.fromEntries(
    Object.entries(NSIDS).map(([name, nsid]) => [name, fakeCollection(did, nsid)]),
  ) as Record<Name, Collection>
  const vaultCols = Object.fromEntries(
    (['deck', 'card', 'progress', 'session'] as const).map((name) => [name, fakeCollection(did, NSIDS[name])]),
  ) as Record<'deck' | 'card' | 'progress' | 'session', Collection>

  const airspace = {
    ...cols,
    profile: fakeProfile(did),
    batch: fakeBatch(cols),
    vault: {
      ...vaultCols,
      supported: vi.fn(async () => true),
      batch: fakeBatch({ ...cols, ...vaultCols }),
      manage: {
        ensure: vi.fn(async () => undefined),
        exists: vi.fn(async () => true),
        delete: vi.fn(async () => undefined),
      },
    },
    blobs: {
      url: vi.fn(async (blob: unknown) =>
        blob ? `https://blobs.test/${(blob as { cid?: string }).cid ?? 'x'}` : null,
      ),
      upload: vi.fn(async (_data: unknown, opts?: { mimeType?: string }) => ({
        blob: { cid: `blob-${++counter}`, mimeType: opts?.mimeType },
      })),
    },
    identity: vi.fn(async () => ({ did, handle: 'me.test', service: 'https://pds.test' })),
  }
  return airspace
}

export type FakeAirspace = ReturnType<typeof createFakeAirspace>
