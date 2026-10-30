import { vi } from 'vitest'

export function createSession(did = 'did:plc:me') {
  return { did, getTokenInfo: vi.fn(async () => ({ expired: false })) }
}

export const oauth = {
  init: vi.fn(async (): Promise<unknown> => null),
  signIn: vi.fn(async () => undefined),
  revoke: vi.fn(async () => undefined),
  client: {
    readCallbackParams: vi.fn((): URLSearchParams | null => null),
    restore: vi.fn(async (did: string, _refresh?: boolean): Promise<unknown> => createSession(did)),
  },
}

export const createBrowserOAuth = vi.fn(async (_options: unknown) => oauth)
