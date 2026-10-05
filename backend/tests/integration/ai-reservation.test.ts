import { afterAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../src/db.js'
import { env } from '../../src/config/env.js'
import { reserveAi } from '../../src/services/ai/aiQuota.js'
import { logger } from '../../src/utils/logger.js'

afterAll(() => prisma.$disconnect())
describe('실제 DB 공통 AI 예약', () => {
  it('사진·말·설명 동시 예약이 서버의 남은 두 자리를 넘지 않는다', async () => {
    const user = await prisma.user.create({ data: {} })
    const old = env.AI_GLOBAL_DAILY
    const warnings = vi.spyOn(logger, 'warn')
    try {
      const before = await prisma.aiCallLog.count({ where: { createdAt: { gte: new Date(Date.now() - 86400_000) } } })
      env.AI_GLOBAL_DAILY = before + 2
      const results = await Promise.all(Array.from({ length: 12 }, (_, i) => reserveAi(user.id, (['photo', 'text', 'explain'] as const)[i % 3]!)))
      const after = await prisma.aiCallLog.count({ where: { createdAt: { gte: new Date(Date.now() - 86400_000) } } })
      expect(results.filter((r) => r.ok), JSON.stringify({ before, after, cap: env.AI_GLOBAL_DAILY, results, warnings: warnings.mock.calls })).toHaveLength(2)
      const rows = await prisma.aiCallLog.findMany({ where: { userId: user.id } })
      expect(rows).toHaveLength(2)
      expect(rows.every((r) => r.status === 'PARTIAL' && r.model === 'reserved')).toBe(true)
      // 외부 요청이 끝나지 않았어도 다른 종류가 이 자리를 재사용하지 못한다.
      expect(await reserveAi(user.id, 'text')).toEqual({ ok: false, reason: 'busy' })
    } finally {
      env.AI_GLOBAL_DAILY = old
      warnings.mockRestore()
      await prisma.aiCallLog.deleteMany({ where: { userId: user.id } })
      await prisma.user.delete({ where: { id: user.id } })
    }
  })
})
