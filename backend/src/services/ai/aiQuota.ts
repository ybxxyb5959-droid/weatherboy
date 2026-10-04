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

/** 최근 24시간 전체 AI 호출 수. 읽지 못하면 열려 있는 것으로 본다(기록 장애로 기능이 막히지 않게). */
export async function getGlobalUsage(now = Date.now()): Promise<GlobalUsage> {
  if (globalCache && now - globalCache.at < GLOBAL_TTL_MS) return globalCache.value
  const cap = env.AI_GLOBAL_DAILY
  try {
    const used = await prisma.aiCallLog.count({ where: { createdAt: { gte: new Date(now - 24 * 3600_000) } } })
    const value = globalUsageOf(used, cap)
    globalCache = { at: now, value }
    return value
  } catch {
    return { open: true, used: 0, cap }
  }
}

export const busyMessage = (kind: AiKind) => (kind === 'photo' ? '오늘은 AI 사용이 많아서 잠시 쉬어요. 직접 등록해 주세요.' : '오늘은 AI 사용이 많아서 잠시 쉬어요.')
export const BUSY_CODE = 'AI_BUSY'

// ───── 자동 설명(AI 설명 문장) 한도 ─────
// 설명은 사용자가 누르는 게 아니라 추천을 만들 때 서버가 알아서 부른다. 한도에 걸리면 막지 않고 템플릿 문장으로 대신한다.
// 호출 기록은 응답이 끝난 뒤에 남으므로, 동시에 나가는 호출은 기록 수만으로는 셀 수 없다.
// 그래서 "지금 진행 중인 설명 호출 수"를 프로세스 메모리에 두고 기록 수에 더해 판단한다(서버가 1대일 때 유효. 여러 대가 되면 DB 로 옮긴다).
const explainInflight = new Map<string, number>()
let explainInflightTotal = 0

export type ExplainReservation = { ok: true; release: () => void } | { ok: false; reason: 'user_limit' | 'busy' }

/** 순수 판단: 이미 쓴 수 + 진행 중인 수(자기 자신 포함)가 한도를 넘으면 안 된다. */
export const withinCap = (used: number, inflight: number, cap: number) => used + inflight <= cap

/**
 * 설명 호출 한 건의 자리를 잡는다. ok 면 호출 뒤(호출 기록을 남긴 다음)에 release() 를 꼭 부른다.
 * 자리를 먼저(동기로) 잡고 나서 기록을 읽기 때문에, 동시에 들어온 요청은 서로의 자리를 본다. 경계에서는 보수적으로 둘 다 막힐 수 있다.
 * 기록을 읽지 못하면 진행 중인 수만으로 판단한다(기록 장애로 설명이 막히지 않게. 막혀도 템플릿이라 해는 작다).
 */
export async function reserveExplain(userId: string, now = new Date()): Promise<ExplainReservation> {
  explainInflight.set(userId, (explainInflight.get(userId) ?? 0) + 1)
  explainInflightTotal++
  let released = false
  const release = () => {
    if (released) return
    released = true
    const left = (explainInflight.get(userId) ?? 1) - 1
    if (left > 0) explainInflight.set(userId, left)
    else explainInflight.delete(userId)
    explainInflightTotal--
  }
  try {
    const mine = explainInflight.get(userId) ?? 1
    const total = explainInflightTotal
    const since = new Date(now.getTime() - 24 * 3600_000)
    const [g, used] = await Promise.all([
      getGlobalUsage(now.getTime()),
      prisma.aiCallLog.count({ where: { userId, kind: 'explain', createdAt: { gte: since } } }).catch(() => 0),
    ])
    if (!withinCap(g.used, total, g.cap)) {
      release()
      return { ok: false, reason: 'busy' }
    }
    if (!withinCap(used, mine, env.AI_EXPLAIN_DAILY)) {
      release()
      return { ok: false, reason: 'user_limit' }
    }
    return { ok: true, release }
  } catch (e) {
    release()
    throw e
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
