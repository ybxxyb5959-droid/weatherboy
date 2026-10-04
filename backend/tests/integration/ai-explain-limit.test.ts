import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../src/config/env.js'
import { prisma } from '../../src/db.js'
import { resetGlobalCache } from '../../src/services/ai/aiQuota.js'
import { agent, installFakeProviders, mockKakaoFetch, pool } from './helpers.js'

let geminiCalls = 0
beforeAll(() => {
  installFakeProviders({ temp: 12, pop: 20, airGrade: 2 })
  const spy = mockKakaoFetch()
  const base = spy.getMockImplementation()!
  spy.mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.startsWith('https://generativelanguage.googleapis.com')) {
      geminiCalls++
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'AI 가 만든 설명이에요.' }] } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return base(input, init)
  })
  Object.assign(env, { AI_ENABLED: true, GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' })
})
beforeEach(() => {
  geminiCalls = 0
  resetGlobalCache()
  Object.assign(env, { AI_EXPLAIN_DAILY: 20, AI_GLOBAL_DAILY: 3000 })
})
afterAll(async () => {
  Object.assign(env, { AI_ENABLED: false, AI_EXPLAIN_DAILY: 20, AI_GLOBAL_DAILY: 3000 })
  vi.restoreAllMocks()
  await prisma.$disconnect()
  await pool.end()
})

async function newUser() {
  const a = agent()
  await a.post('/api/auth/guest').expect(201)
  await a.post('/api/onboarding/complete').send({ sensitivity: '보통', location: '서울 마포구', closetMode: 'empty' }).expect(200)
  const me = (await a.get('/api/me').expect(200)).body as { id?: string }
  return { a, id: me.id as string }
}
const logRow = (userId: string, kind: string) => ({ model: 'test-model', status: 'SUCCESS' as const, userId, kind })
const settled = (a: ReturnType<typeof agent>) =>
  vi.waitFor(async () => {
    const r = (await a.get('/api/recommendations/today').expect(200)).body
    expect(r.aiPending).toBe(false)
    return r
  }, { timeout: 5000, interval: 200 })

describe('자동 AI 설명도 공통 한도를 따른다', () => {
  it('한도 안이면 AI 설명을 만들고, 호출 기록에 사용자와 explain 종류가 남는다', async () => {
    const { a, id } = await newUser()
    expect((await a.get('/api/recommendations/today').expect(200)).body.aiPending).toBe(true)
    await settled(a)
    const r = (await a.get('/api/recommendations/today').expect(200)).body
    expect(r.aiExplanation).toBe('AI 가 만든 설명이에요.')
    expect(geminiCalls).toBe(1)
    expect(await prisma.aiCallLog.count({ where: { userId: id, kind: 'explain' } })).toBe(1)
  })

  it('사용자 하루 한도에 닿으면 AI 를 부르지 않고 템플릿 문장이 저장된다', async () => {
    const { a, id } = await newUser()
    env.AI_EXPLAIN_DAILY = 2
    await prisma.aiCallLog.createMany({ data: [logRow(id, 'explain'), logRow(id, 'explain')] })
    await a.get('/api/recommendations/today').expect(200)
    await settled(a)
    const r = (await a.get('/api/recommendations/today').expect(200)).body
    expect(geminiCalls).toBe(0)
    expect(r.aiExplanation).toBe(`${r.headline}. ${r.sub}.`)
    expect(r.aiPending).toBe(false)
  })

  it('반복 조회해도 한도 상태에서 AI 호출이 늘지 않는다', async () => {
    const { a, id } = await newUser()
    env.AI_EXPLAIN_DAILY = 1
    await prisma.aiCallLog.create({ data: logRow(id, 'explain') })
    await a.get('/api/recommendations/today').expect(200)
    await settled(a)
    for (let i = 0; i < 5; i++) await a.get('/api/recommendations/today').expect(200)
    expect(geminiCalls).toBe(0)
    expect(await prisma.aiCallLog.count({ where: { userId: id, kind: 'explain' } })).toBe(1)
  })

  it('동시에 같은 추천을 여러 번 불러도 AI 는 한 번만 나간다', async () => {
    const { a } = await newUser()
    await Promise.all(Array.from({ length: 6 }, () => a.get('/api/recommendations/today').expect(200)))
    await settled(a)
    expect(geminiCalls).toBe(1)
  })

  it('서버 전체 상한에 닿으면(사진·말 호출도 합산) 설명도 템플릿으로 대신한다', async () => {
    const { a, id } = await newUser()
    const before = await prisma.aiCallLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } } })
    env.AI_GLOBAL_DAILY = before + 1
    resetGlobalCache()
    await prisma.aiCallLog.create({ data: logRow(id, 'photo') }) // 사진 호출 하나가 상한을 채운다
    resetGlobalCache()
    await a.get('/api/recommendations/today').expect(200)
    await settled(a)
    const r = (await a.get('/api/recommendations/today').expect(200)).body
    expect(geminiCalls).toBe(0)
    expect(r.aiExplanation).toBe(`${r.headline}. ${r.sub}.`)
  })
})
