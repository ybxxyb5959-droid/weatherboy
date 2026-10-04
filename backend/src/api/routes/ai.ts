import { Router, type RequestHandler } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { env } from '../../config/env.js'
import { aiEnabled } from '../../services/ai/explain.js'
import { clothesFromPhoto, clothingFromPhoto } from '../../services/ai/clothingVision.js'
import { parseEventText } from '../../services/ai/eventParse.js'
import { prisma } from '../../db.js'
import { OUTFIT_STYLES, styleLabel } from '../../rules/outfitStyle.js'
import { stylistApplicable } from '../../rules/outfitStyle.js'
import { defaultOptions, detectStyle, fallbackReply, stylistReply, type StyleOption } from '../../services/ai/stylist.js'
import { parseWish } from '../../rules/outfitWish.js'
import { eventKindMap } from '../../config/mappings.js'
import { setEventStyle, stylistContext, stylistOutfit } from '../../services/stylistOutfit.js'
import { badRequest, notFound } from '../../utils/errors.js'
import { kstDate } from '../../utils/time.js'
import { parse, requireAuth, wrap, type AuthedRequest } from '../middleware/common.js'

export const aiRouter = Router()
aiRouter.use(requireAuth)

// AI 호출은 비용이 들어서 사용자당 시간당 횟수를 제한한다.
const aiLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: env.NODE_ENV === 'test' ? 10_000 : 60, // 행거 사진 한 장이 3번 호출된다
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthedRequest).userId,
  validate: { keyGeneratorIpFallback: false },
  handler: (_req, res) => {
    res.status(429).json({ code: 'RATE_LIMITED', message: 'AI를 너무 자주 불렀어요. 잠시 후 다시 시도해주세요.' })
  },
})

aiRouter.get('/status', (_req, res) => {
  res.json({ enabled: aiEnabled() })
})

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
  aiLimiter,
  wrap(async (req, res) => {
    res.json(await clothingFromPhoto(readImage(req.body)))
  }),
)

// 옷장/행거 사진 한 장에서 옷 여러 벌을 찾는다 (사용자가 목록에서 골라 등록)
aiRouter.post(
  '/clothes-from-photo',
  aiLimiter,
  wrap(async (req, res) => {
    res.json({ items: await clothesFromPhoto(readImage(req.body)) })
  }),
)

const eventSchema = z.object({ text: z.string().trim().min(2).max(200) })

aiRouter.post(
  '/parse-event',
  aiLimiter,
  wrap(async (req, res) => {
    const { text } = parse(eventSchema, req.body)
    res.json(await parseEventText(text))
  }),
)

// AI 를 실제로 부르는 요청만 호출 한도에 센다. 칩(느낌을 직접 지정)과, 원하는 옷을 규칙으로 알아듣는 말("검정색 상의")은 AI 가 필요 없다.
const usesAi = (body: { text?: unknown; style?: unknown } | undefined) => typeof body?.text === 'string' && !body.style && !parseWish(body.text)
const stylistLimit: RequestHandler = (req, res, next) => (usesAi(req.body) ? aiLimiter(req, res, next) : next())

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
  stylistLimit,
  wrap(async (req, res) => {
    const b = parse(stylistSchema, req.body)
    const userId = (req as AuthedRequest).userId
    const event = await prisma.event.findFirst({ where: { id: b.eventId, userId } })
    if (!event) throw notFound('일정을 찾을 수 없어요.')
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    // "검정색 상의를 입고 싶어"처럼 원하는 옷을 말하면 옷장에 없어도 그 옷을 예시로 입혀 보여준다(AI 없이 규칙으로 알아듣는다)
    let wish = !b.style && b.text ? parseWish(b.text) : null
    let reply = ''
    let style = b.style ?? null
    let options: StyleOption[] = []
    if (!style && wish) {
      style = detectStyle(b.text!) // "검정 정장"처럼 느낌까지 말했으면 그 느낌도 같이
    } else if (!style) {
      const turn = await stylistReply(await stylistContext(user, event), b.history, b.text!)
      reply = turn.reply
      style = turn.style
      options = turn.options
      wish = turn.wish ?? null // 규칙으로 못 알아들은 말을 AI 가 원하는 옷으로 바꿔줬다면 그대로 쓴다
    }
    if (!style && !wish) return res.json({ reply, options, outfit: null })
    // 고른 분위기는 일정에 저장한다. 원하는 옷만 말했다면 느낌은 그대로 두고(저장하지 않고) 일정에 저장돼 있던 느낌으로 보여준다.
    const saved = b.preview || !style ? event : await setEventStyle(user, event, style)
    const outfit = await stylistOutfit(user, saved, style ?? event.outfitStyle ?? null, wish)
    if (!outfit) {
      const noForecast = '아직 이 날짜의 정확한 예보가 없어서, 예보가 열리면 골라드릴게요.'
      return res.json({ reply: style ? `${styleLabel[style]} 느낌으로 기억해 둘게요. ${noForecast}` : `말씀하신 옷은 기억해 두기 어려워요. ${noForecast}`, options: [], outfit: null, style: style ?? undefined })
    }
    const lack = '옷장에 딱 맞는 옷이 부족해서 가장 가까운 옷으로 골랐어요.'
    const sample = outfit.examples.length ? `옷장에 없는 ${outfit.examples.map((l) => l.replace(/\(예시\)/, '').trim()).join(', ')}은 예시로 입혀봤어요.` : ''
    let lead: string
    if (wish && !style) lead = outfit.examples.length ? `원하시는 옷을 입혀봤어요. ${sample}` : '원하시는 옷은 옷장에 있는 옷으로 입혀봤어요.'
    else if (sample) lead = `${reply || `${styleLabel[style!]} 스타일로 입혀봤어요.`} ${sample}`
    // AI 가 건넨 말이 있으면 그 뒤에 이어 붙이고, 없으면 분위기 이름으로 문장을 시작한다
    else lead = reply ? (outfit.styleMatched ? `${reply} 옷장에서 골라봤어요.` : `${reply} ${lack}`) : outfit.styleMatched ? `${styleLabel[style!]} 스타일로 옷장에서 골라봤어요.` : `${styleLabel[style!]} 스타일로 골라보고 싶었지만, ${lack}`
    // 옷이 부족하면 무엇이 있으면 좋은지, 피하지 못한 어색한 점이 있으면 솔직하게 알린다
    const extra = [outfit.warn, !outfit.styleMatched ? outfit.gap : null, ...outfit.tabooReasons.slice(0, 2)].filter((t): t is string => !!t)
    res.json({ reply: [lead, ...extra.map((t) => (/[.!?]$/.test(t) ? t : `${t}.`))].join(' '), options: [], outfit, style: style ?? undefined })
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
