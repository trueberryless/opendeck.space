import { parseAtUri } from 'airspace'
import { collections } from '~~/shared/atproto/collections'
import {
  challengeWindow,
  entryDays,
  normalizeChallenge,
  normalizeEntry,
  sameDays,
  type ChallengeEntryValue,
  type ChallengeKind,
  type ChallengeValue,
} from '~/utils/challenges'
import { getBacklinkDids } from '~/utils/constellation'
import type { StudyDays } from '~/utils/tiers'

const ENTRY_SOURCE = `${collections.challengeEntry.nsid}:challenge`
const FOLLOW_SCAN_LIMIT = 40
const PARTICIPANT_LIMIT = 100
const SYNC_AFTER_END_MS = 2 * 86400000

export interface ChallengeView {
  uri: string
  did: string
  rkey: string
  value: ChallengeValue
}

export interface EntryView {
  uri: string
  did: string
  rkey: string
  value: ChallengeEntryValue
}

const challengeCache = new Map<string, Promise<ChallengeView | null>>()
let syncing: Promise<void> | null = null

function challengeUri(did: string, rkey: string): string {
  return `at://${did}/${collections.challenge.nsid}/${rkey}`
}

function toChallenge(did: string, rkey: string, raw: unknown): ChallengeView | null {
  const value = normalizeChallenge(raw)
  return value ? { uri: challengeUri(did, rkey), did, rkey, value } : null
}

function toEntry(did: string, r: { uri: string; rkey: string; value: unknown }): EntryView | null {
  const value = normalizeEntry(r.value)
  return value ? { uri: r.uri, did, rkey: r.rkey, value } : null
}

async function entriesOfDid(did: string): Promise<EntryView[]> {
  const list = await readAirspace(did).challengeEntry.list()
  return list.map((r) => toEntry(did, r)).filter((e): e is EntryView => e !== null)
}

export function useChallenges() {
  function get(did: string, rkey: string): Promise<ChallengeView | null> {
    const uri = challengeUri(did, rkey)
    let cached = challengeCache.get(uri)
    if (!cached) {
      cached = readAirspace(did)
        .challenge.get(rkey)
        .then((r) => (r ? toChallenge(did, rkey, r.value) : null))
        .catch(() => {
          challengeCache.delete(uri)
          return null
        })
      challengeCache.set(uri, cached)
    }
    return cached
  }

  function getByUri(uri: string): Promise<ChallengeView | null> {
    const { authority, rkey } = parseAtUri(uri)
    return authority && rkey ? get(authority, rkey) : Promise.resolve(null)
  }

  async function myEntries(): Promise<EntryView[]> {
    const did = useAuthUser().value?.did
    if (!did) return []
    const list = await requireAirspace().challengeEntry.list()
    return list.map((r) => toEntry(did, r)).filter((e): e is EntryView => e !== null)
  }

  async function join(challenge: ChallengeView): Promise<EntryView> {
    const did = useAuthUser().value!.did
    const existing = (await myEntries()).find((e) => e.value.challenge === challenge.uri)
    if (existing) return existing
    const studied = useMotivation().studied.value ?? {}
    const value: ChallengeEntryValue = {
      challenge: challenge.uri,
      days: entryDays(challenge.value, studied),
      createdAt: new Date().toISOString(),
    }
    const res = await requireAirspace().challengeEntry.create(value)
    return { uri: res.uri, did, rkey: res.rkey, value }
  }

  async function leave(entry: EntryView): Promise<void> {
    await requireAirspace().challengeEntry.delete(entry.rkey)
  }

  async function create(input: { title: string; kind: ChallengeKind; weeks: number }): Promise<ChallengeView> {
    const did = useAuthUser().value!.did
    const value: ChallengeValue = {
      title: input.title.trim(),
      kind: input.kind,
      ...challengeWindow(input.weeks),
      createdAt: new Date().toISOString(),
    }
    const res = await requireAirspace().challenge.create(value)
    const view: ChallengeView = { uri: challengeUri(did, res.rkey), did, rkey: res.rkey, value }
    challengeCache.set(view.uri, Promise.resolve(view))
    await join(view)
    return view
  }

  async function remove(challenge: ChallengeView): Promise<void> {
    const joined = (await myEntries()).filter((e) => e.value.challenge === challenge.uri)
    for (const entry of joined) await leave(entry)
    await requireAirspace().challenge.delete(challenge.rkey)
    challengeCache.delete(challenge.uri)
  }

  async function participants(challenge: ChallengeView): Promise<EntryView[]> {
    const me = useAuthUser().value?.did
    const linked = await getBacklinkDids(challenge.uri, ENTRY_SOURCE, { limit: PARTICIPANT_LIMIT })
      .then((page) => page.dids)
      .catch(() => [] as string[])
    const dids = [...new Set([challenge.did, ...(me ? [me] : []), ...linked])]
    const found = await Promise.all(
      dids.map((did) =>
        entriesOfDid(did)
          .then((entries) => entries.find((e) => e.value.challenge === challenge.uri) ?? null)
          .catch(() => null),
      ),
    )
    return found.filter((e): e is EntryView => e !== null)
  }

  async function mine(): Promise<{ challenge: ChallengeView; entry: EntryView }[]> {
    const entries = await myEntries()
    const rows = await Promise.all(
      entries.map(async (entry) => {
        const challenge = await getByUri(entry.value.challenge)
        return challenge ? { challenge, entry } : null
      }),
    )
    return rows
      .filter((r): r is { challenge: ChallengeView; entry: EntryView } => r !== null)
      .sort((a, b) => b.challenge.value.startsAt.localeCompare(a.challenge.value.startsAt))
  }

  async function fromFollows(): Promise<ChallengeView[]> {
    const follows = [...(await useSocial().listMyFollows()).keys()].slice(0, FOLLOW_SCAN_LIMIT)
    const lists = await Promise.all(
      follows.map((did) =>
        readAirspace(did)
          .challenge.list()
          .then((list) => list.map((r) => toChallenge(did, r.rkey, r.value)))
          .catch(() => []),
      ),
    )
    const now = Date.now()
    return lists
      .flat()
      .filter((c): c is ChallengeView => c !== null && new Date(c.value.endsAt).getTime() > now)
      .sort((a, b) => b.value.startsAt.localeCompare(a.value.startsAt))
  }

  async function syncNow(studied: StudyDays): Promise<void> {
    const now = Date.now()
    for (const entry of await myEntries()) {
      const challenge = await getByUri(entry.value.challenge)
      if (!challenge || now > new Date(challenge.value.endsAt).getTime() + SYNC_AFTER_END_MS) continue
      const days = entryDays(challenge.value, studied)
      if (sameDays(days, entry.value.days)) continue
      await requireAirspace().challengeEntry.put(entry.rkey, {
        ...entry.value,
        days,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  function sync(studied: StudyDays): Promise<void> {
    if (!useAirspace() || syncing) return syncing ?? Promise.resolve()
    syncing = syncNow(studied)
      .catch((err) => console.error('[opendeck] failed to sync challenge entries', err))
      .finally(() => (syncing = null))
    return syncing
  }

  return { get, getByUri, create, remove, join, leave, participants, mine, fromFollows, sync }
}
