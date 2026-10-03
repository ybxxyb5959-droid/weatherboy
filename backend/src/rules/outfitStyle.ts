// 옷차림 "분위기"(포멀/단정/캐주얼/편한 옷) 취향. 날씨가 정한 보온 조건은 그대로 두고, 조건을 만족하는 조합 중에서 분위기에 가까운 쪽을 고른다.
// 결정론적이다: AI 는 분위기를 고를 뿐이고 어떤 옷을 입을지는 이 점수로 정한다.
import type { ClothingPattern, ClothingType } from '@prisma/client'

export const OUTFIT_STYLES = ['FORMAL', 'SMART', 'CASUAL', 'COMFORT'] as const
export type OutfitStyle = (typeof OUTFIT_STYLES)[number]

export const styleLabel: Record<OutfitStyle, string> = {
  FORMAL: '포멀한 정장 느낌',
  SMART: '단정한 비즈니스 캐주얼',
  CASUAL: '편안한 캐주얼',
  COMFORT: '활동하기 편한 옷',
}

type Scores = Partial<Record<ClothingType, number>>

const BY_STYLE: Record<OutfitStyle, Scores> = {
  FORMAL: { SHIRT: 3, KNIT: 2, SHORT_SLEEVE_SHIRT: 1, LONG_SLEEVE: 1, SHORT_SLEEVE: -1, SWEATSHIRT: -2, HOODIE: -3, PANTS: 2, SKIRT: 2, SHORTS: -3, JACKET: 3, COAT: 3, CARDIGAN: 1, WINDBREAKER: -2, PADDING: -1 },
  SMART: { SHIRT: 3, KNIT: 3, SHORT_SLEEVE_SHIRT: 2, LONG_SLEEVE: 1, SHORT_SLEEVE: 0, SWEATSHIRT: -1, HOODIE: -2, PANTS: 2, SKIRT: 2, SHORTS: -2, JACKET: 3, COAT: 2, CARDIGAN: 3, WINDBREAKER: -1, PADDING: 0 },
  CASUAL: { SWEATSHIRT: 2, HOODIE: 2, LONG_SLEEVE: 2, SHORT_SLEEVE: 2, KNIT: 1, SHIRT: 1, PANTS: 1, SHORTS: 1, WINDBREAKER: 1, CARDIGAN: 1 },
  COMFORT: { SWEATSHIRT: 2, HOODIE: 2, LONG_SLEEVE: 2, SHORT_SLEEVE: 2, PANTS: 1, SHORTS: 2, WINDBREAKER: 3, PADDING: 1, SKIRT: -1, SHIRT: -1, JACKET: -1 },
}

const NEUTRAL = new Set(['BLACK', 'NAVY', 'GRAY', 'WHITE', 'BEIGE'])
const LOUD_PATTERN = new Set<ClothingPattern>(['PRINT', 'STRIPE', 'DOT'])

interface Piece {
  type: ClothingType
  color: string
  pattern?: ClothingPattern
}

/** 한 벌이 분위기에 얼마나 맞는지. 포멀/단정은 차분한 색과 무늬 없는 옷을 더 쳐준다. */
export function pieceStyleScore(style: OutfitStyle, c: Piece): number {
  let s = BY_STYLE[style][c.type] ?? 0
  if (style === 'FORMAL' || style === 'SMART') {
    if (NEUTRAL.has(c.color)) s += 1
    if (c.pattern && LOUD_PATTERN.has(c.pattern)) s -= 1
  }
  return s
}

export function comboStyleScore(style: OutfitStyle, top: Piece, bottom: Piece, outer: Piece | null): number {
  return pieceStyleScore(style, top) + pieceStyleScore(style, bottom) + (outer ? pieceStyleScore(style, outer) : 0)
}

