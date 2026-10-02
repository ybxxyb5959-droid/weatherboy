import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { env } from '../../config/env.js'
import { aiEnabled } from '../../services/ai/explain.js'
import { clothesFromPhoto, clothingFromPhoto } from '../../services/ai/clothingVision.js'
import { parseEventText } from '../../services/ai/eventParse.js'
import { badRequest } from '../../utils/errors.js'
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
