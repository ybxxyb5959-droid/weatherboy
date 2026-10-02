// 결정론적 옷차림 Rule Engine. 같은 입력 -> 같은 출력. DB/외부 호출 없음. AI 사용 금지.
import type { ClothingCategory, ClothingPattern, ClothingType, EventKind, Sensitivity, Thickness } from '@prisma/client'
import { clothingTypeMap, colorMap, patternMap } from '../config/mappings.js'
import { ruleConfig } from '../config/ruleConfig.js'
import { kstDate, toKstParts } from '../utils/time.js'
import { NOT_WINDPROOF_OUTER, deriveClothing } from './clothing.js'

export type PrecipType = 'none' | 'rain' | 'snow' | 'sleet' | 'shower'

export interface OutingPoint {
  at: Date
  temp: number
  feels: number
  pop: number // 강수확률 %
  precip: PrecipType
  wind: number // m/s
}

export interface WardrobeItem {
  id: string
  type: ClothingType
  thickness: Thickness
  color: string // DB enum 값 (예: GRAY)
  pattern?: ClothingPattern
  category: ClothingCategory
  warmth: number
  windproof: boolean
  waterproof: boolean
  owned: boolean
  /** 옷장에 담은 시각 (최근에 담은 옷을 우선 추천하는 데 쓴다) */
  createdAt?: Date
}

export interface EngineInput {
  points: OutingPoint[]
  sensitivity: Sensitivity
  feedbackOffset: number
  eventKind: EventKind | null
  clothes: WardrobeItem[]
  airGrade: number | null // AirKorea 1~4, 데이터 없으면 null
  /** 있으면 알맞은 조합이 여럿일 때 이 값(예: 사용자+날짜)으로 하나를 골라 매일 조금씩 다르게 추천한다. 같은 값이면 항상 같은 결과. */
  varietySeed?: string
  /** 기준 시각 (최근에 담은 옷 판단용, 기본은 지금) */
  now?: Date
  feelsMethod?: string // 체감온도 산출 방식(Reason Code용)
}

export interface OutfitItem {
  clothingId: string | null
  type: string // 한글
  color: string // 한글
  pattern: string // 한글 (무지/체크/줄무늬/도트/프린트)
  label: string
  owned: boolean
}

export interface EngineResult {
  items: OutfitItem[]
  needOuter: boolean
  needUmbrella: boolean
  needMask: boolean
  maskDataAvailable: boolean
  headline: string
  sub: string
  reasonCodes: string[]
  reasons: string[]
  alternatives: OutfitItem[][]
  insufficientWardrobe: boolean
  judgedTemp: number
  requiredWarmth: number
  decisionKey: string
}

const ALL_TYPES = clothingTypeMap.uiValues.map((k) => clothingTypeMap.toDb(k))

/** 빈 옷장일 때 쓰는 일반 추천용 가상 옷장(보유 아님). */
export function genericWardrobe(): WardrobeItem[] {
  return ALL_TYPES.map((type) => {
    const d = deriveClothing(type, 'NORMAL')
    const outer = d.category === 'LIGHT_OUTER' || d.category === 'HEAVY_OUTER'
    return {
      id: `generic-${type}`,
      type,
      thickness: 'NORMAL' as Thickness,
      color: 'OTHER',
      category: d.category,
      warmth: d.warmth,
      windproof: outer && !NOT_WINDPROOF_OUTER.has(type),
      waterproof: type === 'WINDBREAKER',
      owned: false,
    }
  })
}

export function requiredWarmthFor(temp: number): number {
  for (const row of ruleConfig.requiredWarmth) if (temp >= row.minTemp) return row.required
  return 13
}

export function judgeTemperature(input: Pick<EngineInput, 'points' | 'sensitivity' | 'feedbackOffset' | 'eventKind'>): number {
  const feels = input.points.map((p) => p.feels)
  const avg = feels.reduce((a, b) => a + b, 0) / feels.length
  const min = Math.min(...feels)
  const kind = input.eventKind ?? 'OTHER'
  const w = ruleConfig.minTempWeight[kind]
  const blended = (1 - w) * avg + w * min
  const adj = ruleConfig.sensitivityOffset[input.sensitivity] + input.feedbackOffset + ruleConfig.eventTempAdjust[kind]
  return Math.round((blended + adj) * 10) / 10
}

