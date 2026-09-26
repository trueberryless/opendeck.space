export const ROLES = ['creator', 'maintainer', 'contributor', 'translator', 'designer', 'tester'] as const
export type Role = (typeof ROLES)[number]

export const CREDITS_FILE = 'app/data/credits/credits.json'
export const HANDLE_FIELD = 'handle'
export const HANDLE_HEADING = 'ATproto handle (optional)'
export const MAX_NOTE_LENGTH = 40

const DID = /^did:(?:plc:[a-z2-7]{24}|web:[a-z0-9.:%-]+)$/
const HANDLE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const GITHUB = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i

export interface CreditEntry {
  did: string
  github?: string
  roles?: (Role | { role: Role; note?: string })[]
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function isDid(value: unknown): value is string {
  return typeof value === 'string' && DID.test(value)
}

export function isGithubUser(value: unknown): value is string {
  return typeof value === 'string' && GITHUB.test(value)
}

export function normalizeHandle(value: string): string | null {
  const handle = value
    .trim()
    .replace(/^(?:at:\/\/|@)/, '')
    .toLowerCase()
  return handle.length <= 253 && HANDLE.test(handle) ? handle : null
}

export function sameGithubUser(a: string | undefined, b: string | undefined): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase())
}
