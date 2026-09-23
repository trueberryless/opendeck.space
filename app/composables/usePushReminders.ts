const ENDPOINT = '/.netlify/functions/push-subscribe'

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!import.meta.client || !('serviceWorker' in navigator) || !('PushManager' in window)) return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

export function usePushReminders() {
  async function subscribe(): Promise<boolean> {
    const did = useAuthUser().value?.did
    const reg = await registration()
    if (!did || !reg || !canNotify()) return false
    try {
      const keyRes = await fetch(ENDPOINT)
      if (!keyRes.ok) return false
      const { publicKey } = (await keyRes.json()) as { publicKey: string }
      const subscription =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) }))
      const { t } = useNuxtApp().$i18n
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          did,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          title: t('reminder.title'),
          body: t('reminder.body'),
        }),
      })
      return res.ok
    } catch (err) {
      console.error('[opendeck] push subscription failed', err)
      return false
    }
  }

  async function unsubscribe(): Promise<void> {
    const subscription = await (await registration())?.pushManager.getSubscription()
    if (!subscription) return
    try {
      await fetch(ENDPOINT, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })
    } catch (err) {
      console.error('[opendeck] push unsubscribe failed', err)
    }
    await subscription.unsubscribe().catch(() => false)
  }

  return { subscribe, unsubscribe }
}