function itemOf(c: WardrobeItem): OutfitItem {
  const type = clothingTypeMap.toUi(c.type)
  const color = c.owned ? colorMap.toUi(c.color as never) : '기타'
  const pattern = c.owned && c.pattern ? patternMap.toUi(c.pattern) : '무지'
  const label = c.owned && color !== '기타' ? `${color}${pattern !== '무지' ? ` ${pattern}` : ''} ${type}` : type
  return { clothingId: c.owned ? c.id : null, type, color, pattern, label, owned: c.owned }
}

interface Candidate {
  top: WardrobeItem
  bottom: WardrobeItem
  outer: WardrobeItem | null
  total: number
}

function buildCandidates(pool: WardrobeItem[]): Candidate[] {
  const tops = pool.filter((c) => c.category === 'TOP')
  const bottoms = pool.filter((c) => c.category === 'BOTTOM')
  const outers = pool.filter((c) => c.category === 'LIGHT_OUTER' || c.category === 'HEAVY_OUTER')
  const cands: Candidate[] = []
  for (const top of tops)
    for (const bottom of bottoms)
      for (const outer of [null, ...outers])
        cands.push({ top, bottom, outer, total: top.warmth + bottom.warmth + (outer?.warmth ?? 0) })
  return cands
}

/** 문자열 -> 0 이상의 정수 (같은 문자열이면 항상 같은 값) */
function hashOf(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
  return h
}

const keyOf = (c: Candidate) => `${c.top.id}|${c.bottom.id}|${c.outer?.id ?? ''}`

