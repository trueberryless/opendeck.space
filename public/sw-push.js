self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'OpenDeck', {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/badge-96x96.png',
      tag: 'opendeck-reminder',
      data: { url: data.url || '/study' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/study'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => 'focus' in w)
      if (open) return open.focus().then((w) => w.navigate(url).catch(() => w))
      return self.clients.openWindow(url)
    }),
  )
})
