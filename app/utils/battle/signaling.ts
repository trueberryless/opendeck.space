import { parseAtUri } from 'airspace'
import { toCommit, type Commit } from 'airspace/live'
import { collections } from '~~/shared/atproto/collections'
import { getBacklinkDids } from '~/utils/constellation'

const SIGNAL_NSID = collections.signal.nsid
const SIGNAL_SOURCE = `${SIGNAL_NSID}:subject`
const JETSTREAMS = [
  'wss://jetstream2.us-east.bsky.network',
  'wss://jetstream1.us-east.bsky.network',
  'wss://jetstream1.us-west.bsky.network',
  'wss://jetstream2.us-west.bsky.network',
]
const POLL_MS = 4000
const MAX_AGE_MS = 10 * 60 * 1000
const MAX_RETRY_MS = 30000

export interface Signal {
  did: string
  rkey: string
  uri: string
  payload: string
}

export function battleUri(hostDid: string, id: string): string {
  return `at://${hostDid}/space.opendeck.battle/${id}`
}

export async function sendSignal(subject: string, payload: string): Promise<Signal> {
  const res = await requireAirspace().signal.create({ subject, payload, createdAt: new Date().toISOString() })
  return { did: parseAtUri(res.uri).authority, rkey: res.rkey, uri: res.uri, payload }
}

export async function deleteSignal(rkey: string): Promise<void> {
  try {
    await requireAirspace().signal.delete(rkey)
  } catch (err) {
    console.error('[opendeck] failed to delete a battle signal', err)
  }
}

function isFresh(createdAt: unknown): boolean {
  const time = typeof createdAt === 'string' ? new Date(createdAt).getTime() : Number.NaN
  return Number.isFinite(time) && Date.now() - time < MAX_AGE_MS
}

function stream(did: string | undefined, onCommit: (commit: Commit) => void): () => void {
  let socket: WebSocket | null = null
  let failures = 0
  let closed = false
  let retry: ReturnType<typeof setTimeout> | undefined

  const connect = () => {
    const url = new URL('/subscribe', JETSTREAMS[failures % JETSTREAMS.length])
    url.searchParams.append('wantedCollections', SIGNAL_NSID)
    if (did) url.searchParams.append('wantedDids', did)
    socket = new WebSocket(url)
    socket.addEventListener('open', () => (failures = 0))
    socket.addEventListener('message', (event) => {
      const commit = toCommit(String(event.data))
      if (commit) onCommit(commit)
    })
    socket.addEventListener('close', () => {
      if (closed) return
      failures++
      retry = setTimeout(connect, Math.min(MAX_RETRY_MS, 500 * 2 ** failures))
    })
  }

  connect()
  return () => {
    closed = true
    clearTimeout(retry)
    socket?.close()
  }
}

export function watchSignals(subject: string, onSignal: (signal: Signal) => void, from?: string): () => void {
  const seen = new Set<string>()
  let closed = false

  const deliver = (did: string, rkey: string, value: unknown) => {
    const v = (value ?? {}) as { subject?: unknown; payload?: unknown; createdAt?: unknown }
    if (closed || v.subject !== subject || typeof v.payload !== 'string' || !isFresh(v.createdAt)) return
    const uri = `at://${did}/${SIGNAL_NSID}/${rkey}`
    if (seen.has(uri)) return
    seen.add(uri)
    onSignal({ did, rkey, uri, payload: v.payload })
  }

  const stopStream = stream(from, (commit) => {
    if (commit.operation !== 'delete' && commit.record) deliver(commit.did, commit.rkey, commit.record)
  })

  const poll = async () => {
    const dids = from
      ? [from]
      : await getBacklinkDids(subject, SIGNAL_SOURCE, { limit: 50 })
          .then((page) => page.dids)
          .catch(() => [] as string[])
    await Promise.all(
      dids.map((did) =>
        readAirspace(did)
          .signal.list()
          .then((list) => list.forEach((r) => deliver(did, r.rkey, r.value)))
          .catch(() => undefined),
      ),
    )
  }
  const timer = setInterval(() => void poll(), POLL_MS)
  void poll()

  return () => {
    closed = true
    clearInterval(timer)
    stopStream()
  }
}
