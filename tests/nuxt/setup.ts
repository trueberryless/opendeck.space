import 'fake-indexeddb/auto'
import { vi } from 'vitest'

vi.mock('airspace/oauth/browser', async () => {
  const { createBrowserOAuth } = await import('../support/oauth')
  return { createBrowserOAuth }
})
