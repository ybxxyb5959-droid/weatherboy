import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db.js'
import { normalizeIcalUrl } from '../../services/calendar/ical.js'
import { syncConnection } from '../../services/calendar/sync.js'
import { badRequest, notFound } from '../../utils/errors.js'
import { parse, requireAuth, wrap, type AuthedRequest } from '../middleware/common.js'
import type { CalendarConnection } from '@prisma/client'

export const calendarRouter = Router()
calendarRouter.use(requireAuth)

const MAX_CONNECTIONS = 5
const idParam = z.string().uuid()
const connectSchema = z.object({
  provider: z.enum(['GOOGLE', 'APPLE', 'SAMSUNG', 'OTHER']),
  url: z.string().trim().min(8).max(1000),
  // 사용자가 연동 안내를 읽고 동의했는지. 서버에서도 한 번 더 확인한다.
  consent: z.literal(true),
})

// 구독 주소는 비밀번호와 같다(아는 사람은 누구나 일정을 볼 수 있다). 응답에는 절대 담지 않는다.
const view = (c: CalendarConnection, eventCount?: number) => ({
  id: c.id,
  provider: c.provider,
  lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
  lastError: c.lastError,
  ...(eventCount !== undefined ? { eventCount } : {}),
})

calendarRouter.get(
  '/',
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    const conns = await prisma.calendarConnection.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
    const counts = await prisma.event.groupBy({ by: ['calendarConnectionId'], where: { userId, calendarConnectionId: { not: null } }, _count: true })
    const countOf = new Map(counts.map((c) => [c.calendarConnectionId, c._count]))
    res.json(conns.map((c) => view(c, countOf.get(c.id) ?? 0)))
  }),
)

calendarRouter.post(
  '/',
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    const b = parse(connectSchema, req.body)
    const url = normalizeIcalUrl(b.url).toString()
    if ((await prisma.calendarConnection.count({ where: { userId } })) >= MAX_CONNECTIONS) throw badRequest(`캘린더는 최대 ${MAX_CONNECTIONS}개까지 연결할 수 있어요.`)
    if (await prisma.calendarConnection.findUnique({ where: { userId_icalUrl: { userId, icalUrl: url } } })) throw badRequest('이미 연결한 캘린더예요.')

    const conn = await prisma.calendarConnection.create({ data: { userId, provider: b.provider, icalUrl: url } })
    try {
      const { imported } = await syncConnection(conn)
      const fresh = await prisma.calendarConnection.findUniqueOrThrow({ where: { id: conn.id } })
      res.status(201).json(view(fresh, imported))
    } catch (e) {
      // 처음부터 읽지 못하는 주소는 남겨두지 않는다
      await prisma.calendarConnection.delete({ where: { id: conn.id } }).catch(() => undefined)
      throw e
    }
  }),
)

async function own(id: string, userId: string) {
  const c = await prisma.calendarConnection.findFirst({ where: { id, userId } })
  if (!c) throw notFound('연결된 캘린더를 찾을 수 없어요.')
  return c
}

calendarRouter.post(
  '/:id/sync',
  wrap(async (req, res) => {
    const c = await own(parse(idParam, req.params.id), (req as AuthedRequest).userId)
    const { imported } = await syncConnection(c)
    res.json(view(await prisma.calendarConnection.findUniqueOrThrow({ where: { id: c.id } }), imported))
  }),
)

// 연결을 해제하면 그 캘린더에서 가져온 일정도 함께 지워진다 (직접 입력한 일정은 그대로).
calendarRouter.delete(
  '/:id',
  wrap(async (req, res) => {
    const c = await own(parse(idParam, req.params.id), (req as AuthedRequest).userId)
    await prisma.calendarConnection.delete({ where: { id: c.id } })
    res.status(204).end()
  }),
)
