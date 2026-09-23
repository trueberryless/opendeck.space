import { collections } from '~~/shared/atproto/collections'
import { getBacklinkDids, type BacklinkDidsPage } from '~/utils/constellation'

const now = () => new Date().toISOString()
const FOLLOW_SOURCE = `${collections.follow.nsid}:subject`

export function useSocial() {
  async function listMyFollows(): Promise<Map<string, string>> {
    const airspace = requireAirspace()
    const list = await airspace.follow.list()
    const map = new Map<string, string>()
    for (const r of list) map.set((r.value as { subject: string }).subject, r.rkey)
    return map
  }

  async function follow(did: string): Promise<string> {
    const res = await requireAirspace().follow.create({ subject: did, createdAt: now() })
    return res.rkey
  }

  async function unfollow(rkey: string): Promise<void> {
    await requireAirspace().follow.delete(rkey)
  }

  async function listFollowingOf(did: string): Promise<string[]> {
    const list = await readAirspace(did).follow.list()
    return [...new Set(list.map((r) => (r.value as { subject: string }).subject))]
  }

  function listFollowersOf(did: string, cursor?: string | null, limit = 50): Promise<BacklinkDidsPage> {
    return getBacklinkDids(did, FOLLOW_SOURCE, { cursor, limit })
  }

  async function countFollowersOf(did: string): Promise<number> {
    return (await getBacklinkDids(did, FOLLOW_SOURCE, { limit: 1 })).total
  }

  return { listMyFollows, follow, unfollow, listFollowingOf, listFollowersOf, countFollowersOf }
}
