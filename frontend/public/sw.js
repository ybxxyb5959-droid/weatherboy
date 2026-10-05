// 서비스워커: 웹푸시를 받아 알림으로 보여주고, 누르면 해당 화면으로 이동한다.
// 서버가 보내는 payload: { title, body, url }
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || '뭐입을옷?'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      data: { url: data.url || '/' },
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // 진동(소리·헤드업 팝업은 폰의 알림 설정이 정한다). 같은 tag 는 알림창에서 하나로 합치되, 새로 와도 다시 울린다.
      vibrate: [200, 100, 200],
      tag: data.tag || undefined,
      renotify: !!data.tag,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          if ('navigate' in c) c.navigate(url)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
