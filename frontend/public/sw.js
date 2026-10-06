// 서비스워커: ① 화면(앱 껍데기)을 저장해 두어 오프라인이거나 연결이 느려도 앱이 열리게 하고, ② 웹푸시를 받아 알림으로 보여준다.
// 저장하는 것: 화면 문서(index.html), /assets/ 아래 해시가 붙은 파일, 아이콘·둘러보기 그림, 오프라인 안내(offline.html).
// 저장하지 않는 것: /api/ 응답(로그인한 사용자의 데이터라 남기지 않는다), 다른 사이트 파일. (개발 서버의 /src/ 파일은 해당 경로가 아니라 저장되지 않는다)
// 로직을 바꾸면 VERSION 을 올린다(옛 저장분이 지워진다).
const VERSION = 'v1'
const SHELL = `wb-shell-${VERSION}`
const ASSETS = `wb-assets-${VERSION}`
// 빌드할 때 vite.config.ts 가 /assets/ 아래 JS·CSS 목록으로 채운다(화면별로 나뉜 조각까지 미리 받아 두어야 안 가 본 화면도 오프라인에서 열린다)
const PRECACHE = [] /*WB_PRECACHE*/
// 서버가 Vary: Origin 을 붙이면 모듈(import) 요청과 미리 받아 둔 요청이 다르게 취급돼 저장분을 못 찾는다. 해시 파일은 내용이 같으니 Vary 는 무시한다.
const MATCH = { ignoreVary: true }
const MAX_ASSETS = 220 // 새 버전을 올릴 때마다 해시 파일이 늘어서 오래된 것부터 지운다

/** 이 요청을 어떻게 다룰지(navigate: 주소창·링크로 화면을 여는 요청): 'shell'(화면 문서) | 'asset'(해시 파일, 저장 우선) | 'static'(아이콘 등) | null(건드리지 않음) */
function route(method, hostname, origin, url, navigate) {
  if (method !== 'GET') return null
  const u = new URL(url)
  if (u.origin !== origin) return null
  if (u.pathname.startsWith('/api/') || u.pathname === '/sw.js' || u.pathname === '/manifest.webmanifest') return null
  if (navigate) return 'shell'
  if (u.pathname.startsWith('/assets/')) return 'asset'
  if (/^\/(icon-\d+\.png|favicon\.svg|icons\.svg|tour\/)/.test(u.pathname)) return 'static'
  return null
}
self.__wbRoute = route

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    Promise.all([
      caches.open(SHELL).then((c) => c.add('/offline.html')).catch(() => undefined),
      caches.open(ASSETS).then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u)))).catch(() => undefined),
    ]),
  )
})
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith('wb-') && n !== SHELL && n !== ASSETS).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  ),
)

async function trim(cache, max) {
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i])
}

// 화면 문서: 네트워크 우선(항상 최신), 느리거나 안 되면 저장해 둔 화면, 그것도 없으면 오프라인 안내
async function shell(req) {
  try {
    const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 6000))])
    if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
      const copy = res.clone()
      caches.open(SHELL).then((c) => c.put('/index.html', copy)).catch(() => undefined)
    }
    return res
  } catch {
    return (await caches.match('/index.html')) || (await caches.match('/offline.html')) || Response.error()
  }
}

// 해시 파일(내용이 바뀌면 이름이 바뀜): 저장된 것을 우선 쓴다
async function asset(req) {
  const cache = await caches.open(ASSETS)
  const hit = await cache.match(req, MATCH)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) {
    cache.put(req, res.clone()).then(() => trim(cache, MAX_ASSETS)).catch(() => undefined)
  }
  return res
}

// 아이콘 등: 저장된 것을 바로 보여주고 뒤에서 새로 받아 둔다
async function stat(req) {
  const cache = await caches.open(ASSETS)
  const hit = await cache.match(req, MATCH)
  const net = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone()).catch(() => undefined)
      return res
    })
    .catch(() => undefined)
  return hit || (await net) || Response.error()
}
self.addEventListener('fetch', (event) => {
  const req = event.request
  const kind = route(req.method, self.location.hostname, self.location.origin, req.url, req.mode === 'navigate')
  if (kind === 'shell') event.respondWith(shell(req))
  else if (kind === 'asset') event.respondWith(asset(req))
  else if (kind === 'static') event.respondWith(stat(req))
})

// 웹푸시: 서버가 보내는 payload: { title, body, url }
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
