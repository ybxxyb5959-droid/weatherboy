import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../src/db.js'
import { env } from '../../src/config/env.js'
import { agent, installFakeProviders, mockKakaoFetch, pool } from './helpers.js'

beforeAll(() => {
  installFakeProviders({ temp: 12, pop: 20, airGrade: 2 })
  mockKakaoFetch()
  Object.assign(env, { AI_ENABLED: false }) // 이 파일은 '꺼진 상태'를 확인한다
})
afterAll(async () => {
  vi.restoreAllMocks()
  await prisma.$disconnect()
  await pool.end()
})

describe('AI 경로', () => {
  const a = agent()

  it('로그인 없이는 쓸 수 없다', async () => {
    await agent().get('/api/ai/status').expect(401)
    await agent().post('/api/ai/parse-event').send({ text: '다음주 금요일 제주 여행' }).expect(401)
  })

  it('AI 가 꺼져 있으면 status 가 false, 호출하면 503', async () => {
    await a.post('/api/auth/guest').expect(201)
    expect((await a.get('/api/ai/status')).body).toEqual({ enabled: false })
    const r = await a.post('/api/ai/parse-event').send({ text: '다음주 금요일 제주 여행' })
    expect(r.status).toBe(503)
    expect(r.body.code).toBe('AI_DISABLED')
  })

  it('사진 경로는 100KB 가 넘는 본문도 받는다 (잘못된 형식이면 413 이 아니라 400)', async () => {
    const big = 'data:image/gif;base64,' + 'A'.repeat(300_000)
    expect((await a.post('/api/ai/clothing-from-photo').send({ image: big })).status).toBe(400)
  })

  it('다른 경로는 여전히 100KB 제한', async () => {
    const r = await a.post('/api/events').send({ title: 'x'.repeat(200_000), startDate: '2026-12-01', kind: '기타' })
    expect(r.status).toBe(413)
  })

  it('입력 검증: 너무 짧은 문장은 400', async () => {
    expect((await a.post('/api/ai/parse-event').send({ text: '' })).status).toBe(400)
  })
})
