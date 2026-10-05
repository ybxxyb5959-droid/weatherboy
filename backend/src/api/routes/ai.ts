import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { photoGuard, textGuard } from '../middleware/aiLimits.js'
import { checkQuota, getGlobalUsage, usageView } from '../../services/ai/aiQuota.js'
import { aiEnabled } from '../../services/ai/explain.js'
import { clothesFromPhoto, clothingFromPhoto, PHOTO_PARTS } from '../../services/ai/clothingVision.js'
import { parseEventText } from '../../services/ai/eventParse.js'
import { prisma } from '../../db.js'
import { OUTFIT_STYLES } from '../../rules/outfitStyle.js'
import { stylistApplicable } from '../../rules/outfitStyle.js'
import { defaultOptions, fallbackReply } from '../../services/ai/stylist.js'
import { applyEventWish, conditionForDate, conditionLabel, eventDates, parseEventWishRules, savedEventWish, wishOfCondition } from '../../rules/eventWish.js'
import { parseEventWishAi } from '../../services/ai/eventWishParse.js'
import { aiScope } from '../../services/ai/aiScope.js'
import { Prisma } from '@prisma/client'
import { eventKindMap } from '../../config/mappings.js'
import { setEventStyle, stylistContext, stylistOutfit } from '../../services/stylistOutfit.js'
import { badRequest, notFound } from '../../utils/errors.js'
import { kstDate } from '../../utils/time.js'
import { parse, requireAuth, wrap, type AuthedRequest } from '../middleware/common.js'

export const aiRouter = Router()
aiRouter.use(requireAuth)

aiRouter.get('/status', (_req, res) => {
  res.json({ enabled: aiEnabled() })
})

// 오늘 AI 사용량(남은 비율): 옷 등록 화면의 막대그래프가 쓴다. 서버 전체가 닫혀 있으면 open=false.
aiRouter.get(
  '/usage',
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    const [photo, text, g] = await Promise.all([checkQuota(userId, 'photo'), checkQuota(userId, 'text'), getGlobalUsage()])
    res.json({ open: g.open, photo: photo ? usageView(photo) : null, text: text ? usageView(text) : null })
  }),
)

const MAX_IMAGE_BYTES = 700 * 1024
const photoSchema = z.object({
  // 브라우저가 줄여서 보낸 data URL (data:image/jpeg;base64,...)
  image: z.string().min(100).max(1_000_000),
})

/** data URL 을 검증해 Gemini 로 넘길 이미지로 바꾼다. 사진은 분석에만 쓰고 저장하지 않는다. */
function readImage(body: unknown) {
  const { image } = parse(photoSchema, body)
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image)
  if (!m) throw badRequest('JPG, PNG, WEBP 사진만 올릴 수 있어요.')
  const base64 = m[2]!
  if (Math.floor((base64.length * 3) / 4) > MAX_IMAGE_BYTES) throw badRequest('사진이 너무 커요.')
  return { mimeType: m[1]!, base64 }
}

aiRouter.post(
  '/clothing-from-photo',
  photoGuard,
  wrap(async (req, res) => {
    res.json(await clothingFromPhoto(readImage(req.body)))
  }),
)

// 옷장/행거 사진 한 장에서 옷 여러 벌을 찾는다 (사용자가 목록에서 골라 등록)
aiRouter.post(
  '/clothes-from-photo',
  photoGuard,
  wrap(async (req, res) => {
    const part = parse(z.object({ part: z.enum(PHOTO_PARTS).default('all') }), req.body).part
    res.json({ items: await clothesFromPhoto(readImage(req.body), undefined, part) })
  }),
)

const eventSchema = z.object({ text: z.string().trim().min(2).max(200) })

aiRouter.post(
  '/parse-event',
  textGuard,
  wrap(async (req, res) => {
    const { text } = parse(eventSchema, req.body)
    res.json(await parseEventText(text))
  }),
)

// AI 를 실제로 부르는 요청만 호출 한도에 센다. 칩(느낌을 직접 지정)과, 원하는 옷을 규칙으로 알아듣는 말("검정색 상의")은 AI 가 필요 없다.
const usesAi = (body: { text?: unknown; style?: unknown } | undefined) => typeof body?.text === 'string' && !body.style && !parseEventWishRules(body.text, [])
// AI 를 쓰는 요청만 호출 기록에 묶고 한도(시간당, 하루)를 본다
const stylistLimit: RequestHandler = (req, res, next) => {
  if (!usesAi(req.body)) return next()
  const run = (i: number): void => {
    const h = textGuard[i]
    if (!h) return next()
    h(req, res, (err?: unknown) => (err ? next(err) : run(i + 1)))
  }
  run(0)
}

