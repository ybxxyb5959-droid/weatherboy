import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../src/db.js'
import { env } from '../../src/config/env.js'
import { guestCleanupJob, GUEST_IDLE_DAYS } from '../../src/jobs/guestCleanupJob.js'
import { agent, mockKakaoFetch, pool } from './helpers.js'

beforeAll(() => {
  mockKakaoFetch()
})
afterAll(async () => {
  vi.restoreAllMocks()
  await prisma.$disconnect()
  await pool.end()
})

const cookieOf = (res: { headers: Record<string, unknown> }) => {
  const c = res.headers['set-cookie'] as string[] | undefined
  return c?.find((x) => x.startsWith('wb.sid='))
}

describe('로그인 유지: 쿠키 기간 연장', () => {
  it('로그인 후 첫 요청에서 쿠키가 연장되고, 곧바로 다음 요청에서는 다시 보내지 않는다', async () => {
    const a = agent()
    await a.post('/api/auth/guest').expect(201)
    const first = await a.get('/api/me').expect(200)
    expect(cookieOf(first)).toBeTruthy() // 기간을 30일로 다시 늘린 쿠키
    expect(cookieOf(first)).toMatch(/Expires=/i)
    const second = await a.get('/api/me').expect(200)
    expect(cookieOf(second)).toBeUndefined()
  })
})

describe('관리자 비밀번호 로그인: 세션 재생성', () => {
  it('로그인 전후 세션 ID 가 바뀌고, 원래 로그인해 있던 사용자 계정은 그대로 이어진다', async () => {
    const saved = env.ADMIN_PASSWORD
    env.ADMIN_PASSWORD = 'test-admin-password'
    try {
      const a = agent()
      const g = await a.post('/api/auth/guest').expect(201)
      const before = cookieOf(g)
      const meBefore = (await a.get('/api/me')).body.id
      const login = await a.post('/api/admin/login').send({ password: 'test-admin-password' }).expect(200)
      const after = cookieOf(login)
      expect(after).toBeTruthy()
      expect(after!.split(';')[0]).not.toBe(before!.split(';')[0])
      expect((await a.get('/api/me').expect(200)).body.id).toBe(meBefore) // 사용자 로그인은 유지
      await a.get('/api/admin/ops/health').expect(200) // 관리자 권한도 유지
      await agent().post('/api/admin/login').send({ password: 'wrong' }).expect(401)
    } finally {
      env.ADMIN_PASSWORD = saved
    }
  })
})

describe('게스트 정리 작업', () => {
  const day = 86_400_000
  const makeGuest = async (opts: { idleDays: number; realClothes?: number; sampleClothes?: number; events?: number }) => {
    const a = agent()
    await a.post('/api/auth/guest').expect(201)
    const id = (await a.get('/api/me')).body.id as string
    const past = new Date(Date.now() - opts.idleDays * day)
    await prisma.user.update({ where: { id }, data: { createdAt: past, lastSeenAt: past } })
    for (let i = 0; i < (opts.realClothes ?? 0); i++) await a.post('/api/clothes').send({ type: '반팔', color: '흰색' }).expect(201)
    for (let i = 0; i < (opts.sampleClothes ?? 0); i++) {
      await prisma.clothing.create({ data: { userId: id, type: 'SHORT_SLEEVE', thickness: 'THIN', color: 'WHITE', category: 'TOP', warmth: 1, isSample: true } })
    }
    for (let i = 0; i < (opts.events ?? 0); i++) await a.post('/api/events').send({ title: '여행', startDate: '2026-12-01', kind: '여행' }).expect(201)
    // 위 요청들이 마지막 접속 시각을 바꿀 수 있어 다시 과거로 되돌린다
    await prisma.user.update({ where: { id }, data: { createdAt: past, lastSeenAt: past } })
    return id
  }
  const exists = async (id: string) => (await prisma.user.count({ where: { id } })) === 1

  it(`${GUEST_IDLE_DAYS}일 넘게 안 온 빈 게스트만 지우고, 데이터가 있거나 최근에 온 계정은 남긴다`, async () => {
    const emptyOld = await makeGuest({ idleDays: GUEST_IDLE_DAYS + 5 })
    const sampleOnlyOld = await makeGuest({ idleDays: GUEST_IDLE_DAYS + 5, sampleClothes: 3 })
    const withClothes = await makeGuest({ idleDays: GUEST_IDLE_DAYS + 5, realClothes: 1 })
    const withEvent = await makeGuest({ idleDays: GUEST_IDLE_DAYS + 5, events: 1 })
    const emptyRecent = await makeGuest({ idleDays: 3 })

    const r = await guestCleanupJob()
    expect(r.deleted).toBeGreaterThanOrEqual(2)

    expect(await exists(emptyOld)).toBe(false)
    expect(await exists(sampleOnlyOld)).toBe(false)
    expect(await exists(withClothes)).toBe(true)
    expect(await exists(withEvent)).toBe(true)
    expect(await exists(emptyRecent)).toBe(true)
  })

  it('카카오 등 다른 로그인이 연결된 계정과 관리자는 비어 있어도 지우지 않는다', async () => {
    const linked = await makeGuest({ idleDays: GUEST_IDLE_DAYS + 5 })
    await prisma.authIdentity.create({ data: { userId: linked, provider: 'KAKAO', providerUserId: `k-${linked}`, nickname: 'k' } })
    const admin = await makeGuest({ idleDays: GUEST_IDLE_DAYS + 5 })
    await prisma.user.update({ where: { id: admin }, data: { isAdmin: true } })

    await guestCleanupJob()
    expect(await exists(linked)).toBe(true)
    expect(await exists(admin)).toBe(true)
    await prisma.user.deleteMany({ where: { id: { in: [linked, admin] } } })
  })

  it('지울 계정이 없으면 0 을 돌려준다', async () => {
    await guestCleanupJob() // 앞 시험의 대상을 모두 정리
    expect((await guestCleanupJob()).deleted).toBe(0)
  })
})
