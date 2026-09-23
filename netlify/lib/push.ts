import { createHash } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import webpush from 'web-push'
import { isReminderDue, type ReminderSchedule } from '../../shared/reminders'

export interface StoredSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
  did: string
  timeZone: string
  title: string
  body: string
  updatedAt: string
}

const PUSH_HOSTS = ['fcm.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com']
const PROFILE_COLLECTION = 'space.opendeck.profile'
const MAX_TEXT = 200

export const store = () => getStore('push-subscriptions')

export function subscriptionKey(endpoint: string): string {
  return createHash('sha256').update(endpoint).digest('hex')
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null
}

function configureVapid(): boolean {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return false
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  return true
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format()
    return true
  } catch {
    return false
  }
}

function isPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' && PUSH_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))
  } catch {
    return false
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, MAX_TEXT) : null
}

export function parseSubscription(input: unknown): StoredSubscription | null {
  const body = input as Record<string, any> | null
  const endpoint = body?.subscription?.endpoint
  const keys = body?.subscription?.keys
  const did = body?.did
  const timeZone = body?.timeZone
  const title = text(body?.title)
  const message = text(body?.body)
  if (typeof endpoint !== 'string' || !isPushEndpoint(endpoint)) return null
  if (typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') return null
  if (typeof did !== 'string' || !/^did:(plc|web):[a-zA-Z0-9._:%-]+$/.test(did)) return null
  if (typeof timeZone !== 'string' || !isValidTimeZone(timeZone)) return null
  if (!title || !message) return null
  return {
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    did,
    timeZone,
    title,
    body: message,
    updatedAt: new Date().toISOString(),
  }
}

async function resolvePds(did: string): Promise<string | null> {
  const url = did.startsWith('did:plc:')
    ? `https://plc.directory/${did}`
    : `https://${decodeURIComponent(did.slice('did:web:'.length).split(':')[0] ?? '')}/.well-known/did.json`
  const res = await fetch(url)
  if (!res.ok) return null
  const doc = (await res.json()) as { service?: { id: string; serviceEndpoint: string }[] }
  return doc.service?.find((s) => s.id === '#atproto_pds')?.serviceEndpoint ?? null
}

async function fetchSchedule(did: string): Promise<ReminderSchedule | 'gone' | null> {
  const pds = await resolvePds(did)
  if (!pds) return null
  const res = await fetch(
    `${pds}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=${PROFILE_COLLECTION}&rkey=self`,
  )
  if (!res.ok) {
    const error = (await res.json().catch(() => null)) as { error?: string } | null
    return error?.error === 'RecordNotFound' ? 'gone' : null
  }
  const { value } = (await res.json()) as { value: ReminderSchedule }
  return value
}

export async function sendDueReminders(now: Date = new Date()): Promise<{ sent: number; removed: number }> {
  if (!configureVapid()) throw new Error('VAPID keys are not configured')
  const subscriptions = store()
  const { blobs } = await subscriptions.list()
  const byDid = new Map<string, { key: string; sub: StoredSubscription }[]>()
  for (const { key } of blobs) {
    const sub = (await subscriptions.get(key, { type: 'json' })) as StoredSubscription | null
    if (!sub) continue
    byDid.set(sub.did, [...(byDid.get(sub.did) ?? []), { key, sub }])
  }

  let sent = 0
  let removed = 0
  for (const [did, entries] of byDid) {
    const schedule = await fetchSchedule(did).catch(() => null)
    if (schedule === 'gone') {
      for (const { key } of entries) await subscriptions.delete(key)
      removed += entries.length
      continue
    }
    if (!schedule) continue
    for (const { key, sub } of entries) {
      if (!isReminderDue(schedule, sub.timeZone, now)) continue
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify({ title: sub.title, body: sub.body, url: '/study' }),
          { TTL: 60 * 60 },
        )
        sent++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await subscriptions.delete(key)
          removed++
        } else {
          console.error('[opendeck] push failed', status, err)
        }
      }
    }
  }
  return { sent, removed }
}
