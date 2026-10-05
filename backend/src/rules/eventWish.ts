// 말로 정한 조건은 일정 전체와 실제 KST 날짜별로 나누어 보관한다.
// 날짜별 조건을 우선하며, 후속 요청은 언급한 자리/속성만 바꾼다.
import { z } from 'zod'
import { colorMap } from '../config/mappings.js'
import { OUTFIT_STYLES, styleLabel } from './outfitStyle.js'
import { parseWish, savedWish, TOP_TYPES, BOTTOM_TYPES, OUTER_TYPES, type Wish, type WishPiece, type Role } from './outfitWish.js'
import { kstDate } from '../utils/time.js'
import { detectStyle } from '../services/ai/stylist.js'

const roles = ['top', 'bottom', 'outer'] as const
const types = [...TOP_TYPES, ...BOTTOM_TYPES, ...OUTER_TYPES] as [string, ...string[]]
const colors = colorMap.uiValues.filter((c) => c !== '기타') as [string, ...string[]]
const pieceSchema = z.object({
  role: z.enum(roles),
  type: z.enum(types).optional(),
  color: z.enum(colors).optional(),
  tone: z.enum(['dark', 'light']).optional(),
}).strict().refine((p) => !!(p.type || p.color || p.tone))
export const conditionSchema = z.object({
  suit: z.boolean().optional(),
  noOuter: z.boolean().optional(),
  variety: z.boolean().optional(),
  style: z.enum(OUTFIT_STYLES).nullable().optional(),
  pieces: z.array(pieceSchema).max(3).default([]),
}).strict().superRefine((c, ctx) => {
  if (new Set(c.pieces.map((p) => p.role)).size !== c.pieces.length) ctx.addIssue({ code: 'custom', message: '한 자리의 조건은 하나만 지정해주세요.' })
  for (const p of c.pieces) {
    const allowed = p.role === 'top' ? TOP_TYPES : p.role === 'bottom' ? BOTTOM_TYPES : OUTER_TYPES
    if (p.type && !allowed.includes(p.type)) ctx.addIssue({ code: 'custom', message: '옷 종류와 자리가 맞지 않아요.' })
  }
})
export type Condition = z.infer<typeof conditionSchema>
export interface EventWishPlan {
  version: 1
  all: Condition
  days: Record<string, Condition>
}
export interface WishPatch {
  date: string
  clear?: boolean
  clearRoles?: Role[]
  condition: Condition
}
export interface WishInterpretation {
  patches: WishPatch[]
  question?: string
}
const empty = (): Condition => ({ pieces: [] })

export function eventDates(event: { startAt: Date; endAt: Date }): string[] {
  const start = kstDate(event.startAt)
  const end = kstDate(event.endAt)
  const dates: string[] = []
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86400_000) dates.push(new Date(t).toISOString().slice(0, 10))
  return dates
}

export function savedEventWish(json: unknown): EventWishPlan {
  const plan = z.object({ version: z.literal(1), all: conditionSchema, days: z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), conditionSchema) }).safeParse(json)
  if (plan.success) return plan.data
  const legacy = savedWish(json)
  return { version: 1, all: legacy ? { ...legacy, pieces: legacy.pieces.filter((p) => p.type || p.color || p.tone) } : empty(), days: {} }
}

function mergeCondition(base: Condition, patch: Condition): Condition {
  const pieces = base.pieces.map((p) => ({ ...p }))
  for (const p of patch.pieces) {
    const at = pieces.findIndex((q) => q.role === p.role)
    const next = { ...(at < 0 ? {} : pieces[at]), ...p } as WishPiece
    if (p.color) delete next.tone
    else if (p.tone) delete next.color
    if (at < 0) pieces.push(next)
    else pieces[at] = next
  }
  return { ...base, ...patch, pieces }
}

export function applyEventWish(plan: EventWishPlan, patches: WishPatch[], dates: string[]): EventWishPlan {
  let next: EventWishPlan = structuredClone(plan)
  // 범위를 먼저 모두 검증한다. 일부 날짜만 적용되는 일이 없어야 한다.
  if (patches.some((p) => p.date !== 'ALL' && !dates.includes(p.date))) throw new Error('일정 밖 날짜는 적용할 수 없어요.')
  for (const p of patches) {
    if (p.date === 'ALL' && p.clear) next = { version: 1, all: empty(), days: {} }
    else if (p.clear) delete next.days[p.date]
    const base = p.date === 'ALL' ? next.all : next.days[p.date] ?? empty()
    const cleared = { ...base, pieces: base.pieces.filter((q) => !p.clearRoles?.includes(q.role)) }
    const merged = mergeCondition(cleared, p.condition)
    if (p.date === 'ALL') {
      next.all = merged
      // "모든 날 밝게"는 이전 날짜별 밝기 지정도 바꾼다. 언급하지 않은 종류 등은 보존한다.
      for (const day of Object.values(next.days)) {
        for (const q of day.pieces) {
          const global = p.condition.pieces.find((r) => r.role === q.role)
          if (global?.color || global?.tone) { delete q.color; delete q.tone }
          if (global?.type) delete q.type
        }
        day.pieces = day.pieces.filter((q) => q.type || q.color || q.tone)
        for (const key of ['suit', 'noOuter', 'variety', 'style'] as const) if (p.condition[key] !== undefined) delete day[key]
        if (p.clearRoles) day.pieces = day.pieces.filter((q) => !p.clearRoles!.includes(q.role))
      }
    } else if (p.clear && !p.condition.pieces.length && Object.keys(p.condition).length === 1) {
      delete next.days[p.date]
    } else next.days[p.date] = merged
  }
  return next
}

