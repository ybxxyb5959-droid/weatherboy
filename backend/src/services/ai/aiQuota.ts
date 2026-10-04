// 하루 사용량 한도. 시간당 한도(aiLimits.ts)가 "짧은 시간에 몰리는 것"을 막는다면, 이쪽은 "하루 총량"을 막는다.
// 가입 후 얼마 동안(보너스 시간)은 넉넉하게 허용한다: 옷장을 처음 채우는 때에 막히지 않게.
import { env } from '../../config/env.js'
import { prisma } from '../../db.js'
import type { AiKind } from './aiScope.js'

export interface QuotaConfig {
  /** 일반 사용자의 하루(최근 24시간) 호출 수 */
  daily: Record<AiKind, number>
  /** 가입 직후 보너스 기간의 하루 호출 수 */
  newUser: Record<AiKind, number>
  /** 가입 후 이 시간(시간 단위) 동안을 신규로 본다 */
  newUserHours: number
}

export const quotaConfig = (): QuotaConfig => ({
  daily: { photo: env.AI_PHOTO_DAILY, text: env.AI_TEXT_DAILY },
  newUser: { photo: env.AI_PHOTO_NEWUSER, text: env.AI_TEXT_NEWUSER },
  newUserHours: env.AI_NEWUSER_HOURS,
})

export interface QuotaDecision {
  ok: boolean
  /** 이 사용자의 지금 한도(호출 수) */
  limit: number
  used: number
  isNewUser: boolean
}

/** 순수 계산: 가입 시각과 최근 24시간 호출 수로 더 부를 수 있는지 정한다. */
export function decideQuota(input: { kind: AiKind; userCreatedAt: Date; now: Date; used24h: number; config: QuotaConfig }): QuotaDecision {
  const { kind, userCreatedAt, now, used24h, config } = input
  const isNewUser = now.getTime() - userCreatedAt.getTime() < config.newUserHours * 3600_000
  const limit = isNewUser ? Math.max(config.newUser[kind], config.daily[kind]) : config.daily[kind]
  return { ok: used24h < limit, limit, used: used24h, isNewUser }
}

/** DB 에서 가입 시각과 최근 24시간 호출 수를 읽어 판단한다. 기록을 못 읽으면 막지 않는다(AI 가 아니라 기록 장애로 막히면 안 되므로). */
export async function checkQuota(userId: string, kind: AiKind, now = new Date()): Promise<QuotaDecision | null> {
  try {
    const since = new Date(now.getTime() - 24 * 3600_000)
    const [user, used24h] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
      prisma.aiCallLog.count({ where: { userId, kind, createdAt: { gte: since } } }),
    ])
    if (!user) return null
    return decideQuota({ kind, userCreatedAt: user.createdAt, now, used24h, config: quotaConfig() })
  } catch {
    return null
  }
}

/** 하루 한도에 걸렸을 때 사용자에게 보여줄 한 문장 */
export const quotaMessage = (kind: AiKind) => (kind === 'photo' ? '오늘 사진 인식은 다 썼어요. 내일 다시 쓸 수 있어요.' : '오늘 말로 입력은 다 썼어요. 내일 다시 쓸 수 있어요.')
export const quotaCode = (kind: AiKind) => (kind === 'photo' ? 'PHOTO_DAILY_LIMIT' : 'AI_DAILY_LIMIT')