export function recommend(input: EngineInput): EngineResult {
  if (input.points.length === 0) throw new Error('points must not be empty')
  const judged = judgeTemperature(input)
  const required = requiredWarmthFor(judged)
  const maxWind = Math.max(...input.points.map((p) => p.wind))
  const needUmbrella = input.points.some((p) => p.pop >= ruleConfig.umbrellaPopThreshold || p.precip !== 'none')
  const windy = maxWind >= ruleConfig.windStrongMs
  const maskDataAvailable = input.airGrade != null
  const needMask = maskDataAvailable && (input.airGrade as number) >= ruleConfig.maskMinGrade
  const temps = input.points.map((p) => p.temp)
  const diurnal = Math.max(...temps) - Math.min(...temps)

  const own = input.clothes.filter((c) => c.owned)
  const hasOwn = own.length > 0

  const rank = (c: Candidate): (number | string)[] => {
    const o = c.outer
    const windPen = windy && (!o || !o.windproof) ? 1 : 0
    const rainPen = needUmbrella && o && !o.waterproof ? 1 : 0
    return [windPen, rainPen, c.total, o ? 1 : 0, c.top.id, c.bottom.id, o?.id ?? '']
  }
  const cmp = (a: Candidate, b: Candidate) => {
    const ra = rank(a)
    const rb = rank(b)
    for (let i = 0; i < ra.length; i++) {
      if (ra[i]! < rb[i]!) return -1
      if (ra[i]! > rb[i]!) return 1
    }
    return 0
  }

  let cands = buildCandidates(own)
  let insufficient = false
  let valid = cands.filter((c) => c.total >= required)
  if (valid.length === 0) {
    insufficient = true
    if (cands.length > 0) {
      // 보유 옷 중 보온이 가장 높은(가장 근접한) 조합
      const maxTotal = Math.max(...cands.map((c) => c.total))
      valid = cands.filter((c) => c.total === maxTotal)
    } else {
      // 상의/하의가 없는 옷장 -> 일반 타입 추천(owned=false)
      cands = buildCandidates(genericWardrobe())
      valid = cands.filter((c) => c.total >= required)
      if (valid.length === 0) {
        const maxTotal = Math.max(...cands.map((c) => c.total))
        valid = cands.filter((c) => c.total === maxTotal)
      }
    }
  }
  valid.sort(cmp)
  let best = valid[0]!
  const newSince = (input.now ?? new Date()).getTime() - ruleConfig.newItemDays * 86400_000
  const isNew = (i: WardrobeItem | null) => !!i?.createdAt && i.createdAt.getTime() >= newSince
  if (input.varietySeed && !insufficient) {
    // 가장 가벼운 알맞은 조합과 바람/비 대응이 같고 보온이 slack 이내인 조합들 중에서 고른다.
    // 선선한 날(필요 보온이 충분히 큰 날)에는 겉옷을 걸친 조합도 후보다: 겉옷 없이 채우는 상의가 하나뿐이어도 다른 옷이 나올 수 있게.
    const first = valid[0]!
    const [wp, rp] = rank(first)
    const outerOk = !!first.outer || required >= ruleConfig.varietyOuterMinRequired
    let group = valid.filter((c) => rank(c)[0] === wp && rank(c)[1] === rp && (outerOk || !c.outer) && c.total <= first.total + ruleConfig.varietyWarmthSlack)
    // 최근에 담은 옷이 든 조합이 있으면 그 안에서 고른다
    const fresh = group.filter((c) => isNew(c.top) || isNew(c.bottom) || isNew(c.outer))
    if (fresh.length > 0) group = fresh
    if (group.length > 0) best = group[hashOf(input.varietySeed) % group.length]!
  }
  const toCombo = (c: Candidate): OutfitItem[] => [itemOf(c.top), itemOf(c.bottom), ...(c.outer ? [itemOf(c.outer)] : [])]

  // 대안: 최선과 다른 조합 (insufficient가 아니면 요구 보온을 만족하는 조합 중에서)
  const altSource = (insufficient ? valid : cands.filter((c) => c.total >= required)).slice().sort(cmp)
  const alternatives: OutfitItem[][] = []
  const seen = new Set<string>([keyOf(best)])
  if (!input.varietySeed) {
    for (const c of altSource) {
      const k = keyOf(c)
      if (seen.has(k)) continue
      seen.add(k)
      alternatives.push(toCombo(c))
      if (alternatives.length >= ruleConfig.alternativesCount) break
    }
  } else {
    // 서로 다른 옷이 들어가도록 고른다: 이미 보여준 옷(상의>하의>겉옷 순으로 비중)과 겹치지 않을수록, 최근에 담은 옷일수록 먼저.
    // 같은 이름("니트 + 파랑 바지")으로 보이는 조합은 한 번만 보여준다. 점수가 같으면 가벼운 조합이 먼저(위에서 정렬한 순서).
    const labelKey = (c: Candidate) => toCombo(c).map((i) => i.label).join('|')
    const shown = new Set<string>([labelKey(best)])
    const used = new Set<string>([best.top.id, best.bottom.id, ...(best.outer ? [best.outer.id] : [])])
    while (alternatives.length < ruleConfig.alternativesCount) {
      let pick: Candidate | null = null
      let pickScore = -1
      for (const c of altSource) {
        if (seen.has(keyOf(c)) || shown.has(labelKey(c))) continue
        const score =
          (used.has(c.top.id) ? 0 : 4) + (used.has(c.bottom.id) ? 0 : 2) + (c.outer && !used.has(c.outer.id) ? 2 : 0) + (isNew(c.top) || isNew(c.bottom) || isNew(c.outer) ? 1 : 0)
        if (score > pickScore) {
          pickScore = score
          pick = c
        }
      }
      if (!pick) break
      seen.add(keyOf(pick))
      shown.add(labelKey(pick))
      used.add(pick.top.id)
      used.add(pick.bottom.id)
      if (pick.outer) used.add(pick.outer.id)
      alternatives.push(toCombo(pick))
    }
  }

  const items = toCombo(best)
  const needOuter = !!best.outer
  const reasonCodes: string[] = []
  const reasons: string[] = []
  const push = (code: string, text: string) => {
    reasonCodes.push(code)
    reasons.push(text)
  }
  const feelsAvg = Math.round(input.points.reduce((a, p) => a + p.feels, 0) / input.points.length)
  push('FEELS_TEMP', `${windowLabel(input.points)} 평균 체감온도가 ${feelsAvg}°C 정도라 ${required >= 6 ? '든든하게' : '가볍게'} 입는 게 좋아요`)
  if (input.feelsMethod === 'FALLBACK_TEMP') reasonCodes.push('FEELS_FALLBACK_TEMP')
  if (input.sensitivity === 'COLD') push('SENSITIVITY_COLD', '추위를 많이 타는 설정을 반영했어요')
  if (input.sensitivity === 'HOT') push('SENSITIVITY_HOT', '더위를 많이 타는 설정을 반영했어요')
  if (input.feedbackOffset <= -0.5) push('FEEDBACK_COLD', '지난 피드백(추웠어요)을 반영해 조금 따뜻하게 맞췄어요')
  if (input.feedbackOffset >= 0.5) push('FEEDBACK_HOT', '지난 피드백(더웠어요)을 반영해 조금 가볍게 맞췄어요')
  if (input.eventKind === 'CAMPING') push('EVENT_CAMPING', '캠핑이라 밤 기온을 더 신경 썼어요')
  if (input.eventKind === 'EXERCISE') push('EVENT_EXERCISE', '움직이면 더워져서 조금 가볍게 맞췄어요')
  if (input.eventKind === 'HIKING') push('EVENT_HIKING', '등산은 움직이면 더워지고 산 위는 더 추워서, 벗고 입기 쉽게 맞췄어요')
  if (input.eventKind === 'OUTDOOR') push('EVENT_OUTDOOR', '야외에 오래 있어서 낮은 기온을 더 신경 썼어요')
  if (diurnal >= ruleConfig.largeDiurnalRange) push('LARGE_DIURNAL_RANGE', `외출 시간 중 기온 차가 ${Math.round(diurnal)}°C라 겉옷으로 조절하세요`)
  if (windy) push('WIND_STRONG', '바람이 강해서 방풍되는 겉옷을 우선했어요')
  if (needUmbrella) push('RAIN', '비/눈 소식이 있어 우산을 챙기세요')
  else push('NO_RAIN', '외출 시간에는 비 소식이 없어요')
  if (needMask) push('DUST_BAD', '미세먼지가 나빠서 마스크를 챙기세요')
  if (!maskDataAvailable) reasonCodes.push('DUST_UNAVAILABLE')
  if (insufficient) push('INSUFFICIENT_WARDROBE', '옷장에 딱 맞는 옷이 부족해서 가장 가까운 조합으로 골랐어요')
  if (!hasOwn) reasonCodes.push('EMPTY_WARDROBE_GENERIC')

  const [headline, sub] = headlineFor(judged, needOuter)
  const decisionKey = [best.top.type, best.bottom.type, best.outer?.type ?? 'NONE', `UMB${needUmbrella ? 1 : 0}`, `MASK${needMask ? 1 : 0}`].join('_')

  return {
    items,
    needOuter,
    needUmbrella,
    needMask,
    maskDataAvailable,
    headline,
    sub,
    reasonCodes,
    reasons,
    alternatives,
    insufficientWardrobe: insufficient,
    judgedTemp: judged,
    requiredWarmth: required,
    decisionKey,
  }
}

/** '지금'의 체감온도와 헷갈리지 않도록, 추천 판단이 어느 시간대 평균인지 문구로 알려준다. */
function windowLabel(points: OutingPoint[]): string {
  const first = points[0]!.at
  const last = points[points.length - 1]!.at
  if (points.length >= 3 && kstDate(first) === kstDate(last)) return `${toKstParts(first).hour}~${toKstParts(last).hour}시`
  return '외출 시간대'
}

function headlineFor(judged: number, needOuter: boolean): [string, string] {
  if (judged >= 28) return ['많이 더워요', '시원하게 입으세요']
  if (judged >= 23) return ['따뜻해요', '가볍게 입어도 돼요']
  if (judged >= 17) return ['선선해요', needOuter ? '얇은 겉옷이 있으면 좋아요' : '긴팔 정도면 충분해요']
  if (judged >= 9) return ['좀 쌀쌀해요', needOuter ? '겉옷 챙기는 게 좋아요' : '든든하게 입었으니 괜찮아요']
  if (judged >= 5) return ['꽤 추워요', '따뜻하게 입으세요']
  return ['많이 추워요', '두껍게 껴입으세요']
}
