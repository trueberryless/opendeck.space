const now = () => new Date().toISOString()

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
    return list.map((r) => (r.value as { subject: string }).subject)
  }

  return { listMyFollows, follow, unfollow, listFollowingOf }
}
