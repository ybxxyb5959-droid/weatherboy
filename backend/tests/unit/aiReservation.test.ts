import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({
  rows: [] as { id: string; userId: string; kind: string }[],
  queue: Promise.resolve() as Promise<unknown>,
  down: false,
}))
vi.mock('../../src/db.js', () => {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: { findUnique: vi.fn().mockResolvedValue({ createdAt: new Date(0) }) },
    aiCallLog: {
      update: vi.fn().mockRejectedValue(new Error('log update down')),
      count: vi.fn(async (q: { where: { userId?: string; kind?: string } }) => state.rows.filter((r) => (!q.where.userId || r.userId === q.where.userId) && (!q.where.kind || r.kind === q.where.kind)).length),
      create: vi.fn(async (q: { data: { userId: string; kind: string } }) => {
        const row = { id: String(state.rows.length + 1), ...q.data }
        state.rows.push(row)
        return row
      }),
    },
  }
  return { prisma: { ...tx, $transaction: (fn: (client: typeof tx) => unknown) => {
    const run = state.queue.then(() => {
      if (state.down) throw new Error('db down')
      return fn(tx)
    })
    state.queue = run.catch(() => undefined)
    return run
  } } }
})
import { env } from '../../src/config/env.js'
import { reserveAi, withinCap } from '../../src/services/ai/aiQuota.js'
import { recordAiCall } from '../../src/services/ai/aiLog.js'
beforeEach(() => {
  state.rows = []
  state.queue = Promise.resolve()
  state.down = false
  Object.assign(env, { AI_EXPLAIN_DAILY: 3, AI_GLOBAL_DAILY: 100, AI_PHOTO_DAILY: 3, AI_TEXT_DAILY: 3 })
})
describe('사진·말·설명 공통 DB 예약', () => {
  it('한도 경계 계산', () => {
    expect(withinCap(2, 1, 3)).toBe(true)
    expect(withinCap(3, 1, 3)).toBe(false)
  })
  it('진행 중 예약도 즉시 사용량에 포함되고 한도에서 멈춘다', async () => {
    for (let i = 0; i < 3; i++) expect((await reserveAi('u', 'explain')).ok).toBe(true)
    expect(await reserveAi('u', 'explain')).toEqual({ ok: false, reason: 'user_limit' })
    expect(state.rows).toHaveLength(3)
  })
  it('동시 요청은 사진·말·설명 전체 합계 상한을 넘지 않는다', async () => {
    env.AI_GLOBAL_DAILY = 2
    const result = await Promise.all(Array.from({ length: 12 }, (_, i) => reserveAi(`u${i}`, (['photo', 'text', 'explain'] as const)[i % 3]!)))
    expect(result.filter((r) => r.ok)).toHaveLength(2)
    expect(state.rows).toHaveLength(2)
  })
  it('사용자별 종류별 한도와 서버 전체 한도는 별개다', async () => {
    for (let i = 0; i < 3; i++) await reserveAi('u', 'photo')
    expect(await reserveAi('u', 'photo')).toEqual({ ok: false, reason: 'user_limit' })
    expect((await reserveAi('u', 'text')).ok).toBe(true)
    expect((await reserveAi('another', 'photo')).ok).toBe(true)
  })
  it('조회/예약 장애는 AI 를 닫으며 복구 후에만 다시 예약된다', async () => {
    state.down = true
    expect(await reserveAi('u', 'explain')).toEqual({ ok: false, reason: 'busy' })
    expect(state.rows).toHaveLength(0)
    state.down = false
    expect((await reserveAi('u', 'explain')).ok).toBe(true)
  })
  it('결과 기록 장애 뒤에는 후속 호출을 닫고 이미 사용한 예약은 남긴다', async () => {
    const a = await reserveAi('u', 'text')
    expect(a.ok).toBe(true)
    if (!a.ok) throw new Error('예약 실패')
    await recordAiCall({ model: 'test', status: 'SUCCESS' }, a.id)
    expect(await reserveAi('another', 'photo')).toEqual({ ok: false, reason: 'busy' })
    expect(state.rows).toHaveLength(1)
  })
})
