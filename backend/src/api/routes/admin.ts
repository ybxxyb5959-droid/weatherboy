import { Router } from 'express'
import { prisma } from '../../db.js'
import { requireAdmin, wrap } from '../middleware/common.js'

export const adminRouter = Router()
adminRouter.use(requireAdmin)

adminRouter.get(
  '/ops/summary',
  wrap(async (_req, res) => {
    const since = new Date(Date.now() - 24 * 3600_000)
    const [collect, notify, aiTotal, aiFallback, recentErrors] = await Promise.all([
      prisma.collectLog.groupBy({ by: ['status'], where: { createdAt: { gte: since } }, _count: true }),
      prisma.notifyLog.groupBy({ by: ['status'], where: { createdAt: { gte: since } }, _count: true }),
      prisma.aiCallLog.count({ where: { createdAt: { gte: since } } }),
      prisma.aiCallLog.count({ where: { createdAt: { gte: since }, fallback: true } }),
      prisma.collectLog.findMany({ where: { status: { in: ['FAILED', 'PARTIAL'] } }, orderBy: { createdAt: 'desc' }, take: 10, select: { job: true, target: true, status: true, message: true, createdAt: true } }),
    ])
    const toMap = (rows: { status: string; _count: number }[]) => Object.fromEntries(rows.map((r) => [r.status, r._count]))
    res.json({
      windowHours: 24,
      collect: toMap(collect),
      push: toMap(notify),
      ai: { calls: aiTotal, fallbacks: aiFallback },
      recentErrors,
    })
  }),
)
