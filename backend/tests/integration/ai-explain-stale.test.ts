import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../src/config/env.js'
import { prisma } from '../../src/db.js'
import { resetGlobalCache } from '../../src/services/ai/aiQuota.js'
import { agent, installFakeProviders, mockKakaoFetch, pool } from './helpers.js'

let geminiCalls = 0
let aiDelayMs = 0
beforeAll(async () => {
  await prisma.forecastSnapshot.deleteMany({}) // 다른 테스트가 남긴 예보 캐시(기온)가 섞이지 않게
  installFakeProviders({ temp: 15, pop: 20, airGrade: 2 }) // 15°C: 판단 기온 15 → 기온대 3, 추위 많이 탐(-2) → 13 → 기온대 2
  const spy = mockKakaoFetch()
  const base = spy.getMockImplementation()!
  spy.mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.startsWith('https://generativelanguage.googleapis.com')) {
      geminiCalls++
      if (aiDelayMs) await new Promise((r) => setTimeout(r, aiDelayMs))
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'AI 가 만든 설명이에요.' }] } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return base(input, init)
  })
  Object.assign(env, { AI_ENABLED: true, GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' })
})
beforeEach(() => {
  geminiCalls = 0
  aiDelayMs = 0
  resetGlobalCache()
})
afterAll(async () => {
  await prisma.forecastSnapshot.deleteMany({}) // 다음 테스트 파일이 이 파일의 기온을 읽지 않게
  Object.assign(env, { AI_ENABLED: false })
  vi.restoreAllMocks()
  await prisma.$disconnect()
  await pool.end()
})

async function newUser() {
  const a = agent()
  await a.post('/api/auth/guest').expect(201)
  await a.post('/api/onboarding/complete').send({ sensitivity: '보통', location: '서울 마포구', closetMode: 'empty' }).expect(200)
  // 상의·하의·겉옷을 1벌씩만 두어 돌려 고르기(다양성) 없이 조합이 고정되게 한다
  for (const type of ['맨투맨', '바지', '자켓']) await a.post('/api/clothes').send({ type, thickness: '보통', color: '회색' }).expect(201)
  return a
}
const today = async (a: ReturnType<typeof agent>) => (await a.get('/api/recommendations/today').expect(200)).body
const settled = (a: ReturnType<typeof agent>) => vi.waitFor(async () => expect((await today(a)).aiPending).toBe(false), { timeout: 5000, interval: 200 })
/** 판단 기온이 5°C 단위 경계를 넘도록 체감을 바꾼다(추위 많이 탐 = 판단 기온 -2°C). 옷 조합은 같게 유지되는 날씨(15°C)에서 쓴다. */
const feelCold = (a: ReturnType<typeof agent>) => a.put('/api/settings').send({ sensitivity: '추위 많이 탐' }).expect(200)

describe('오래된 AI 설명은 템플릿으로 대신한다', () => {
  it('설명을 만들 때의 조건이 저장되고, 조건이 같으면 AI 문장을 보여준다', async () => {
    const a = await newUser()
    await today(a)
    await settled(a)
    const r = await today(a)
    expect(r.aiExplanation).toBe('AI 가 만든 설명이에요.')
    expect(r.aiExplanationSource).toBe('ai')
    const row = await prisma.recommendation.findUniqueOrThrow({ where: { id: r.id } })
    expect(row.aiExplanationMeta).toMatchObject({ source: 'ai', basis: { rain: false, umbrella: false } })
    expect((row.resultJson as { outing?: { source: string } }).outing?.source).toBeTruthy()
  })

  it('조건(기온대)이 달라지면 AI 를 다시 부르지 않고 템플릿을 보여준다', async () => {
    const a = await newUser()
    await today(a)
    await settled(a)
    const id = (await today(a)).id as string
    await feelCold(a)
    const calls = geminiCalls
    for (let i = 0; i < 3; i++) {
      const r = await today(a)
      expect(r.id).toBe(id) // 옷 조합이 같아 같은 추천이 재사용된다(그래서 예전 설명이 남아 있는 상황)
      expect(r.aiExplanationSource).toBe('template')
      expect(r.aiExplanation).toBe(`${r.headline}. ${r.sub}.`)
      expect(r.aiPending).toBe(false)
    }
    expect(geminiCalls).toBe(calls) // 재생성하지 않는다
  })

  it('늦게 도착한 설명도 표시할 때 지금 조건과 비교해 걸러진다', async () => {
    const a = await newUser()
    aiDelayMs = 1200
    const first = await today(a) // 설명 생성 시작(느린 AI)
    expect(first.aiPending).toBe(true)
    await feelCold(a) // AI 가 답하기 전에 조건(판단 기온)이 바뀐다
    await vi.waitFor(async () => expect((await prisma.recommendation.findUniqueOrThrow({ where: { id: first.id } })).aiExplanation).not.toBeNull(), { timeout: 5000, interval: 200 })
    const r = await today(a)
    expect(r.id).toBe(first.id)
    expect(geminiCalls).toBe(1)
    expect(r.aiExplanationSource).toBe('template') // 늦게 온 AI 문장이 바뀐 조건 위에 보이지 않는다
    expect(r.aiExplanation).toBe(`${r.headline}. ${r.sub}.`)
  })

  it('한도로 저장된 템플릿은 한도가 풀려도 AI 문장으로 바뀌지 않고, 항상 지금 추천 문장이다', async () => {
    const a = await newUser()
    env.AI_EXPLAIN_DAILY = 1
    const me = (await a.get('/api/me').expect(200)).body as { id: string }
    await prisma.aiCallLog.create({ data: { model: 'test-model', status: 'SUCCESS', userId: me.id, kind: 'explain' } })
    await today(a)
    await settled(a)
    env.AI_EXPLAIN_DAILY = 20
    const r = await today(a)
    expect(r.aiExplanationSource).toBe('template')
    expect(geminiCalls).toBe(0)
  })
})
