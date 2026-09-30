import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const blobs = vi.hoisted(() => {
  const data = new Map<string, unknown>()
  return {
    data,
    store: {
      list: vi.fn(async () => ({ blobs: [...data.keys()].map((key) => ({ key })) })),
      get: vi.fn(async (key: string) => data.get(key) ?? null),
      setJSON: vi.fn(async (key: string, value: unknown) => void data.set(key, value)),
      delete: vi.fn(async (key: string) => void data.delete(key)),
    },
  }
})

const push = vi.hoisted(() => ({ setVapidDetails: vi.fn(), sendNotification: vi.fn() }))

vi.mock('@netlify/blobs', () => ({ getStore: () => blobs.store }))
vi.mock('web-push', () => ({ default: push }))

import { parseSubscription, sendDueReminders, subscriptionKey, vapidPublicKey } from '../../netlify/lib/push'
import subscribe from '../../netlify/functions/push-subscribe.mts'
import reminders, { config } from '../../netlify/functions/push-reminders.mts'

const valid = {
  subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } },
  did: 'did:plc:abcdefghijklmnopqrstuvwx',
  timeZone: 'UTC',
  title: ' Study ',
  body: 'Time to learn',
}

describe('parseSubscription', () => {
  it('accepts a valid subscription and trims text', () => {
    expect(parseSubscription(valid)).toMatchObject({
      endpoint: valid.subscription.endpoint,
      keys: { p256dh: 'p', auth: 'a' },
      did: valid.did,
      timeZone: 'UTC',
      title: 'Study',
      body: 'Time to learn',
    })
  })

  it('accepts subdomains of known push hosts', () => {
    const endpoint = 'https://updates.push.services.mozilla.com/wpush/v2/x'
    expect(parseSubscription({ ...valid, subscription: { ...valid.subscription, endpoint } })).not.toBeNull()
  })

  it.each([
    ['null body', null],
    [
      'non-https endpoint',
      { ...valid, subscription: { ...valid.subscription, endpoint: 'http://fcm.googleapis.com/x' } },
    ],
    [
      'unknown push host',
      { ...valid, subscription: { ...valid.subscription, endpoint: 'https://evil.example.com/x' } },
    ],
    [
      'lookalike host',
      { ...valid, subscription: { ...valid.subscription, endpoint: 'https://evilfcm.googleapis.com.evil.com/x' } },
    ],
    ['invalid endpoint', { ...valid, subscription: { ...valid.subscription, endpoint: 'nope' } }],
    ['missing keys', { ...valid, subscription: { endpoint: valid.subscription.endpoint, keys: {} } }],
    ['invalid did', { ...valid, did: 'did:key:x' }],
    ['invalid time zone', { ...valid, timeZone: 'Mars/Base' }],
    ['blank title', { ...valid, title: '  ' }],
    ['missing body', { ...valid, body: undefined }],
  ])('rejects %s', (_, input) => {
    expect(parseSubscription(input)).toBeNull()
  })

  it('caps the text length', () => {
    expect(parseSubscription({ ...valid, title: 'x'.repeat(500) })!.title).toHaveLength(200)
  })
})

describe('subscriptionKey', () => {
  it('is a stable sha-256 hex digest', () => {
    expect(subscriptionKey('a')).toMatch(/^[0-9a-f]{64}$/)
    expect(subscriptionKey('a')).toBe(subscriptionKey('a'))
    expect(subscriptionKey('a')).not.toBe(subscriptionKey('b'))
  })
})

describe('vapidPublicKey', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('reads the environment', () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', '')
    expect(vapidPublicKey()).toBe('')
    vi.stubEnv('VAPID_PUBLIC_KEY', 'pub')
    expect(vapidPublicKey()).toBe('pub')
  })
})

describe('push-subscribe', () => {
  beforeEach(() => {
    blobs.data.clear()
    vi.stubEnv('VAPID_PUBLIC_KEY', 'pub')
  })

  const call = (method: string, body?: unknown) =>
    subscribe(
      new Request('https://x.test/api', { method, body: body === undefined ? undefined : JSON.stringify(body) }),
    )

  it('is unavailable without keys', async () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', '')
    delete process.env.VAPID_PUBLIC_KEY
    expect((await call('GET')).status).toBe(503)
  })

  it('serves the public key', async () => {
    const res = await call('GET')
    expect(await res.json()).toEqual({ publicKey: 'pub' })
  })

  it('stores a valid subscription and rejects an invalid one', async () => {
    expect((await call('POST', valid)).status).toBe(204)
    expect(blobs.store.setJSON).toHaveBeenCalledWith(
      subscriptionKey(valid.subscription.endpoint),
      expect.objectContaining({ did: valid.did }),
    )
    expect((await call('POST', { nope: 1 })).status).toBe(400)
    expect((await subscribe(new Request('https://x.test', { method: 'POST', body: 'not json' }))).status).toBe(400)
  })

  it('removes a subscription by endpoint', async () => {
    expect((await call('DELETE', { endpoint: valid.subscription.endpoint })).status).toBe(204)
    expect(blobs.store.delete).toHaveBeenCalledWith(subscriptionKey(valid.subscription.endpoint))
    expect((await call('DELETE', {})).status).toBe(400)
  })

  it('rejects other methods', async () => {
    expect((await call('PUT', {})).status).toBe(405)
  })
})

