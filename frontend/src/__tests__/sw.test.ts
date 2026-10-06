/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

// public/sw.js 를 브라우저 없이 실행해서 어떤 요청을 어떻게 다루는지 확인한다
const code = readFileSync('public/sw.js', 'utf8')

type Listener = (e: unknown) => void
function load(opts: { hostname?: string; fetchImpl?: (req: unknown) => Promise<unknown>; stored?: Record<string, unknown> } = {}) {
  const listeners = new Map<string, Listener>()
  const stored = new Map<string, unknown>(Object.entries(opts.stored ?? {}))
  const put = vi.fn()
  const matchOpts: ({ ignoreVary?: boolean } | undefined)[] = []
  const store = {
    match: async (k: unknown, o?: { ignoreVary?: boolean }) => (matchOpts.push(o), stored.get(typeof k === 'string' ? k : (k as { url: string }).url.replace('https://app.test', ''))),
    put: async (k: unknown, v: unknown) => {
      put(k, v)
      stored.set(typeof k === 'string' ? k : (k as { url: string }).url.replace('https://app.test', ''), v)
    },
    add: async () => undefined,
    keys: async () => [],
    delete: async () => true,
  }
  class FakeResponse {
    ok: boolean
    headers: { get: (n: string) => string | null }
    body: string
    constructor(body: string, init: { status?: number; type?: string } = {}) {
      this.body = body
      this.ok = (init.status ?? 200) < 400
      this.headers = { get: (n) => (n.toLowerCase() === 'content-type' ? (init.type ?? 'text/html') : null) }
    }
    clone() {
      return this
    }
    static error() {
      return new FakeResponse('error', { status: 500 })
    }
  }
  const self = {
    location: { hostname: opts.hostname ?? 'app.test', origin: 'https://app.test' },
    addEventListener: (t: string, fn: Listener) => listeners.set(t, fn),
    skipWaiting: () => undefined,
    clients: { claim: async () => undefined },
    registration: {},
  } as Record<string, unknown>
  const ctx = {
    self,
    caches: { open: async () => store, match: store.match, keys: async () => [], delete: async () => true },
    fetch: opts.fetchImpl ?? (async () => new FakeResponse('<html>net</html>')),
    Response: FakeResponse,
    URL,
    setTimeout,
    Promise,
  }
  runInNewContext(code, ctx)
  const route = self.__wbRoute as (m: string, h: string, o: string, u: string, nav?: boolean) => string | null
  const handle = async (url: string, mode = 'cors', method = 'GET') => {
    let result: Promise<FakeResponse> | undefined
    listeners.get('fetch')!({ request: { url: `https://app.test${url}`, mode, method }, respondWith: (p: Promise<FakeResponse>) => (result = p) })
    return result ? await result : undefined
  }
  return { route, handle, put, stored, FakeResponse, matchOpts }
}

describe('서비스워커: 어떤 요청을 다루나', () => {
  const { route } = load()
  const O = 'https://app.test'
  it('화면 문서는 shell, 해시 파일은 asset, 아이콘·둘러보기 그림은 static', () => {
    expect(route('GET', 'app.test', O, `${O}/events/1`, true)).toBe('shell')
    expect(route('GET', 'app.test', O, `${O}/assets/index-abc.js`)).toBe('asset')
    expect(route('GET', 'app.test', O, `${O}/icon-192.png`)).toBe('static')
    expect(route('GET', 'app.test', O, `${O}/tour/a.png`)).toBe('static')
  })
  it('로그인 데이터(/api/), 저장·삭제 요청, 다른 사이트, 개발 서버 소스, 서비스워커 자신은 건드리지 않는다', () => {
    expect(route('GET', 'app.test', O, `${O}/api/me`)).toBeNull()
    expect(route('GET', 'app.test', O, `${O}/api/weather`, true)).toBeNull()
    expect(route('POST', 'app.test', O, `${O}/assets/x.js`)).toBeNull()
    expect(route('GET', 'app.test', O, 'https://fonts.example.com/a.woff2')).toBeNull()
    expect(route('GET', 'localhost', O, `${O}/src/main.tsx`)).toBeNull() // 개발 서버의 소스 파일
    expect(route('GET', 'app.test', O, `${O}/sw.js`)).toBeNull()
    expect(route('GET', 'app.test', O, `${O}/manifest.webmanifest`)).toBeNull()
  })
})

describe('서비스워커: 화면 열기', () => {
  it('네트워크가 되면 새 화면을 쓰고 저장해 둔다', async () => {
    const t = load()
    const res = await t.handle('/home', 'navigate')
    expect(res?.body).toBe('<html>net</html>')
    expect(t.put).toHaveBeenCalledWith('/index.html', expect.anything())
  })
  it('네트워크가 안 되면 저장해 둔 화면을 보여준다', async () => {
    const t = load({ fetchImpl: async () => Promise.reject(new TypeError('offline')), stored: { '/index.html': { body: 'cached-shell' } } })
    const res = await t.handle('/home', 'navigate')
    expect(res).toMatchObject({ body: 'cached-shell' })
  })
  it('저장해 둔 화면도 없으면 오프라인 안내를 보여준다', async () => {
    const t = load({ fetchImpl: async () => Promise.reject(new TypeError('offline')), stored: { '/offline.html': { body: 'offline-page' } } })
    const res = await t.handle('/home', 'navigate')
    expect(res).toMatchObject({ body: 'offline-page' })
  })
  it('/api/ 요청은 서비스워커가 가로채지 않는다', async () => {
    const t = load()
    expect(await t.handle('/api/me')).toBeUndefined()
    expect(await t.handle('/api/me', 'navigate')).toBeUndefined()
  })
  it('해시 파일은 저장된 것을 먼저 쓴다', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, clone() { return this } }))
    const t = load({ fetchImpl, stored: { '/assets/index-abc.js': { body: 'cached-js' } } })
    const res = await t.handle('/assets/index-abc.js')
    expect(res).toMatchObject({ body: 'cached-js' })
    expect(fetchImpl).not.toHaveBeenCalled()
    // 서버가 Vary: Origin 을 붙여도 모듈(import) 요청이 저장분을 찾도록 Vary 는 무시한다(실제 브라우저에서 겪은 문제)
    expect(t.matchOpts[0]).toEqual({ ignoreVary: true })
  })
})
