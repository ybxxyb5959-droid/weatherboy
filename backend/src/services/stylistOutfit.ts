// 코디 상담 결과: 고른 분위기로 일정 기간 날씨에 맞는 코디를 옷장에서 뽑는다 (저장하지 않는 계산).
import type { Event, User } from '@prisma/client'
import { eventKindMap } from '../config/mappings.js'
import { styleLabel, type OutfitStyle } from '../rules/outfitStyle.js'
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
  style: OutfitStyle
  styleLabel: string
  items: unknown[]
  alternatives: unknown[][]
  headline: string
  sub: string
  needUmbrella: boolean
  needMask: boolean
  /** 옷장에 그 분위기에 맞는 옷이 충분했는지 (false 면 가장 가까운 옷으로 골랐다) */
  styleMatched: boolean
  insufficientWardrobe: boolean
}

/** 예보가 아직 없으면 null */
export async function stylistOutfit(user: User, e: Event, style: OutfitStyle): Promise<StylistOutfit | null> {
  const c = await compute(user, e, e.startAt, e.endAt, new Date(), undefined, style)
  if (!c) return null
  const r = c.result
  return {
    style,
    styleLabel: styleLabel[style],
    items: r.items,
    alternatives: r.alternatives,
    headline: r.headline,
    sub: r.sub,
    needUmbrella: r.needUmbrella,
    needMask: r.needMask,
    styleMatched: r.styleMatched ?? false,
    insufficientWardrobe: r.insufficientWardrobe,
  }
}
