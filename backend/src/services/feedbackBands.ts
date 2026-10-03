import type { FeedbackRating, User } from '@prisma/client'
import { ruleConfig } from '../config/ruleConfig.js'
import { feedbackBandOf, type FeedbackBand, type FeedbackBands } from '../rules/outfitEngine.js'

const BANDS: FeedbackBand[] = ['low', 'mid', 'high']
const clamp = (n: number) => Math.max(-ruleConfig.feedbackOffsetLimit, Math.min(ruleConfig.feedbackOffsetLimit, n))

/** 저장된 기온대별 보정. 값이 없는 칸은 0 */
export function bandsOf(u: Pick<User, 'feedbackBandsJson'>): FeedbackBands {
  const raw = (u.feedbackBandsJson ?? {}) as Partial<Record<FeedbackBand, unknown>>
  const out = { low: 0, mid: 0, high: 0 }
  for (const b of BANDS) {
    const v = raw[b]
    if (typeof v === 'number' && Number.isFinite(v)) out[b] = clamp(v)
  }
  return out
}

/** 기온대별 보정의 평균 (예전 단일 보정값 자리에 남겨두는 값) */
export const averageOf = (b: FeedbackBands) => Math.round(((b.low + b.mid + b.high) / 3) * 100) / 100

/**
 * 후기 하나를 반영한 새 보정. '딱 좋아요'는 지금 보정이 맞다는 뜻이라 값을 바꾸지 않는다.
 * 대신 최근 후기에 '딱 좋아요'가 많을수록 추웠어요/더웠어요의 조정 폭을 줄여서 값이 출렁이지 않게 한다.
 * @param band 후기를 쌓을 기온대
 * @param recent 이번 후기 이전의, 추천대로 입고 남긴 최근 후기(최신순)
 */
export function applyFeedback(bands: FeedbackBands, band: FeedbackBand, rating: FeedbackRating, recent: FeedbackRating[]): FeedbackBands {
  const base = ruleConfig.feedbackStep[rating]
  if (base === 0) return bands
  const oks = recent.slice(0, ruleConfig.feedbackDampenWindow).filter((r) => r === 'OK').length
  const factor = Math.max(ruleConfig.feedbackDampenMin, 1 - ruleConfig.feedbackDampenPerOk * oks)
  return { ...bands, [band]: clamp(Math.round((bands[band] + base * factor) * 100) / 100) }
}

/** 저장된 추천이 쓴 기온대. 예전 추천에는 기록이 없어서 판단 기온으로 다시 구한다 */
export function bandOfRecommendation(result: { feedbackBand?: FeedbackBand; judgedTemp?: number }): FeedbackBand {
  return result.feedbackBand ?? feedbackBandOf(result.judgedTemp ?? 15)
}
