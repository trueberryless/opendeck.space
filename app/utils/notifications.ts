export async function requestNotificationPermission(): Promise<boolean> {
  if (!import.meta.client || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    const result = await Notification.requestPermission()
    return result === 'granted'
  } catch {
    return false
  }
}

export function canNotify(): boolean {
  return import.meta.client && 'Notification' in window && Notification.permission === 'granted'
}

export async function showNotification(title: string, options?: NotificationOptions): Promise<void> {
  if (!canNotify()) return
  const merged: NotificationOptions = { icon: '/pwa-192x192.png', badge: '/badge-96x96.png', ...options }
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) return await registration.showNotification(title, merged)
    const notification = new Notification(title, merged)
    notification.addEventListener('click', () => {
      window.focus()
      notification.close()
    })
  } catch (err) {
    console.error('[opendeck] failed to show notification', err)
  }
}
