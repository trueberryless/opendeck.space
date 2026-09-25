import type { Airspace } from 'airspace'
import { createAirspace } from 'airspace'
import type { BrowserOAuth } from 'airspace/oauth/browser'
import { collections, spaces } from '~~/shared/atproto/collections'

export type OpenDeckAirspace = Airspace<typeof collections, typeof spaces>

export const SIGNIN_HANDLE_KEY = 'opendeck-signin-handle'
export const SIGNIN_RETRY_KEY = 'opendeck-signin-retried'
export const SIGNIN_REDIRECT_KEY = 'opendeck-signin-redirect'

let _resolveAuthReady!: () => void
export const authReady: Promise<void> = new Promise((resolve) => {
  _resolveAuthReady = resolve
})
export function _markAuthReady(): void {
  _resolveAuthReady()
}

let _oauth: BrowserOAuth | null = null
let _airspace: OpenDeckAirspace | null = null

export function _setOAuth(client: BrowserOAuth | null) {
  _oauth = client
}

export function _setAirspace(client: OpenDeckAirspace | null) {
  _airspace = client
}

export interface AuthUser {
  did: string
  handle: string | null
}

export function useAuthUser() {
  return useState<AuthUser | null>('opendeck-auth', () => null)
}

export function useHydrated() {
  return useState('opendeck-hydrated', () => false)
}

export function useIsLoggedIn() {
  const user = useAuthUser()
  const hydrated = useHydrated()
  return computed(() => hydrated.value && Boolean(user.value))
}

export function useOAuth(): BrowserOAuth | null {
  return _oauth
}

export function useAirspace(): OpenDeckAirspace | null {
  return _airspace
}

export function requireAirspace(): OpenDeckAirspace {
  if (!_airspace) throw new Error('OpenDeck: not authenticated')
  return _airspace
}

const _readClients = new Map<string, OpenDeckAirspace>()

export function readAirspace(did: string): OpenDeckAirspace {
  let client = _readClients.get(did)
  if (!client) {
    client = createAirspace({ identity: did, collections, spaces })
    _readClients.set(did, client)
  }
  return client
}

export async function signOut(): Promise<void> {
  const oauth = _oauth
  const user = useAuthUser()
  await usePushReminders().unsubscribe()
  try {
    if (oauth && user.value) await oauth.revoke(user.value.did)
  } catch {}
  if (import.meta.client) window.location.href = '/'
}
