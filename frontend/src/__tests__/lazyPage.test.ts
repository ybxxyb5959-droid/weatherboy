import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lazyPage } from '../lib/lazyPage'

// React.lazy 가 돌려주는 객체의 _init 을 직접 불러 로딩 결과를 확인한다(브라우저 없이)
type LazyLike = { _payload: unknown; _init: (p: unknown) => unknown }
const run = (c: unknown) => {
  const l = c as LazyLike
  try {
    return l._init(l._payload)
  } catch (thrown) {
    return thrown // 아직 불러오는 중이면 Promise 를 던진다
  }
}

describe('lazyPage (화면별 코드 받기)', () => {
  const store = new Map<string, string>()
  const reload = vi.fn()
  beforeEach(() => {
    store.clear()
    reload.mockClear()
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) })
    vi.stubGlobal('window', { location: { reload } })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('받기에 실패하면 한 번만 새로고침한다(새 버전이 배포돼 옛 파일이 없어진 경우)', async () => {
    const C = lazyPage(() => Promise.reject(new Error('Failed to fetch dynamically imported module')))
    const p = run(C) as Promise<unknown>
    await Promise.race([p, new Promise((r) => setTimeout(r, 20))])
    expect(reload).toHaveBeenCalledTimes(1)
    expect(store.get('wb-chunk-reload')).toBe('1')
  })

  it('이미 한 번 새로고침했다면 다시 새로고침하지 않고 오류를 보여준다', async () => {
    store.set('wb-chunk-reload', '1')
    const C = lazyPage(() => Promise.reject(new Error('still missing')))
    const p = run(C) as Promise<unknown>
    await Promise.race([p.catch(() => undefined), new Promise((r) => setTimeout(r, 20))])
    expect(reload).not.toHaveBeenCalled()
    const again = run(C)
    expect(again).toBeInstanceOf(Error)
  })

  it('받기에 성공하면 새로고침 표시를 지운다', async () => {
    store.set('wb-chunk-reload', '1')
    const C = lazyPage(() => Promise.resolve({ default: () => null }))
    const p = run(C) as Promise<unknown>
    await p
    expect(store.has('wb-chunk-reload')).toBe(false)
  })
})
