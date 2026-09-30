import { afterEach, describe, expect, it, vi } from 'vitest'

type Headers = Record<string, string>

async function metadata(headers: Headers) {
  const set = vi.fn()
  vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
  vi.stubGlobal('getRequestHeader', (_: unknown, name: string) => headers[name])
  vi.stubGlobal('setResponseHeaders', set)
  const handler = (await import('../../server/routes/oauth-client-metadata.json.get')).default as (e: unknown) => any
  return { body: handler({}), set }
}

afterEach(() => vi.resetModules())

describe('oauth client metadata route', () => {
  it('builds metadata for the forwarded https origin', async () => {
    const { body, set } = await metadata({ 'x-forwarded-host': 'opendeck.space, other', host: 'internal' })
    expect(body.client_id).toBe('https://opendeck.space/oauth-client-metadata.json')
    expect(body.client_name).toBe('OpenDeck')
    expect(body.redirect_uris).toContain('https://opendeck.space/')
    expect(set).toHaveBeenCalledWith({}, { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' })
  })

  it('uses http for loopback hosts', async () => {
    const { body } = await metadata({ host: '127.0.0.1:3000' })
    expect(JSON.stringify(body)).toContain('http://127.0.0.1:3000')
  })

  it('honours the forwarded protocol', async () => {
    const { body } = await metadata({ host: 'localhost:3000', 'x-forwarded-proto': 'https' })
    expect(JSON.stringify(body)).toContain('https://localhost:3000')
  })
})
