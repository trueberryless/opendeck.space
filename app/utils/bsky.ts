const PUBLIC_APPVIEW = 'https://public.api.bsky.app'

export interface BskyProfile {
  did: string
  handle: string
  displayName?: string
  avatar?: string
  description?: string
  followersCount?: number
  followsCount?: number
}

function xrpc<T>(method: string, params: Record<string, string | number | undefined>): Promise<T> {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')
  return $fetch(`${PUBLIC_APPVIEW}/xrpc/${method}?${query}`) as Promise<T>
}

function didDocUrl(did: string): string | null {
  if (did.startsWith('did:plc:')) return `https://plc.directory/${did}`
  if (!did.startsWith('did:web:')) return null
  const [host, ...path] = did.slice('did:web:'.length).split(':').map(decodeURIComponent)
  return path.length ? `https://${host}/${path.join('/')}/did.json` : `https://${host}/.well-known/did.json`
}

async function resolveIdentity(actor: string): Promise<BskyProfile | null> {
  try {
    if (!actor.startsWith('did:')) {
      const { did } = await xrpc<{ did: string }>('com.atproto.identity.resolveHandle', { handle: actor })
      return { did, handle: actor }
    }
    const url = didDocUrl(actor)
    if (!url) return null
    const doc = (await $fetch(url)) as { alsoKnownAs?: string[] }
    const handle = doc.alsoKnownAs?.find((a) => a.startsWith('at://'))?.slice('at://'.length)
    return { did: actor, handle: handle ?? actor }
  } catch {
    return null
  }
}

export async function getBskyProfile(actor: string): Promise<BskyProfile | null> {
  try {
    return await xrpc<BskyProfile>('app.bsky.actor.getProfile', { actor })
  } catch {
    return resolveIdentity(actor)
  }
}

export async function resolveDid(actor: string): Promise<string | null> {
  if (actor.startsWith('did:')) return actor
  return (await getBskyProfile(actor))?.did ?? null
}

export async function getBskyProfiles(actors: string[]): Promise<BskyProfile[]> {
  if (actors.length === 0) return []
  const batches: string[][] = []
  for (let i = 0; i < actors.length; i += 25) batches.push(actors.slice(i, i + 25))
  const results = await Promise.all(
    batches.map(async (batch) => {
      try {
        const query = batch.map((a) => `actors=${encodeURIComponent(a)}`).join('&')
        const res = (await $fetch(`${PUBLIC_APPVIEW}/xrpc/app.bsky.actor.getProfiles?${query}`)) as {
          profiles: BskyProfile[]
        }
        return res.profiles
      } catch {
        return []
      }
    }),
  )
  return results.flat()
}

export async function searchBskyActors(q: string, limit = 20): Promise<BskyProfile[]> {
  if (!q.trim()) return []
  try {
    const res = await xrpc<{ actors: BskyProfile[] }>('app.bsky.actor.searchActors', { q, limit })
    return res.actors
  } catch {
    return []
  }
}

export async function searchBskyActorsTypeahead(q: string, limit = 8): Promise<BskyProfile[]> {
  if (!q.trim()) return []
  try {
    const res = await xrpc<{ actors: BskyProfile[] }>('app.bsky.actor.searchActorsTypeahead', { q, limit })
    return res.actors
  } catch {
    return []
  }
}
