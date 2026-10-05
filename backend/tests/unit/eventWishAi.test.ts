import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../src/db.js', () => ({ prisma: { aiCallLog: { create: vi.fn().mockResolvedValue({}) } } }))
import { env } from '../../src/config/env.js'
import { parseEventWishAi } from '../../src/services/ai/eventWishParse.js'
import { savedEventWish } from '../../src/rules/eventWish.js'
import { tokenUsage } from '../../src/services/ai/aiTokens.js'
import { prisma } from '../../src/db.js'

const dates = ['2026-10-05', '2026-10-06']
const ctx = { title: '여행', kind: '여행', place: '', dateText: dates.join(' ~ '), weatherText: '' }
const response = (obj: unknown, metadata?: unknown) => vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }], usageMetadata: metadata }) })) as unknown as typeof fetch
let saved: { AI_ENABLED: boolean; GEMINI_API_KEY: string; GEMINI_MODEL: string }
beforeEach(() => {
  saved = { AI_ENABLED: env.AI_ENABLED, GEMINI_API_KEY: env.GEMINI_API_KEY, GEMINI_MODEL: env.GEMINI_MODEL }
  Object.assign(env, { AI_ENABLED: true, GEMINI_API_KEY: 'test', GEMINI_MODEL: 'test' })
  vi.mocked(prisma.aiCallLog.create).mockClear()
})
afterEach(() => Object.assign(env, saved))

describe('복잡한 코디 입력은 한 번만 해석한다', () => {
  it('날짜·부정·대안을 한 응답으로 받고 이용량만 기록한다', async () => {
    const patches = [
      { date: dates[0], condition: { pieces: [{ role: 'top', color: '흰색' }] } },
      { date: dates[1], condition: { pieces: [{ role: 'bottom', tone: 'dark' }] } },
    ]
    const f = response({ question: '', patches }, { promptTokenCount: 120, candidatesTokenCount: 45, totalTokenCount: 180, thoughtsTokenCount: 15 })
    const input = '첫날 검정 말고 흰색으로, 둘째날 바지는 어두운 계열로'
    expect((await parseEventWishAi(ctx, dates, savedEventWish(null), input, f)).patches).toEqual(patches)
    expect(f).toHaveBeenCalledTimes(1)
    const body = JSON.parse((vi.mocked(f).mock.calls[0]![1] as RequestInit).body as string)
    expect(body.generationConfig.maxOutputTokens).toBe(env.GEMINI_MAX_OUTPUT_TOKENS)
    const data = vi.mocked(prisma.aiCallLog.create).mock.calls[0]![0].data
    expect(data).toMatchObject({ promptTokens: 120, outputTokens: 45, totalTokens: 180, thoughtTokens: 15 })
    expect(JSON.stringify(data)).not.toContain(input)
  })
  it('확인 질문이 있으면 반환된 변경도 적용하지 않는다', async () => {
    const f = response({ question: '그날은 몇 일차인가요?', patches: [{ date: dates[0], condition: { pieces: [{ role: 'top', tone: 'light' }] } }] })
    expect(await parseEventWishAi(ctx, dates, savedEventWish(null), '그날 밝게', f)).toEqual({ patches: [], question: '그날은 몇 일차인가요?' })
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('일정 밖 날짜와 잘못된 옷 자리는 저장하지 않는다', async () => {
    for (const patch of [
      { date: '2026-10-07', condition: { pieces: [{ role: 'top', tone: 'light' }] } },
      { date: dates[0], condition: { pieces: [{ role: 'bottom', type: '니트' }] } },
    ]) {
      const r = await parseEventWishAi(ctx, dates, savedEventWish(null), '요청', response({ question: '', patches: [patch] }))
      expect(r.patches).toEqual([])
      expect(r.question).toBeTruthy()
    }
  })
  it('토큰 미제공은 미상이고 이상한 수치를 추측/변환하지 않는다', () => {
    expect(tokenUsage(undefined)).toEqual({})
    expect(tokenUsage({ promptTokenCount: '12', candidatesTokenCount: -1, totalTokenCount: 4.5, thoughtsTokenCount: 0 })).toEqual({ thoughtTokens: 0 })
  })
})
