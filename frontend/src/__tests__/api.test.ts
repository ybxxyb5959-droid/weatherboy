import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, errorMessage } from '../api'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('api (서버 호출)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('성공하면 JSON 을 돌려주고 쿠키(credentials)를 함께 보낸다', async () => {
    const f = vi.fn().mockResolvedValue(json({ ok: 1 }))
    vi.stubGlobal('fetch', f)
    await expect(api('GET', '/api/me')).resolves.toEqual({ ok: 1 })
    expect(f.mock.calls[0]![1]).toMatchObject({ method: 'GET', credentials: 'include' })
  })

  it('204 는 빈 값, 본문은 JSON 으로 보낸다', async () => {
    const f = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', f)
    await expect(api('DELETE', '/api/me')).resolves.toBeUndefined()
    await api('POST', '/api/x', { a: 1 })
    expect(f.mock.calls[1]![1]).toMatchObject({ body: '{"a":1}', headers: { 'Content-Type': 'application/json' } })
  })

  it('서버 오류 코드와 메시지를 ApiError 로 바꾼다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ code: 'RATE_LIMITED', message: '요청이 너무 많아요.' }, 429)))
    const e = await api('POST', '/api/x').catch((x: unknown) => x)
    expect(e).toBeInstanceOf(ApiError)
    expect(e).toMatchObject({ status: 429, code: 'RATE_LIMITED', message: '요청이 너무 많아요.' })
    expect(errorMessage(e)).toBe('요청이 너무 많아요.')
  })

  it('본문이 없는 오류에도 기본 문구를 쓴다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))
    const e = await api('POST', '/api/x').catch((x: unknown) => x)
    expect(e).toMatchObject({ status: 500, code: 'ERROR' })
    expect(errorMessage(new Error('x'))).toContain('문제가 생겼어요')
  })

  it('조회(GET)는 서버가 깨어나는 502 를 두 번까지 다시 시도한다', async () => {
    const f = vi.fn().mockResolvedValueOnce(json({}, 502)).mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({ ok: 1 }))
    vi.stubGlobal('fetch', f)
    const p = api('GET', '/api/me')
    await vi.runAllTimersAsync()
    await expect(p).resolves.toEqual({ ok: 1 })
    expect(f).toHaveBeenCalledTimes(3)
  })

  it('저장·삭제(POST)는 두 번 실행되지 않게 다시 시도하지 않는다', async () => {
    const f = vi.fn().mockResolvedValue(json({}, 502))
    vi.stubGlobal('fetch', f)
    await expect(api('POST', '/api/clothes', {})).rejects.toMatchObject({ status: 502 })
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('연결이 안 되면 NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))
    await expect(api('POST', '/api/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })

  it('시간 안에 응답이 없으면 TIMEOUT (AI 는 더 오래 기다린다)', async () => {
    const hang = (_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))
    vi.stubGlobal('fetch', vi.fn(hang))
    const p = api('POST', '/api/x', undefined, { timeoutMs: 1000 })
    const assertion = expect(p).rejects.toMatchObject({ code: 'TIMEOUT' })
    await vi.advanceTimersByTimeAsync(1100)
    await assertion
  })
})