export function conditionForDate(plan: EventWishPlan, date: string): Condition {
  return mergeCondition(plan.all, plan.days[date] ?? empty())
}
export const wishOfCondition = (c: Condition): Wish => ({ suit: !!c.suit, noOuter: c.noOuter, variety: c.variety, pieces: c.pieces })

export function conditionLabel(c: Condition): string | null {
  const labels: string[] = []
  if (c.style) labels.push(styleLabel[c.style])
  if (c.suit) labels.push('정장')
  if (c.noOuter) labels.push('겉옷 없이')
  if (c.variety) labels.push('겹침 최소화')
  const slot = { top: '상의', bottom: '하의', outer: '겉옷' }
  for (const p of c.pieces) labels.push(`${slot[p.role]} ${[p.color ?? (p.tone === 'light' ? '밝은 톤' : p.tone === 'dark' ? '어두운 톤' : null), p.type].filter(Boolean).join(' ')}`)
  return labels.length ? labels.join(' · ') : null
}

const ordinals = ['첫', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째', '열째']
const datePattern = /첫\s*(?:날|째\s*날)|(?:둘째|셋째|넷째|다섯째|여섯째|일곱째|여덟째|아홉째|열째)\s*날|마지막\s*날|\d+\s*(?:일차|번째\s*날)|\d{4}-\d{2}-\d{2}/g
const ending = /(?:로|으로)?\s*(?:입고\s*싶어(?:요)?|입을래(?:요)?|입혀줘(?:요)?|해줘(?:요)?|해주세요|골라줘(?:요)?|바꿔줘(?:요)?)?[.!。]*$/

function simpleCondition(text: string): { condition: Condition; clear?: boolean } | null {
  const t = text.trim().replace(ending, '').trim()
  if (/^(?:조건\s*)?(?:원래대로|처음으로|초기화|취소)$/.test(t)) return { condition: empty(), clear: true }
  if (/^(?:밝게|밝은\s*(?:옷|톤)|화사하게|어둡게|어두운\s*(?:옷|톤))$/.test(t)) {
    const tone = /밝|화사/.test(t) ? 'light' : 'dark'
    return { condition: { pieces: [{ role: 'top', tone }, { role: 'bottom', tone }] } }
  }
  if (/^(?:정장|포멀|단정하게|깔끔하게|캐주얼|편하게|편안하게|활동적으로)$/.test(t)) {
    const style = detectStyle(t)
    return style ? { condition: { pieces: [], style, ...(/정장|포멀/.test(t) ? { suit: true } : {}) } } : null
  }
  // 전체 문장이 이 문법에 맞을 때만 규칙으로 끝낸다. 부정/복수 조건/날짜 잔여 표현은 AI 에 넘긴다.
  const color = '(?:검정(?:색)?|검은|블랙|흰색?|하얀|화이트|회색|그레이|네이비|남색|베이지|아이보리|갈색|카키|초록|하늘색|파랑|파란|빨강|분홍|주황|노랑|보라)'
  const cloth = '(?:상의|윗옷|하의|겉옷|외투|반팔셔츠|반팔|긴팔|셔츠|블라우스|티셔츠|맨투맨|니트|후드티|바지|청바지|슬랙스|반바지|치마|자켓|재킷|가디건|코트|패딩|바람막이)'
  const tone = '(?:밝게|어둡게|밝은|어두운|화사하게)'
  const patterns = [
    `^(?:${color}|${tone})\\s*(?:${cloth}|옷)?$`,
    `^${cloth}(?:은|는|을|를)?\\s*(?:${color}|${tone})?$`,
    `^(?:겉옷|외투|자켓|코트)(?:은|는)?\\s*(?:없이|빼고|안\\s*입고)$`,
    '^(?:전부|모두|매일|날마다|서로)\\s*다르게$',
    '^(?:겹치지\\s*않게|안\\s*겹치게)$',
  ]
  if (!patterns.some((p) => new RegExp(p).test(t))) return null
  const w = parseWish(t)
  if (!w) return null
  const condition: Condition = { pieces: w.pieces.filter((p) => p.type || p.color || p.tone) }
  if (w.suit) condition.suit = true
  if (w.noOuter) condition.noOuter = true
  if (w.variety) condition.variety = true
  return { condition }
}

/** 명확한 날짜와 단순 조건만 무료 처리. 문장의 일부만 인식한 결과는 반환하지 않는다. */
export function parseEventWishRules(text: string, dates: string[]): WishInterpretation | null {
  const t = text.trim()
  const found = [...t.matchAll(datePattern)]
  if (!found.length) {
    const simple = simpleCondition(t.replace(/^(?:전체|모든\s*날|이틀\s*다|전부|모두)(?:는|을|다)?\s*/, ''))
    return simple ? { patches: [{ date: 'ALL', ...simple }] } : null
  }
  if (t.slice(0, found[0]!.index).trim()) return null
  const patches: WishPatch[] = []
  let invalid = false
  for (let i = 0; i < found.length; i++) {
    const m = found[i]!
    const body = t.slice(m.index! + m[0].length, found[i + 1]?.index ?? t.length).replace(/^[은는에는\s]+/, '').replace(/(?:[,;.]|\s그리고|\s하고)\s*$/, '').trim()
    const simple = simpleCondition(body)
    if (!simple) return null
    const token = m[0].replace(/\s/g, '')
    const ordinal = token.startsWith('마지막') ? dates.length - 1 : /^\d{4}-/.test(token) ? dates.indexOf(token) : /^\d/.test(token) ? Number.parseInt(token, 10) - 1 : ordinals.findIndex((o) => token.startsWith(o))
    const date = dates[ordinal]
    if (!date) invalid = true
    else patches.push({ date, ...simple })
  }
  return invalid ? { patches: [], question: '이 일정에 있는 날짜나 일차로 말씀해주세요.' } : { patches }
}
