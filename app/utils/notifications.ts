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

export function showNotification(title: string, options?: NotificationOptions): void {
  if (!canNotify()) return
  try {
    new Notification(title, { icon: '/pwa-192x192.png', badge: '/pwa-192x192.png', ...options })
  } catch {}
}
