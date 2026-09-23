const CONSTELLATION = 'https://constellation.microcosm.blue'
const USER_AGENT = 'OpenDeck (https://opendeck.space; @opendeck.space)'

export interface BacklinkDidsPage {
  total: number
  dids: string[]
  cursor: string | null
}

export async function getBacklinkDids(
  subject: string,
  source: string,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<BacklinkDidsPage> {
  const res = (await $fetch(`${CONSTELLATION}/xrpc/blue.microcosm.links.getBacklinkDids`, {
    headers: { 'User-Agent': USER_AGENT },
    query: {
      subject,
      source,
      limit: options.limit ?? 50,
      ...(options.cursor ? { cursor: options.cursor } : {}),
    },
  })) as { total: number; linking_dids: string[]; cursor?: string | null }
  return { total: res.total, dids: res.linking_dids, cursor: res.cursor ?? null }
}
