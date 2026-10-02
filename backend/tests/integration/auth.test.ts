import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../src/db.js'
import { agent, app, mockKakaoFetch, pool } from './helpers.js'
import request from 'supertest'

afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  await prisma.$disconnect()
  await pool.end()
})

describe('health', () => {
  it('/health', async () => expect((await request(app).get('/health')).body).toEqual({ ok: true }))
  it('/ready: DB 연결', async () => expect((await request(app).get('/ready')).body).toEqual({ ok: true, database: 'connected' }))
})

describe('guest auth', () => {
  it('인증 없는 접근 차단', async () => {
    for (const path of ['/api/me', '/api/clothes', '/api/events', '/api/settings', '/api/weather/today', '/api/recommendations/today']) {
      const r = await request(app).get(path)
      expect(r.status, path).toBe(401)
      expect(r.body.code).toBe('UNAUTHORIZED')
    }
  })

  it('Guest 생성 -> 세션 유지 -> 로그아웃 -> 차단', async () => {
    const a = agent()
    const created = await a.post('/api/auth/guest')
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ provider: 'GUEST', plan: 'FREE', onboardingDone: false })
    const cookie = created.headers['set-cookie']?.[0] ?? ''
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')

    const me = await a.get('/api/me')
    expect(me.status).toBe(200)
    expect(me.body.id).toBe(created.body.id)

    expect((await a.post('/api/auth/logout')).status).toBe(200)
    expect((await a.get('/api/me')).status).toBe(401)
  })

  it('허용되지 않은 Origin 의 상태 변경 요청은 403', async () => {
    const r = await request(app).post('/api/auth/guest').set('Origin', 'https://evil.example')
    expect(r.status).toBe(403)
  })
})

describe('kakao oauth (외부 호출 Mock 기반 내부 Flow 검증. 실제 Kakao 호출은 미검증)', () => {
  const stateOf = (location: string) => new URL(location).searchParams.get('state')!

  it('/api/auth/kakao 는 state 포함 authorize URL 로 redirect', async () => {
    const r = await agent().get('/api/auth/kakao')
    expect(r.status).toBe(302)
    const u = new URL(r.headers.location!)
    expect(u.origin + u.pathname).toBe('https://kauth.kakao.com/oauth/authorize')
    expect(u.searchParams.get('response_type')).toBe('code')
    expect(u.searchParams.get('client_id')).toBe('test-rest-key')
    expect(u.searchParams.get('state')).toHaveLength(48)
  })

  it('state 불일치 -> 로그인 실패 redirect', async () => {
    const a = agent()
    await a.get('/api/auth/kakao')
    const r = await a.get('/api/auth/kakao/callback?code=abc&state=WRONG')
    expect(r.status).toBe(302)
    expect(r.headers.location).toContain('login=failed')
    expect((await a.get('/api/me')).status).toBe(401)
  })

  it('state 일치 -> User 생성 + 세션 + /setup redirect, 재로그인은 같은 User', async () => {
    const kakaoId = String(Date.now())
    mockKakaoFetch(kakaoId)
    const a = agent()
    const s = stateOf((await a.get('/api/auth/kakao')).headers.location!)
    const cb = await a.get(`/api/auth/kakao/callback?code=abc&state=${s}`)
    expect(cb.status).toBe(302)
    expect(cb.headers.location).toBe('http://localhost:5173/setup')
    const me = await a.get('/api/me')
    expect(me.body).toMatchObject({ provider: 'KAKAO', nickname: '카카오유저' })

    const b = agent()
    const s2 = stateOf((await b.get('/api/auth/kakao')).headers.location!)
    await b.get(`/api/auth/kakao/callback?code=def&state=${s2}`)
    expect((await b.get('/api/me')).body.id).toBe(me.body.id)
  })

  it('Guest 로 쓰던 계정에 Kakao 를 연결하면 데이터가 유지된다', async () => {
    mockKakaoFetch(String(Date.now() + 1))
    const a = agent()
    const guest = (await a.post('/api/auth/guest')).body
    await a.post('/api/clothes').send({ type: '맨투맨', thickness: '보통', color: '회색' })
    const s = stateOf((await a.get('/api/auth/kakao')).headers.location!)
    await a.get(`/api/auth/kakao/callback?code=abc&state=${s}`)
    const me = (await a.get('/api/me')).body
    expect(me.id).toBe(guest.id)
    expect(me.provider).toBe('KAKAO')
    expect((await a.get('/api/clothes')).body).toHaveLength(1)
  })

  it('이미 쓴 state 는 재사용 불가', async () => {
    mockKakaoFetch(String(Date.now() + 2))
    const a = agent()
    const s = stateOf((await a.get('/api/auth/kakao')).headers.location!)
    await a.get(`/api/auth/kakao/callback?code=abc&state=${s}`)
    const r = await a.get(`/api/auth/kakao/callback?code=abc&state=${s}`)
    expect(r.headers.location).toContain('login=failed')
  })
})

describe('회원 탈퇴 (DELETE /api/me)', () => {
  it('내 모든 데이터가 지워지고 세션도 끝난다', async () => {
    const a = agent()
    const guest = (await a.post('/api/auth/guest')).body
    await a.post('/api/clothes').send({ type: '맨투맨', thickness: '보통', color: '회색' })
    await a.post('/api/events').send({ title: '지울 일정', startDate: '2026-12-01', kind: '여행' })
    expect(await prisma.clothing.count({ where: { userId: guest.id } })).toBe(1)

    expect((await a.delete('/api/me')).status).toBe(204)
    expect((await a.get('/api/me')).status).toBe(401)
    expect(await prisma.user.count({ where: { id: guest.id } })).toBe(0)
    expect(await prisma.clothing.count({ where: { userId: guest.id } })).toBe(0)
    expect(await prisma.event.count({ where: { userId: guest.id } })).toBe(0)
    expect(await prisma.authIdentity.count({ where: { userId: guest.id } })).toBe(0)
  })

  it('다른 사용자의 데이터는 건드리지 않는다', async () => {
    const a = agent()
    const b = agent()
    await a.post('/api/auth/guest')
    const other = (await b.post('/api/auth/guest')).body
    await b.post('/api/clothes').send({ type: '패딩', thickness: '두꺼움', color: '검정' })
    expect((await a.delete('/api/me')).status).toBe(204)
    expect((await b.get('/api/me')).body.id).toBe(other.id)
    expect((await b.get('/api/clothes')).body).toHaveLength(1)
  })

  it('로그인 없이는 401', async () => {
    expect((await agent().delete('/api/me')).status).toBe(401)
  })
})
