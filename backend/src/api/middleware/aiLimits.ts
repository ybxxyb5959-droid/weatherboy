import rateLimit from 'express-rate-limit'
import { env } from '../../config/env.js'
import type { AuthedRequest } from './common.js'

// AI 호출은 비용이 들어서 사용자당 시간당 횟수를 제한한다.
// 사진 인식과 말 입력(일정 문장·코디 도우미)은 따로 센다: 옷장 사진을 많이 올려도 일정 입력이나 코디 상담이 막히지 않게.
export type AiLimitKind = 'photo' | 'text'

const WHAT: Record<AiLimitKind, { code: string; name: string }> = {
  photo: { code: 'PHOTO_RATE_LIMITED', name: '사진 인식' },
  text: { code: 'AI_RATE_LIMITED', name: '말로 입력' },
}

/** 한도에 걸렸을 때 사용자에게 보여줄 한 문장: 무엇이 막혔고 언제 다시 되는지. 그동안 할 일은 화면의 버튼이 알려준다. */
export function limitMessage(kind: AiLimitKind, resetInMs: number | null): string {
  const when = resetInMs == null ? '잠시 뒤에' : resetInMs < 90_000 ? '1분 뒤에' : `${Math.ceil(resetInMs / 60_000)}분 뒤에`
  return `${WHAT[kind].name}은 ${when} 다시 쓸 수 있어요.`
}

export function createAiLimiter(kind: AiLimitKind, opts: { limit?: number } = {}) {
  return rateLimit({
    windowMs: 60 * 60_000,
    // 사진 한 장은 여러 조각으로 나뉘어 여러 번 호출된다(옷장 스캔)
    limit: opts.limit ?? (env.NODE_ENV === 'test' ? 10_000 : 60),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => (req as AuthedRequest).userId,
    validate: { keyGeneratorIpFallback: false },
    handler: (req, res) => {
      const reset = (req as unknown as { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime
      const resetInMs = reset ? Math.max(0, reset.getTime() - Date.now()) : null
      res.status(429).json({ code: WHAT[kind].code, message: limitMessage(kind, resetInMs) })
    },
  })
}

/** 사진 인식(옷 한 벌, 옷장 스캔) */
export const photoLimiter = createAiLimiter('photo')
/** 말 입력(일정 문장, 코디 도우미) */
export const textLimiter = createAiLimiter('text')
