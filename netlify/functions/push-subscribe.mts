import { parseSubscription, store, subscriptionKey, vapidPublicKey } from '../lib/push'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

export default async (req: Request): Promise<Response> => {
  const publicKey = vapidPublicKey()
  if (!publicKey) return json({ error: 'Push reminders are not configured.' }, 503)

  if (req.method === 'GET') return json({ publicKey })

  const body = await req.json().catch(() => null)

  if (req.method === 'POST') {
    const sub = parseSubscription(body)
    if (!sub) return json({ error: 'Invalid subscription.' }, 400)
    await store().setJSON(subscriptionKey(sub.endpoint), sub)
    return new Response(null, { status: 204 })
  }

  if (req.method === 'DELETE') {
    const endpoint = (body as { endpoint?: unknown } | null)?.endpoint
    if (typeof endpoint !== 'string') return json({ error: 'Missing endpoint.' }, 400)
    await store().delete(subscriptionKey(endpoint))
    return new Response(null, { status: 204 })
  }

  return json({ error: 'Method not allowed.' }, 405)
}