// ───── 상황별 금지 규칙 ─────
// 일정 제목에서 자리의 종류를 알아내고, 그 자리에 어색한 옷에 강한 감점을 준다.
// 완전히 빼지는 않는다: 옷장에 그런 옷뿐이면 그래도 추천은 하되 어색할 수 있다고 알려준다. (AI 는 제목 분류에 쓸 수 있지만 규칙은 여기서 정한다.)
export const SITUATIONS = ['INTERVIEW', 'WEDDING', 'FUNERAL', 'DATE'] as const
export type Situation = (typeof SITUATIONS)[number]

export const situationLabel: Record<Situation, string> = {
  INTERVIEW: '면접·발표',
  WEDDING: '결혼식',
  FUNERAL: '장례식',
  DATE: '데이트',
}

// 제목 키워드. '결혼' 만으로는 기념일 식사일 수 있어 하객 자리를 가리키는 말만 쓴다. 시험·출근은 편한 옷이 맞아서 뺀다.
const SITUATION_WORDS: Record<Situation, RegExp> = {
  INTERVIEW: /면접|인터뷰|오디션|입사|발표|프레젠테이션|회의|미팅/,
  WEDDING: /결혼식|예식|웨딩|하객/,
  FUNERAL: /장례|조문|상가|추도|빈소|발인/,
  DATE: /데이트|소개팅|맞선|첫\s*만남/,
}

export function situationOf(title: string): Situation | null {
  // 장례/결혼식처럼 틀리면 곤란한 자리를 먼저 본다
  for (const s of ['FUNERAL', 'WEDDING', 'INTERVIEW', 'DATE'] as const) if (SITUATION_WORDS[s].test(title)) return s
  return null
}

/** 사용자가 분위기를 고르지 않았을 때, 그 자리에 기본으로 어울리는 분위기(저장하지 않는다). 데이트는 정해진 격식이 없다. */
export const impliedStyle: Record<Situation, OutfitStyle | null> = {
  INTERVIEW: 'SMART',
  WEDDING: 'SMART',
  FUNERAL: 'FORMAL',
  DATE: null,
}

export type Role = 'top' | 'bottom' | 'outer'
interface TabooPiece extends Piece {
  role: Role
}

const BRIGHT = new Set(['RED', 'ORANGE', 'YELLOW', 'PINK', 'GREEN', 'SKYBLUE', 'BLUE', 'PURPLE'])
const TYPE_NAME: Partial<Record<ClothingType, string>> = { HOODIE: '후드티', SWEATSHIRT: '맨투맨', SHORTS: '반바지', WINDBREAKER: '바람막이', SHORT_SLEEVE: '반팔티' }

/** 한 벌의 감점(0 이하)과 이유 */
export function pieceTaboo(sit: Situation, p: TabooPiece): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []
  const hit = (n: number, why: string) => {
    score += n
    reasons.push(why)
  }
  const name = TYPE_NAME[p.type] ?? ''
  const printed = p.pattern === 'PRINT'
  const patterned = !!p.pattern && p.pattern !== 'SOLID'
  if (sit === 'INTERVIEW') {
    if (p.type === 'HOODIE') hit(-6, `${name}는 면접 자리에는 너무 편해 보일 수 있어요`)
    else if (p.type === 'SHORTS') hit(-6, `${name}는 면접 자리에는 어울리지 않을 수 있어요`)
    else if (p.type === 'SWEATSHIRT') hit(-4, `${name}은 면접 자리에는 캐주얼해 보일 수 있어요`)
    else if (p.type === 'WINDBREAKER' && p.role === 'outer') hit(-3, `${name}는 면접 자리에는 운동복처럼 보일 수 있어요`)
    if (printed) hit(-4, '큰 프린트는 면접 자리에는 튀어 보일 수 있어요')
  } else if (sit === 'WEDDING') {
    if ((p.role === 'top' || p.role === 'outer') && p.color === 'WHITE') hit(-6, '흰색 옷은 신부의 색이라 하객은 피하는 게 예의예요')
    if (p.type === 'SHORTS') hit(-6, `${name}는 결혼식 하객 옷으로는 어울리지 않을 수 있어요`)
    else if (p.type === 'HOODIE') hit(-6, `${name}는 결혼식 하객 옷으로는 너무 편해 보일 수 있어요`)
    else if (p.type === 'SWEATSHIRT') hit(-4, `${name}은 결혼식 하객 옷으로는 캐주얼해 보일 수 있어요`)
    if (printed) hit(-3, '큰 프린트는 결혼식에서는 튀어 보일 수 있어요')
  } else if (sit === 'FUNERAL') {
    if (BRIGHT.has(p.color)) hit(-5, '밝고 쨍한 색은 장례식에는 피하는 게 좋아요')
    if (patterned) hit(-5, '무늬 있는 옷은 장례식에는 피하는 게 좋아요')
    if (p.type === 'SHORTS') hit(-6, `${name}는 장례식에는 어울리지 않아요`)
    else if (p.type === 'HOODIE') hit(-4, `${name}는 장례식에는 너무 편해 보일 수 있어요`)
    if (p.color === 'BLACK' || p.color === 'NAVY' || p.color === 'GRAY') score += 2 // 차분한 어두운 색을 먼저
  } else if (sit === 'DATE') {
    if (printed) hit(-3, '큰 프린트는 데이트에서는 너무 튈 수 있어요')
  }
  return { score, reasons }
}

