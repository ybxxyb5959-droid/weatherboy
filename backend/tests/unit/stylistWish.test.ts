import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/db.js', () => ({ prisma: { aiCallLog: { create: vi.fn().mockResolvedValue({}) } } }))

import { env } from '../../src/config/env.js'
import { stylistReply } from '../../src/services/ai/stylist.js'

const gemini = (obj: unknown) =>
  vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) })) as unknown as typeof fetch
const ctx = { title: '면접', kind: '기타', place: '', dateText: '2026-10-08', weatherText: '' }

let saved: { AI_ENABLED: boolean; GEMINI_API_KEY: string; GEMINI_MODEL: string }
beforeEach(() => {
  saved = { AI_ENABLED: env.AI_ENABLED, GEMINI_API_KEY: env.GEMINI_API_KEY, GEMINI_MODEL: env.GEMINI_MODEL }
  Object.assign(env, { AI_ENABLED: true, GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' })
})
afterEach(() => Object.assign(env, saved))

describe('코디 상담: AI 가 말을 원하는 옷으로 바꿔준다', () => {
  it('말한 색/톤/종류를 pieces 로 받아 wish 로 돌려준다(NONE 은 비운다)', async () => {
    const f = gemini({ reply: '좋아요!', style: 'NONE', options: [], pieces: [{ role: 'top', tone: 'dark', color: 'NONE', type: 'NONE' }, { role: 'bottom', color: '베이지', type: '바지', tone: 'light' }] })
    const r = await stylistReply(ctx, [], '너무 칙칙하지 않게 위는 진하게, 바지는 베이지로', f)
    expect(r.style).toBeNull()
    expect(r.options).toEqual([])
    expect(r.wish).toEqual({
      suit: false,
      pieces: [
        { role: 'top', type: undefined, color: undefined, tone: 'dark' },
        { role: 'bottom', type: '바지', color: '베이지', tone: undefined }, // 색을 콕 집으면 색이 우선
      ],
    })
  })
  it('원하는 옷을 말하지 않았으면 wish 는 없다(선택지로 되묻는다)', async () => {
    const f = gemini({ reply: '어떤 느낌이세요?', style: 'NONE', options: [{ style: 'SMART', label: '단정하게' }, { style: 'CASUAL', label: '편하게' }], pieces: [] })
    const r = await stylistReply(ctx, [], '모르겠어', f)
    expect(r.wish ?? null).toBeNull()
    expect(r.options).toHaveLength(2)
  })
  it('목록에 없는 색을 지어내면 AI 실패로 보고 키워드/기본 선택지로 되묻는다', async () => {
    const f = gemini({ reply: '네', style: 'NONE', options: [], pieces: [{ role: 'top', color: '무지개색' }] })
    const r = await stylistReply(ctx, [], '위는 무지개색', f)
    expect(r.wish ?? null).toBeNull()
    expect(r.options.length).toBeGreaterThan(0)
  })
})
