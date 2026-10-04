import { beforeEach, describe, expect, it, vi } from 'vitest'

const count = vi.fn()
vi.mock('../../src/db.js', () => ({ prisma: { aiCallLog: { count: (...a: unknown[]) => count(...a) }, user: {} } }))

import { env } from '../../src/config/env.js'
import { busyMessage, getGlobalUsage, globalUsageOf, resetGlobalCache, usageView } from '../../src/services/ai/aiQuota.js'

beforeEach(() => {
  count.mockReset()
  resetGlobalCache()
  env.AI_GLOBAL_DAILY = 100
})

describe('서버 전체 하루 상한', () => {
  it('상한 미만이면 열려 있고, 닿으면 닫힌다', () => {
    expect(globalUsageOf(99, 100)).toEqual({ open: true, used: 99, cap: 100 })
    expect(globalUsageOf(100, 100).open).toBe(false)
  })
  it('최근 24시간 전체 호출 수로 판단한다', async () => {
    count.mockResolvedValue(100)
    expect(await getGlobalUsage(1_000_000)).toMatchObject({ open: false, used: 100, cap: 100 })
    const where = count.mock.calls[0]![0].where
    expect(where.createdAt.gte.getTime()).toBe(1_000_000 - 24 * 3600_000)
  })
  it('30초 동안은 다시 세지 않고 기억한 값을 쓴다', async () => {
    count.mockResolvedValue(10)
    await getGlobalUsage(1_000_000)
    await getGlobalUsage(1_000_000 + 29_000)
    expect(count).toHaveBeenCalledTimes(1)
    await getGlobalUsage(1_000_000 + 31_000)
    expect(count).toHaveBeenCalledTimes(2)
  })
  it('기록을 읽지 못하면 막지 않는다', async () => {
    count.mockRejectedValue(new Error('db down'))
    expect(await getGlobalUsage(5_000_000)).toMatchObject({ open: true })
  })
  it('안내 문장: 사진은 직접 등록을 권한다', () => {
    expect(busyMessage('photo')).toContain('직접 등록')
    expect(busyMessage('text')).not.toContain('직접 등록')
  })
})

describe('화면에 보여줄 남은 비율', () => {
  it('(한도 - 사용) / 한도, 0~100 으로 맞춘다', () => {
    expect(usageView({ ok: true, limit: 120, used: 30, isNewUser: false })).toEqual({ used: 30, limit: 120, remainingPct: 75, isNewUser: false })
    expect(usageView({ ok: false, limit: 100, used: 130, isNewUser: false }).remainingPct).toBe(0)
    expect(usageView({ ok: true, limit: 300, used: 0, isNewUser: true }).remainingPct).toBe(100)
  })
})
