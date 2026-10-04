// 코디 상담 결과: 고른 분위기로 일정 기간 날씨에 맞는 코디를 옷장에서 뽑는다 (저장하지 않는 계산).
import type { Event, User } from '@prisma/client'
import { eventKindMap } from '../config/mappings.js'
import { styleGapHint, styleLabel, type OutfitStyle } from '../rules/outfitStyle.js'
import { applySuit, applyWish, toEngineWish, type Wish } from '../rules/outfitWish.js'
import type { OutingPoint } from '../rules/outfitEngine.js'
import { kstDate } from '../utils/time.js'
import type { StylistContext } from './ai/stylist.js'
import { prisma } from '../db.js'
import { compute } from './recommendationService.js'

/** 예: "최저 12° · 최고 21° · 비 소식 있음" */
export function weatherText(points: OutingPoint[]): string {
  if (points.length === 0) return ''
  const temps = points.map((p) => p.temp)
  const rain = points.some((p) => p.pop >= 50 || p.precip !== 'none')
  return `최저 ${Math.round(Math.min(...temps))}° · 최고 ${Math.round(Math.max(...temps))}° · ${rain ? '비 소식 있음' : '비 소식 없음'}`
}

export function dateText(e: Pick<Event, 'startAt' | 'endAt'>): string {
  const s = kstDate(e.startAt)
  const en = kstDate(e.endAt)
  return s === en ? s : `${s} ~ ${en}`
}

export async function stylistContext(user: User, e: Event): Promise<StylistContext> {
  const c = await compute(user, e, e.startAt, e.endAt).catch(() => null) // 예보/위치 문제로 못 구해도 상담은 계속한다
  return { title: e.title, kind: eventKindMap.toUi(e.kind), place: e.placeName, dateText: dateText(e), weatherText: c ? weatherText(c.window.points) : '' }
}

/**
 * 일정에 고른 분위기를 저장(null 이면 해제)한다. 푸시는 코디가 바뀌면 "바뀌었어요" 알림을 보내는데,
 * 사용자가 직접 바꾼 것은 알릴 일이 아니라서 이미 알림 기준이 있는 일정은 그 기준도 새 코디에 맞춰 둔다.
 */
export async function setEventStyle(user: User, e: Event, style: OutfitStyle | null): Promise<Event> {
  const updated = await prisma.event.update({ where: { id: e.id }, data: { outfitStyle: style } })
  if (updated.lastDecisionKey) {
    const c = await compute(user, updated, updated.startAt, updated.endAt).catch(() => null)
    if (c) await prisma.event.update({ where: { id: e.id }, data: { lastDecisionKey: c.result.decisionKey } })
  }
  return updated
}

export interface StylistOutfit {
  style: OutfitStyle | null
  styleLabel: string | null
  items: unknown[]
  /** 옷장에 없어서 예시로 입힌 옷들의 이름(없으면 빈 배열) */
  examples: string[]
  /** 말한 대로 했지만 알려둘 점(예: 겉옷 없이는 추울 수 있어요). 없으면 null */
  warn: string | null
  alternatives: unknown[][]
  headline: string
  sub: string
  needUmbrella: boolean
  needMask: boolean
  /** 옷장에 그 분위기에 맞는 옷이 충분했는지 (false 면 가장 가까운 옷으로 골랐다) */
  styleMatched: boolean
  insufficientWardrobe: boolean
  /** 그 분위기에 맞는 옷이 옷장에 부족할 때, 무엇이 있으면 좋은지 한 줄(없으면 null) */
  gap: string | null
  /** 고른 조합에서 그 자리에 어색한 점(대안이 없어 피하지 못한 경우) */
  tabooReasons: string[]
}

/**
 * 예보가 아직 없으면 null. style 이 null 이면 느낌 없이 날씨와 옷장만으로 고른 코디(원하는 옷만 말한 경우).
 * 포멀이면 정장 세트를, 원하는 옷(wish)이 있으면 그 옷을, 옷장에 없어도 예시로 입힌다.
 */
export async function stylistOutfit(user: User, e: Event, style: OutfitStyle | null, wish?: Wish | null): Promise<StylistOutfit | null> {
  const c = await compute(user, e, e.startAt, e.endAt, new Date(), undefined, style ?? undefined, wish ? toEngineWish(wish) : undefined)
  if (!c) return null
  const r = c.result
  let items = r.items
  const examples: string[] = []
  if (style === 'FORMAL') {
    const s = applySuit(items)
    items = s.items
    examples.push(...s.filled)
  }
  if (wish) {
    const w = applyWish(items, wish)
    items = w.items
    examples.push(...w.applied)
  }
  return {
    style,
    styleLabel: style ? styleLabel[style] : null,
    items,
    examples: [...new Set(examples)],
    warn: wish?.noOuter && r.needOuter ? '날씨가 쌀쌀해서 겉옷 없이는 추울 수 있어요.' : null,
    alternatives: r.alternatives,
    headline: r.headline,
    sub: r.sub,
    needUmbrella: r.needUmbrella,
    needMask: r.needMask,
    styleMatched: r.styleMatched ?? false,
    insufficientWardrobe: r.insufficientWardrobe,
    gap: style && !examples.length ? styleGapHint(style, c.wardrobe.filter((w) => w.owned).map((w) => w.type)) : null,
    tabooReasons: r.tabooReasons ?? [],
  }
}