// 일정 상세의 코디 상담. text 로 말하면 분위기를 묻거나(options) 바로 코디(outfit)를 주고, style 을 골랐으면 AI 없이 바로 코디를 준다.
const stylistSchema = z
  .object({
    eventId: z.string().uuid(),
    text: z.string().trim().min(1).max(300).optional(),
    style: z.enum(OUTFIT_STYLES).optional(),
    /** true 면 코디만 계산해서 보여주고 일정에는 저장하지 않는다(눌러보며 비교하는 미리보기) */
    preview: z.boolean().optional(),
    history: z.array(z.object({ role: z.enum(['user', 'ai']), text: z.string().max(300) })).max(12).default([]),
  })
  .refine((b) => b.text || b.style)

// 캐릭터가 먼저 말을 거는 첫 화면: 일정 제목에 맞는 인사와 선택지 (AI 를 부르지 않아 바로 열린다)
aiRouter.get(
  '/event-stylist/:eventId/start',
  wrap(async (req, res) => {
    const eventId = parse(z.string().uuid(), req.params.eventId)
    const event = await prisma.event.findFirst({ where: { id: eventId, userId: (req as AuthedRequest).userId } })
    if (!event) throw notFound('일정을 찾을 수 없어요.')
    const ctx = { title: event.title, kind: eventKindMap.toUi(event.kind) }
    // 여행·등산 같은 야외 일정은 날씨 엔진이 이미 반영하므로, 격식 있는 자리가 아니면 분위기를 묻지 않는다. 다만 며칠짜리(연박) 일정은 날마다 코디가 다르니 도우미를 보여준다
    const multiDay = kstDate(event.startAt) !== kstDate(event.endAt)
    res.json({ reply: fallbackReply(ctx), options: defaultOptions(ctx), applicable: multiDay || stylistApplicable(ctx.kind, ctx.title) })
  }),
)

aiRouter.post(
  '/event-stylist',
  aiScope('text'),
  stylistLimit,
  wrap(async (req, res) => {
    const b = parse(stylistSchema, req.body)
    const userId = (req as AuthedRequest).userId
    const event = await prisma.event.findFirst({ where: { id: b.eventId, userId } })
    if (!event) throw notFound('일정을 찾을 수 없어요.')
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const dates = eventDates(event)
    const oldPlan = savedEventWish(event.outfitWish)
    const parsed = b.style
      ? { patches: [{ date: 'ALL', condition: { style: b.style, pieces: [] } }] }
      : parseEventWishRules(b.text!, dates) ?? await parseEventWishAi(await stylistContext(user, event), dates, oldPlan, b.text!)
    if ('question' in parsed && parsed.question) return res.json({ reply: parsed.question, options: 'options' in parsed ? parsed.options ?? [] : [], outfit: null })
    const plan = applyEventWish(oldPlan, parsed.patches, dates)
    let saved = { ...event, outfitWish: plan as unknown as Prisma.JsonValue }
    const first = conditionForDate(plan, dates[0]!)
    const allStyle = plan.all.style
    if (!b.preview) {
      // 읽기-수정-쓰기 사이에 다른 탭이 변경했으면 조용히 덮어쓰지 않는다.
      const changed = await prisma.event.updateMany({
        where: { id: event.id, userId, updatedAt: event.updatedAt },
        data: { outfitWish: plan as unknown as Prisma.InputJsonValue, ...(allStyle !== undefined ? { outfitStyle: allStyle } : {}) },
      })
      if (!changed.count) return res.status(409).json({ code: 'OUTFIT_CHANGED', message: '다른 화면에서 조건이 바뀌었어요. 다시 불러온 뒤 말씀해주세요.' })
      saved = await prisma.event.findUniqueOrThrow({ where: { id: event.id } })
      if (allStyle !== undefined && saved.lastDecisionKey) saved = await setEventStyle(user, saved, allStyle)
    }
    const style = first.style ?? saved.outfitStyle ?? null
    const outfit = await stylistOutfit(user, saved, style, wishOfCondition(first))
    const applied = dates.map((date, i) => ({ date, day: i + 1, label: conditionLabel(conditionForDate(plan, date)) }))
    const summary = applied.filter((a) => a.label).map((a) => `${a.day}일차: ${a.label}`).join(' / ')
    const reply = `${summary || '기본 날씨 코디'}로 ${b.preview ? '미리 보여드려요' : '기억했어요'}. ${dates.length > 1 ? '캐릭터는 첫날 코디예요. 날짜별 카드를 확인해주세요.' : ''}`
    res.json({ reply: `${reply}${outfit ? outfit.warn ? ` ${outfit.warn}` : '' : ' 예보가 열리면 이 조건으로 골라드릴게요.'}`, options: [], outfit, style: style ?? undefined, changed: !b.preview, applied })
  }),
)

// 분위기를 해제하고 날씨만 보고 고르던 상태로 돌아간다
aiRouter.delete(
  '/event-stylist/:eventId',
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    const eventId = parse(z.string().uuid(), req.params.eventId)
    const event = await prisma.event.findFirst({ where: { id: eventId, userId } })
    if (!event) throw notFound('일정을 찾을 수 없어요.')
    await setEventStyle(await prisma.user.findUniqueOrThrow({ where: { id: userId } }), event, null)
    res.status(204).end()
  }),
)
