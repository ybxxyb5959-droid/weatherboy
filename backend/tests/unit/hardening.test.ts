import { describe, expect, it, vi } from 'vitest'
import type { Request } from 'express'
import { RENEW_AFTER_MS, SESSION_MAX_AGE_MS, renewSession } from '../../src/api/middleware/sessionRenew.js'
import { maskQuery, maskedReqSerializer } from '../../src/utils/maskUrl.js'
import { networkInfo } from '../../src/services/admin/opsChecks.js'
import { trustProxyHops } from '../../src/utils/trustProxy.js'

describe('로그인 유지(세션 연장)', () => {
  const run = (session: object | undefined) => {
    const next = vi.fn()
    renewSession({ session } as unknown as Request, {} as never, next)
    expect(next).toHaveBeenCalledTimes(1)
  }

  it('로그인한 사용자는 처음 요청에서 기간이 30일로 연장되고 시각이 기록된다', () => {
    const session = { userId: 'u1', cookie: { maxAge: 5 } as { maxAge: number }, renewedAt: undefined as number | undefined }
    run(session)
    expect(session.cookie.maxAge).toBe(SESSION_MAX_AGE_MS)
    expect(session.renewedAt).toBeGreaterThan(Date.now() - 1000)
  })

  it('방금 연장했으면 다시 건드리지 않는다(저장소 쓰기를 줄인다)', () => {
    const recent = Date.now() - 60_000
    const session = { userId: 'u1', cookie: { maxAge: 123 }, renewedAt: recent }
    run(session)
    expect(session.renewedAt).toBe(recent)
    expect(session.cookie.maxAge).toBe(123)
  })

  it('12시간이 지나면 다시 연장한다', () => {
    const session = { userId: 'u1', cookie: { maxAge: 123 }, renewedAt: Date.now() - RENEW_AFTER_MS - 1000 }
    run(session)
    expect(session.cookie.maxAge).toBe(SESSION_MAX_AGE_MS)
  })

  it('로그인하지 않은 방문자의 세션은 만들지도 건드리지도 않는다', () => {
    const session = { cookie: { maxAge: 123 } } as { cookie: { maxAge: number }; renewedAt?: number }
    run(session)
    expect(session.renewedAt).toBeUndefined()
    run(undefined)
  })
})

describe('요청 로그에서 쿼리 값 가리기', () => {
  it('값은 가리고 항목 이름만 남긴다', () => {
    expect(maskQuery('/api/places/reverse?lat=37.5&lng=127.03')).toBe('/api/places/reverse?lat=***&lng=***')
    expect(maskQuery('/api/auth/kakao/callback?code=abc123&state=xyz')).toBe('/api/auth/kakao/callback?code=***&state=***')
  })
  it('쿼리가 없으면 그대로, 값 없는 키·빈 쿼리도 안전하다', () => {
    expect(maskQuery('/api/me')).toBe('/api/me')
    expect(maskQuery('/x?')).toBe('/x')
    expect(maskQuery('/x?flag&a=1')).toBe('/x?flag=***&a=***')
    expect(maskQuery(undefined)).toBeUndefined()
  })
  it('로그 직렬화에서 url 과 query 모두 값이 없다', () => {
    const req = { id: 1, method: 'GET', url: '/api/places/reverse?lat=37.5&lng=127', query: { lat: '37.5' }, headers: {}, socket: { remoteAddress: '1.2.3.4', remotePort: 1 } } as unknown as Parameters<typeof maskedReqSerializer>[0]
    const out = maskedReqSerializer(req)
    expect(out.url).toBe('/api/places/reverse?lat=***&lng=***')
    expect(out.query).toBeUndefined()
    expect(JSON.stringify(out)).not.toContain('37.5')
  })
})

describe('프록시 IP 진단', () => {
  it('서버가 본 IP 가 X-Forwarded-For 첫 주소와 같으면 정상', () => {
    expect(networkInfo('203.0.113.7', '203.0.113.7, 76.76.21.1')).toMatchObject({ ok: true, hops: 2, forwardedFor: '203.0.113.7' })
  })
  it('다르면(프록시 IP 로 보임) 경고', () => {
    const r = networkInfo('76.76.21.1', '203.0.113.7, 76.76.21.1')
    expect(r.ok).toBe(false)
    expect(r.note).toContain('trust proxy')
  })
  it('IPv6 매핑 표기(::ffff:)는 같은 주소로 본다', () => {
    expect(networkInfo('::ffff:203.0.113.7', '203.0.113.7').ok).toBe(true)
  })
  it('프록시 헤더가 없으면(바로 접속) 판단하지 않고 안내만', () => {
    expect(networkInfo('127.0.0.1', undefined)).toMatchObject({ ok: true, hops: 0, forwardedFor: null })
  })
})

describe('접속자 IP 를 읽는 프록시 단계', () => {
  it('Render 는 2단계, 그 밖에는 1단계, 설정값이 있으면 그 값', () => {
    expect(trustProxyHops(undefined, true)).toBe(2)
    expect(trustProxyHops(undefined, false)).toBe(1)
    expect(trustProxyHops(0, true)).toBe(0)
    expect(trustProxyHops(3, false)).toBe(3)
  })
})
