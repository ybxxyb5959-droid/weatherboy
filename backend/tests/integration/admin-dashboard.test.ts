import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../src/db.js'
import { agent, mockKakaoFetch, pool } from './helpers.js'
import { TITLES } from '../../src/services/character/analysis.js'

beforeAll(() => {
  mockKakaoFetch()
})
afterAll(async () => {
  vi.restoreAllMocks()
  await prisma.$disconnect()
  await pool.end()
})

describe('관리자 시스템 점검·사용자·인사이트 API', () => {
  const admin = agent()
  let code = ''

  beforeAll(async () => {
    await admin.post('/api/auth/guest').expect(201)
    await admin.post('/api/onboarding/complete').send({ sensitivity: '보통', location: '서울 마포구', closetMode: 'empty' }).expect(200)
    const me = (await admin.get('/api/me')).body as { id: string }
    code = me.id.slice(0, 8).toUpperCase()
    await prisma.user.update({ where: { id: me.id }, data: { isAdmin: true } })
    await admin.post('/api/clothes').send({ type: '반팔', color: '흰색' }).expect(201)
  })

  it('일반 사용자는 세 API 모두 403', async () => {
    const a = agent()
    await a.post('/api/auth/guest').expect(201)
    for (const path of ['/api/admin/ops/health', '/api/admin/users', '/api/admin/insights']) expect((await a.get(path)).status).toBe(403)
  })

  it('시스템 점검: 점검 항목·작업·알림 현황·서버 정보를 주고 키 값은 주지 않는다', async () => {
    const r = await admin.get('/api/admin/ops/health').expect(200)
    expect(r.body.checks.map((c: { key: string }) => c.key)).toEqual(expect.arrayContaining(['db', 'kma', 'push', 'ai', 'jobs', 'admin']))
    expect(r.body.checks.find((c: { key: string }) => c.key === 'db')).toMatchObject({ ok: true })
    expect(r.body.push).toMatchObject({ subscriptions: expect.any(Number), usersWithPush: expect.any(Number), kinds: expect.any(Array), failures: expect.any(Array) })
    expect(Object.keys(r.body.push.optOut)).toEqual(['morning', 'rain', 'coldReturn', 'dust', 'feedback', 'closet'])
    expect(r.body.server).toMatchObject({ node: expect.stringMatching(/^v/), uptimeSec: expect.any(Number) })
    const text = JSON.stringify(r.body)
    expect(text).not.toContain('test-rest-key')
    expect(text).not.toContain('test-client-secret')
  })

  it('사용자 목록: 고객번호와 활동 수치만 있고 이메일·닉네임은 없다, 검색도 된다', async () => {
    const r = await admin.get('/api/admin/users').expect(200)
    expect(r.body.total).toBeGreaterThan(0)
    const me = r.body.users.find((u: { code: string }) => u.code === code)
    expect(me).toMatchObject({ provider: 'GUEST', clothes: 1, push: false, reviewed: false })
    for (const u of r.body.users) expect(Object.keys(u).sort()).toEqual(['activeDays', 'clothes', 'code', 'createdAt', 'events', 'feedbacks', 'lastSeenAt', 'onboardingDone', 'plan', 'provider', 'push', 'region', 'reviewed'])
    const found = await admin.get('/api/admin/users').query({ q: code.toLowerCase() }).expect(200)
    expect(found.body.users.map((u: { code: string }) => u.code)).toEqual([code])
    expect((await admin.get('/api/admin/users').query({ q: 'ZZZZZZZZ' }).expect(200)).body.users).toEqual([])
  })

  it('인사이트: 재방문·접속일수·옷 분포·칭호 분포·체감·일정', async () => {
    const r = await admin.get('/api/admin/insights').expect(200)
    expect(r.body.retention.d1).toMatchObject({ eligible: expect.any(Number), returned: expect.any(Number) })
    expect(r.body.activeDays.map((b: { label: string }) => b.label)).toEqual(['1일', '2일', '3~6일', '7일 이상'])
    expect(r.body.clothes.types.find((t: { label: string }) => t.label === '반팔')).toBeTruthy()
    expect(r.body.titles).toMatchObject({ analyzed: expect.any(Number), none: expect.any(Number), taste: expect.objectContaining({ total: expect.any(Number) }) })
    expect(r.body.titles.rare).toHaveLength(TITLES.length)
    expect(r.body.feedback).toMatchObject({ cold: expect.any(Number), ok: expect.any(Number), hot: expect.any(Number), windowDays: 30 })
    expect(r.body.events).toMatchObject({ total: expect.any(Number), kinds: expect.any(Array) })
    expect(Array.isArray(r.body.daily14)).toBe(true)
  })
})