export function comboTaboo(sit: Situation, top: Piece, bottom: Piece, outer: Piece | null): { score: number; reasons: string[] } {
  const parts = [pieceTaboo(sit, { ...top, role: 'top' }), pieceTaboo(sit, { ...bottom, role: 'bottom' }), ...(outer ? [pieceTaboo(sit, { ...outer, role: 'outer' })] : [])]
  return { score: parts.reduce((n, p) => n + p.score, 0), reasons: parts.flatMap((p) => p.reasons) }
}

/** 받침이 있으면 '이', 없으면 '가' */
function subjectJosa(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return '가'
  return code % 28 === 0 ? '가' : '이'
}

// ───── 옷장에 그 분위기에 맞는 옷이 부족할 때: 무엇이 있으면 좋을지 ─────
const DRESSY_TOP = new Set<ClothingType>(['SHIRT', 'SHORT_SLEEVE_SHIRT', 'KNIT'])
const DRESSY_OUTER = new Set<ClothingType>(['JACKET', 'COAT', 'CARDIGAN'])
const DRESSY_BOTTOM = new Set<ClothingType>(['PANTS', 'SKIRT'])

/** 포멀/단정을 골랐는데 옷장에 없는 종류를 알려주는 한 줄(없으면 null). 내가 담은 옷의 종류만 넘긴다. */
export function styleGapHint(style: OutfitStyle, owned: ClothingType[]): string | null {
  if (style !== 'FORMAL' && style !== 'SMART') return null
  const has = (set: Set<ClothingType>) => owned.some((t) => set.has(t))
  const missing: string[] = []
  if (!has(DRESSY_TOP)) missing.push('셔츠나 니트')
  if (!has(DRESSY_BOTTOM)) missing.push('긴 바지')
  if (!has(DRESSY_OUTER)) missing.push('자켓이나 가디건')
  if (missing.length === 0) return null
  const list = missing.join(', ')
  return `${list}${subjectJosa(list)} 있으면 훨씬 단정해 보여요`
}

// ───── 코디 도우미를 보여줄 일정인가 ─────
// 여행·캠핑·등산·야외활동은 날씨 엔진이 이미 일정 종류를 반영해 고른다. 격식 있는 자리(제목에 면접·결혼식 등)가 아니면 분위기를 따로 묻지 않는다.
const OUTDOOR_KINDS = new Set(['여행', '캠핑', '등산', '야외활동'])
const FORMAL_TITLE = /면접|발표|프레젠테이션|회의|미팅|결혼|상견례|예식|웨딩|하객|장례|조문|시험|입사|인터뷰|오디션|졸업|소개팅|데이트/
export function stylistApplicable(kind: string, title: string): boolean {
  return !OUTDOOR_KINDS.has(kind) || FORMAL_TITLE.test(title) || situationOf(title) !== null
}
