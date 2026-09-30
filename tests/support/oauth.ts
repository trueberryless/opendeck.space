import { vi } from 'vitest'

export const oauth = {
  init: vi.fn(async (): Promise<unknown> => null),
  signIn: vi.fn(async () => undefined),
  revoke: vi.fn(async () => undefined),
}

export const createBrowserOAuth = vi.fn(async (_options: unknown) => oauth)
