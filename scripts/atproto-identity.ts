import { resolveTxt } from 'node:dns/promises'
import { isDid, normalizeHandle } from '../shared/credits.ts'

const TIMEOUT_MS = 10_000

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'error' })
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

async function didFromDns(handle: string): Promise<string | null> {
  try {
    const records = (await resolveTxt(`_atproto.${handle}`)).map((parts) => parts.join(''))
    const dids = [...new Set(records.filter((r) => r.startsWith('did=')).map((r) => r.slice(4)))]
    return dids.length === 1 && isDid(dids[0]) ? dids[0] : null
  } catch {
    return null
  }
}

async function didFromWellKnown(handle: string): Promise<string | null> {
  const did = (await fetchText(`https://${handle}/.well-known/atproto-did`))?.trim()
  return isDid(did) ? did : null
}

async function claimsHandle(did: string, handle: string): Promise<boolean> {
  const host = did.slice('did:web:'.length)
  if (!did.startsWith('did:plc:') && !/^[a-z0-9.-]+$/.test(host)) return false
  const text = await fetchText(
    did.startsWith('did:plc:') ? `https://plc.directory/${did}` : `https://${host}/.well-known/did.json`,
  )
  if (!text) return false
  try {
    const doc = JSON.parse(text) as { id?: unknown; alsoKnownAs?: unknown }
    const aliases = Array.isArray(doc.alsoKnownAs) ? doc.alsoKnownAs : []
    return doc.id === did && aliases.some((a) => typeof a === 'string' && a.toLowerCase() === `at://${handle}`)
  } catch {
    return false
  }
}

export async function resolveHandle(input: string): Promise<{ handle: string; did: string } | null> {
  const handle = normalizeHandle(input)
  if (!handle) return null
  const did = (await didFromDns(handle)) ?? (await didFromWellKnown(handle))
  return did && (await claimsHandle(did, handle)) ? { handle, did } : null
}
