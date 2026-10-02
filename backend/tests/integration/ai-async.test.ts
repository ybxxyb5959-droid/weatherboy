import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { env } from '../../src/config/env.js'
import { prisma } from '../../src/db.js'
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
      await new Promise((r) => setTimeout(r, 1500)) // 느린 AI
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '오늘은 선선하니 긴팔이면 충분해요.' }] } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return base(input, init)
  })
  Object.assign(env, { AI_ENABLED: true, GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' })
})
afterAll(async () => {
  Object.assign(env, { AI_ENABLED: false })
  vi.restoreAllMocks()
  await prisma.$disconnect()
  await pool.end()
})

describe('AI 설명은 추천 응답을 기다리게 하지 않는다', () => {
  const a = agent()
  it('AI 가 느려도 추천은 바로 오고, 설명은 잠시 뒤 채워진다', async () => {
    await a.post('/api/auth/guest').expect(201)
    await a.post('/api/onboarding/complete').send({ sensitivity: '보통', location: '서울 마포구', closetMode: 'empty' }).expect(200)
    // 예보/대기질 캐시와 DB 연결 풀을 먼저 데워서(첫 연결은 느릴 수 있다) AI 대기 시간만 잰다
    await Promise.all([a.get('/api/weather/today'), a.get('/api/clothes'), a.get('/api/clothes'), a.get('/api/clothes')])
    const t0 = Date.now()
    const first = (await a.get('/api/recommendations/today').expect(200)).body
    expect(Date.now() - t0).toBeLessThan(1200) // AI(1.5초)를 기다렸다면 1.5초 이상
    expect(first.aiExplanation).toBeNull()
    expect(first.aiPending).toBe(true)

    await vi.waitFor(async () => {
      const r = (await a.get('/api/recommendations/today').expect(200)).body
      expect(r.aiExplanation).toBe('오늘은 선선하니 긴팔이면 충분해요.')
      expect(r.aiPending).toBe(false)
    }, { timeout: 5000, interval: 300 })
    expect(geminiCalls).toBe(1) // 기다리는 동안 다시 불러도 AI 는 한 번만 호출
  })
})
