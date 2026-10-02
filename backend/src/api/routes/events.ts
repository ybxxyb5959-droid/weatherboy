import { Router } from 'express'
import { z } from 'zod'
import { eventKindMap } from '../../config/mappings.js'
import { prisma } from '../../db.js'
import { placeHintSchema, resolveLocation } from '../../services/location.js'
import { syncStaleInBackground } from '../../services/calendar/sync.js'
import { compute, saveEventRecommendation, viewOf } from '../../services/recommendationService.js'
import { serializeEvent } from '../../services/serializers.js'
import { badRequest, notFound } from '../../utils/errors.js'
import { fromKst, kstDate, kstTime } from '../../utils/time.js'
import { parse, requireAuth, wrap, type AuthedRequest } from '../middleware/common.js'
import type { Event, Prisma } from '@prisma/client'

export const eventsRouter = Router()
eventsRouter.use(requireAuth)

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const idParam = z.string().uuid()

const createSchema = z.object({
  title: z.string().trim().min(1).max(100),
  startDate: date,
  endDate: date.optional(),
  startTime: time.default('09:00'),
  endTime: time.default('18:00'),
  place: z.string().trim().max(100).default(''),
  kind: z.enum(eventKindMap.uiValues),
  placeHint: placeHintSchema.optional(),
})
const updateSchema = createSchema.partial()

function buildTimes(startDate: string, endDate: string | undefined, startTime: string, endTime: string) {
  const startAt = fromKst(startDate, startTime)
  const endAt = fromKst(endDate ?? startDate, endTime)
  if (Number.isNaN(startAt.getTime()) || endAt.getTime() <= startAt.getTime()) throw badRequest('종료 시간이 시작보다 늦어야 해요.')
  return { startAt, endAt }
}

async function placeData(place: string, hint?: z.infer<typeof placeHintSchema>) {
  if (!place) return { placeName: '', latitude: null, longitude: null, gridNx: null, gridNy: null, regionSido: null, regionDistrict: null }
  const loc = await resolveLocation(place, hint)
  return {
    placeName: place,
    latitude: loc?.latitude ?? null,
    longitude: loc?.longitude ?? null,
    gridNx: loc?.gridNx ?? null,
    gridNy: loc?.gridNy ?? null,
    regionSido: loc?.regionSido ?? null,
    regionDistrict: loc?.regionDistrict ?? null,
  }
}

async function own(id: string, userId: string): Promise<Event> {
  const e = await prisma.event.findFirst({ where: { id, userId } })
  if (!e) throw notFound('일정을 찾을 수 없어요.')
  return e
}

eventsRouter.get(
  '/',
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    syncStaleInBackground(userId) // 연결된 캘린더가 오래됐으면 뒤에서 새로 읽는다 (다음 조회부터 반영)
    const rows = await prisma.event.findMany({ where: { userId }, orderBy: { startAt: 'asc' } })
    res.json(rows.map(serializeEvent))
  }),
)

eventsRouter.post(
  '/',
  wrap(async (req, res) => {
    const b = parse(createSchema, req.body)
    const times = buildTimes(b.startDate, b.endDate, b.startTime, b.endTime)
    const row = await prisma.event.create({
      data: { userId: (req as AuthedRequest).userId, title: b.title, kind: eventKindMap.toDb(b.kind), ...times, ...(await placeData(b.place, b.placeHint)) },
    })
    res.status(201).json(serializeEvent(row))
  }),
)

eventsRouter.get(
  '/:id',
  wrap(async (req, res) => {
    res.json(serializeEvent(await own(parse(idParam, req.params.id), (req as AuthedRequest).userId)))
  }),
)

eventsRouter.patch(
  '/:id',
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    const cur = await own(parse(idParam, req.params.id), userId)
    const b = parse(updateSchema, req.body)
    const data: Prisma.EventUpdateInput = {}
    if (b.title !== undefined) data.title = b.title
    if (b.kind !== undefined) data.kind = eventKindMap.toDb(b.kind)
    const touchesTime = b.startDate !== undefined || b.endDate !== undefined || b.startTime !== undefined || b.endTime !== undefined
    if (touchesTime) {
      const sd = b.startDate ?? kstDate(cur.startAt)
      let ed = b.endDate ?? kstDate(cur.endAt)
      if (ed < sd) ed = sd
      const times = buildTimes(sd, ed, b.startTime ?? kstTime(cur.startAt), b.endTime ?? kstTime(cur.endAt))
      Object.assign(data, times)
    }
    if (b.place !== undefined) Object.assign(data, await placeData(b.place, b.placeHint))
    if (touchesTime || b.place !== undefined || b.kind !== undefined) {
      // 예보 조건이 바뀌면 예보 단계/추천 판단을 초기화하고 Worker 가 다시 점검한다.
      Object.assign(data, { forecastStage: 'WAITING', recommendationVersion: 0, lastDecisionKey: null, lastCheckedAt: null })
    }
    res.json(serializeEvent(await prisma.event.update({ where: { id: cur.id }, data })))
  }),
)

eventsRouter.delete(
  '/:id',
  wrap(async (req, res) => {
    const e = await own(parse(idParam, req.params.id), (req as AuthedRequest).userId)
    await prisma.event.delete({ where: { id: e.id } })
    res.status(204).end()
  }),
)

eventsRouter.get(
  '/:id/outfit',
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    const e = await own(parse(idParam, req.params.id), userId)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const waiting = (message: string) =>
      res.json({ status: 'waiting', forecastStage: 'WAITING', recommendation: null, message })
    const c = await compute(user, e, e.startAt, e.endAt)
    if (!c) return waiting('아직 정확한 예보가 없어요.')
    const saved = await saveEventRecommendation(e, c)
    const stage = c.window.stage
    res.json({ status: 'ready', forecastStage: stage, recommendation: viewOf(saved, stage), message: null })
  }),
)
