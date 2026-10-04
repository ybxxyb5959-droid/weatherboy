import { beforeEach, describe, expect, it, vi } from 'vitest'

const count = vi.fn()
vi.mock('../../src/db.js', () => ({ prisma: { aiCallLog: { count: (...a: unknown[]) => count(...a) }, user: {} } }))

import { env } from '../../src/config/env.js'
import { reserveExplain, resetGlobalCache, withinCap, type ExplainReservation } from '../../src/services/ai/aiQuota.js'

// 사용자별(explain) 호출 수와 서버 전체 호출 수를 따로 돌려준다
const setCounts = (mine: number, global: number) =>
  count.mockImplementation(async (a: { where: { kind?: string } }) => (a.where.kind === 'explain' ? mine : global))

const releaseAll = (rs: ExplainReservation[]) => rs.forEach((r) => r.ok && r.release())

beforeEach(() => {
  count.mockReset()
  resetGlobalCache()
  env.AI_EXPLAIN_DAILY = 3
  env.AI_GLOBAL_DAILY = 100
})

describe('자동 설명 한도', () => {
  it('순수 판단: 쓴 수 + 진행 중인 수가 한도를 넘으면 안 된다', () => {
    expect(withinCap(2, 1, 3)).toBe(true)
    expect(withinCap(3, 1, 3)).toBe(false)
  })

  it('한도 안이면 자리를 주고, release 하면 다시 쓸 수 있다', async () => {
    setCounts(2, 0)
    const a = await reserveExplain('u1')
    expect(a.ok).toBe(true)
    const b = await reserveExplain('u1') // 진행 중 1 + 기록 2 → 3 이 넘지 않으면 이미 하나 잡혀 있어 막힌다
    expect(b).toEqual({ ok: false, reason: 'user_limit' })
    releaseAll([a])
    setCounts(2, 0)
    const c = await reserveExplain('u1')
    expect(c.ok).toBe(true)
    releaseAll([c])
  })

  it('하루 한도에 닿으면 user_limit', async () => {
    setCounts(3, 0)
    expect(await reserveExplain('u1')).toEqual({ ok: false, reason: 'user_limit' })
  })

  it('동시에 10건이 들어와도 남은 자리(1)보다 많이 통과하지 않는다', async () => {
    setCounts(2, 0)
    const rs = await Promise.all(Array.from({ length: 10 }, () => reserveExplain('u-burst')))
    expect(rs.filter((r) => r.ok).length).toBeLessThanOrEqual(1)
    releaseAll(rs)
  })

  it('거절된 요청은 자리를 남기지 않는다(다음 요청이 막히지 않음)', async () => {
    setCounts(3, 0)
    await reserveExplain('u2')
    await reserveExplain('u2')
    setCounts(0, 0)
    const r = await reserveExplain('u2')
    expect(r.ok).toBe(true)
    releaseAll([r])
  })

  it('다른 사용자의 진행 중 호출은 내 한도에 영향을 주지 않는다', async () => {
    setCounts(2, 0)
    const a = await reserveExplain('ua')
    const b = await reserveExplain('ub')
    expect(a.ok && b.ok).toBe(true)
    releaseAll([a, b])
  })

  it('서버 전체 상한에 닿으면 busy (진행 중인 호출도 합산)', async () => {
    env.AI_GLOBAL_DAILY = 5
    setCounts(0, 5)
    expect(await reserveExplain('u3')).toEqual({ ok: false, reason: 'busy' })
    resetGlobalCache()
    setCounts(0, 4)
    const a = await reserveExplain('u3')
    expect(a.ok).toBe(true)
    const b = await reserveExplain('u4') // 기록 4 + 진행 중 2 > 5
    expect(b).toEqual({ ok: false, reason: 'busy' })
    releaseAll([a])
  })

  it('release 는 여러 번 불러도 한 번만 반영된다', async () => {
    setCounts(0, 0)
    const a = await reserveExplain('u5')
    if (a.ok) {
      a.release()
      a.release()
    }
    env.AI_EXPLAIN_DAILY = 1
    const b = await reserveExplain('u5')
    expect(b.ok).toBe(true)
    releaseAll([b])
  })
})
