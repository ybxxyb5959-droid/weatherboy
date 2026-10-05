// 하루 사용량 한도. 시간당 한도(aiLimits.ts)가 "짧은 시간에 몰리는 것"을 막는다면, 이쪽은 "하루 총량"을 막는다.
// 가입 후 얼마 동안(보너스 시간)은 넉넉하게 허용한다: 옷장을 처음 채우는 때에 막히지 않게.
import { env } from '../../config/env.js'
import { prisma } from '../../db.js'
import { logger } from '../../utils/logger.js'
import type { AiKind, AiLogKind } from './aiScope.js'

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

/** 사용량을 읽을 수 없으면 null. 호출하는 쪽은 반드시 AI 를 닫는다. */
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

// ───── 서버 전체 하루 상한 ─────
export interface GlobalUsage {
  open: boolean
  used: number
  cap: number
}
/** 순수 판단: 서버 전체 호출 수가 상한 미만이면 열려 있다 */
export const globalUsageOf = (used: number, cap: number): GlobalUsage => ({ open: used < cap, used, cap })

let globalCache: { at: number; value: GlobalUsage } | null = null
const GLOBAL_TTL_MS = 30_000 // 요청마다 전체를 세지 않게 잠깐 기억한다

export const resetGlobalCache = () => {
  globalCache = null
}

/** 표시용 조회는 잠깐 캐시한다. 실제 호출 예약은 항상 최신 사용량을 읽고 장애 시 닫는다. */
export async function getGlobalUsage(now = Date.now(), fresh = false): Promise<GlobalUsage> {
  if (logUnavailable) return { open: false, used: 0, cap: env.AI_GLOBAL_DAILY }
  if (!fresh && globalCache && now - globalCache.at < GLOBAL_TTL_MS) return globalCache.value
  const cap = env.AI_GLOBAL_DAILY
  try {
    const used = await prisma.aiCallLog.count({ where: { createdAt: { gte: new Date(now - 24 * 3600_000) } } })
    const value = globalUsageOf(used, cap)
    globalCache = { at: now, value }
    return value
  } catch {
    return { open: false, used: 0, cap }
  }
}

export const busyMessage = (kind: AiKind) => (kind === 'photo' ? '오늘은 AI 사용이 많아서 잠시 쉬어요. 직접 등록해 주세요.' : '오늘은 AI 사용이 많아서 잠시 쉬어요.')
export const BUSY_CODE = 'AI_BUSY'

// ───── 모든 종류의 DB 공통 예약 ─────
// API/worker 가 같은 DB 잠금을 사용한다. 예약 행을 호출 전에 커밋하므로
// 동시 요청·프로세스 재시작에도 호출 상한을 다시 받을 수 없다.
let logUnavailable = false
export const stopAiOnLogFailure = () => { logUnavailable = true; globalCache = null }

export type AiReservation = { ok: true; id: string } | { ok: false; reason: 'user_limit' | 'busy' }

/** 순수 판단: 이미 쓴 수 + 진행 중인 수(자기 자신 포함)가 한도를 넘으면 안 된다. */
export const withinCap = (used: number, inflight: number, cap: number) => used + inflight <= cap

/** 예약도 사용량으로 센다. 중단되거나 실패해도 예약을 지워 상한을 되돌리지 않는다. */
export async function reserveAi(userId: string, kind: AiLogKind, now = new Date()): Promise<AiReservation> {
  if (logUnavailable) return { ok: false, reason: 'busy' }
  try {
    const since = new Date(now.getTime() - 24 * 3600_000)
    const result = await prisma.$transaction(async (tx): Promise<AiReservation> => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('weather-boy-ai-quota'))::text`
      const global = await tx.aiCallLog.count({ where: { createdAt: { gte: since } } })
      if (!withinCap(global, 1, env.AI_GLOBAL_DAILY)) return { ok: false, reason: 'busy' }
      const user = await tx.user.findUnique({ where: { id: userId }, select: { createdAt: true } })
      if (!user) return { ok: false, reason: 'busy' }
      const used = await tx.aiCallLog.count({ where: { userId, kind, createdAt: { gte: since } } })
      const limit = kind === 'explain' ? env.AI_EXPLAIN_DAILY : decideQuota({ kind, userCreatedAt: user.createdAt, now, used24h: used, config: quotaConfig() }).limit
      if (!withinCap(used, 1, limit)) return { ok: false, reason: 'user_limit' }
      const row = await tx.aiCallLog.create({ data: { userId, kind, model: 'reserved', status: 'PARTIAL', fallback: false } })
      return { ok: true, id: row.id }
    }, { maxWait: 10_000 })
    resetGlobalCache()
    return result
  } catch (e) {
    logger.warn({ error: e instanceof Error ? e.message : String(e) }, 'ai reservation failed')
    return { ok: false, reason: 'busy' }
  }
}

/** 화면에 보여줄 사용량(남은 비율). 한도를 넘었으면 0. */
export interface UsageView {
  used: number
  limit: number
  remainingPct: number
  isNewUser: boolean
}
export const usageView = (d: QuotaDecision): UsageView => ({ used: d.used, limit: d.limit, remainingPct: Math.max(0, Math.min(100, Math.round(((d.limit - d.used) / d.limit) * 100))), isNewUser: d.isNewUser })