describe('sendDueReminders', () => {
  const now = new Date('2026-06-15T19:10:00Z')
  const stored = { ...parseSubscription(valid)! }

  const respond = (routes: Record<string, () => Response>) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const route = Object.entries(routes).find(([prefix]) => url.startsWith(prefix))
        if (!route) throw new Error(`unexpected fetch ${url}`)
        return route[1]()
      }),
    )

  const directory = () => Response.json({ service: [{ id: '#atproto_pds', serviceEndpoint: 'https://pds.test' }] })
  const record = (value: object) => () => Response.json({ value })

  beforeEach(() => {
    blobs.data.clear()
    blobs.data.set('k1', stored)
    push.sendNotification.mockReset()
    push.setVapidDetails.mockReset()
    vi.stubEnv('VAPID_PUBLIC_KEY', 'pub')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv')
    vi.stubEnv('VAPID_SUBJECT', 'mailto:a@b.c')
  })

  it('refuses to run without vapid keys', async () => {
    delete process.env.VAPID_PRIVATE_KEY
    await expect(sendDueReminders(now)).rejects.toThrow('VAPID keys are not configured')
  })

  it('sends a due reminder', async () => {
    respond({ 'https://plc.directory': directory, 'https://pds.test': record({ reminderEnabled: true }) })
    expect(await sendDueReminders(now)).toEqual({ sent: 1, removed: 0 })
    expect(push.setVapidDetails).toHaveBeenCalledWith('mailto:a@b.c', 'pub', 'priv')
    expect(push.sendNotification).toHaveBeenCalledWith(
      { endpoint: stored.endpoint, keys: stored.keys },
      JSON.stringify({ title: 'Study', body: 'Time to learn', url: '/study' }),
      { TTL: 3600 },
    )
  })

  it('skips reminders that are not due or disabled', async () => {
    respond({
      'https://plc.directory': directory,
      'https://pds.test': record({ reminderEnabled: true, reminderHour: 8 }),
    })
    expect(await sendDueReminders(now)).toEqual({ sent: 0, removed: 0 })
    respond({ 'https://plc.directory': directory, 'https://pds.test': record({}) })
    expect(await sendDueReminders(now)).toEqual({ sent: 0, removed: 0 })
    expect(push.sendNotification).not.toHaveBeenCalled()
  })

  it('removes subscriptions of accounts whose profile record is gone', async () => {
    respond({
      'https://plc.directory': directory,
      'https://pds.test': () => Response.json({ error: 'RecordNotFound' }, { status: 400 }),
    })
    expect(await sendDueReminders(now)).toEqual({ sent: 0, removed: 1 })
    expect(blobs.data.size).toBe(0)
  })

  it('keeps subscriptions when the profile cannot be read', async () => {
    respond({ 'https://plc.directory': directory, 'https://pds.test': () => new Response('boom', { status: 500 }) })
    expect(await sendDueReminders(now)).toEqual({ sent: 0, removed: 0 })
    respond({ 'https://plc.directory': () => new Response('', { status: 404 }) })
    expect(await sendDueReminders(now)).toEqual({ sent: 0, removed: 0 })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    )
    expect(await sendDueReminders(now)).toEqual({ sent: 0, removed: 0 })
    expect(blobs.data.size).toBe(1)
  })

  it('removes expired push subscriptions but keeps others on other errors', async () => {
    respond({ 'https://plc.directory': directory, 'https://pds.test': record({ reminderEnabled: true }) })
    push.sendNotification.mockRejectedValueOnce({ statusCode: 410 })
    expect(await sendDueReminders(now)).toEqual({ sent: 0, removed: 1 })

    blobs.data.set('k1', stored)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    push.sendNotification.mockRejectedValueOnce({ statusCode: 500 })
    expect(await sendDueReminders(now)).toEqual({ sent: 0, removed: 0 })
    expect(blobs.data.size).toBe(1)
  })

  it('resolves did:web accounts and skips missing blobs', async () => {
    blobs.data.clear()
    blobs.data.set('web', { ...stored, did: 'did:web:example.com' })
    blobs.store.get.mockResolvedValueOnce(null)
    expect(await sendDueReminders(now)).toEqual({ sent: 0, removed: 0 })

    respond({
      'https://example.com/.well-known/did.json': directory,
      'https://pds.test': record({ reminderEnabled: true }),
    })
    expect(await sendDueReminders(now)).toEqual({ sent: 1, removed: 0 })
  })
})

describe('push-reminders', () => {
  it('runs hourly and logs the outcome', async () => {
    expect(config.schedule).toBe('@hourly')
    blobs.data.clear()
    vi.stubEnv('VAPID_PUBLIC_KEY', 'pub')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv')
    vi.stubEnv('VAPID_SUBJECT', 'mailto:a@b.c')
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    await reminders()
    expect(log).toHaveBeenCalledWith('[opendeck] reminders sent: 0, stale subscriptions removed: 0')
  })
})
