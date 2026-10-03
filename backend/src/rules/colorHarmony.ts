// 상의/하의/겉옷 색 궁합. 날씨가 정한 보온 조건은 그대로 두고, 조건을 만족하는 조합끼리 비교할 때만 쓴다.
// 결정론적이다: AI 는 이 결과를 말로 풀어줄 뿐 어떤 옷을 입을지는 이 점수와 Rule Engine 이 정한다.
import type { ClothingPattern } from '@prisma/client'

export interface ColorPiece {
  color: string // DB enum 값 (예: BLUE)
  pattern?: ClothingPattern
}

export type ColorIssue = 'MONO' | 'CLASH' | 'PATTERN'

// 차분하게 어디에나 맞는 색(무채색 + 땅색 계열)
const NEUTRAL = new Set(['BLACK', 'GRAY', 'WHITE', 'BEIGE', 'NAVY', 'BROWN', 'KHAKI'])
const BLUE_FAMILY = new Set(['BLUE', 'SKYBLUE', 'NAVY'])
const pairKey = (a: string, b: string) => [a, b].sort().join('+')
// 쨍한 색끼리 크게 부딪히는 짝
const CLASH = new Set(['GREEN+RED', 'ORANGE+RED', 'ORANGE+PINK', 'GREEN+PURPLE', 'PURPLE+RED', 'ORANGE+PURPLE'].map((p) => p.split('+').sort().join('+')))
// 쨍한 색끼리여도 무난하게 어울리는 짝
const OK_PAIR = new Set(['PINK+SKYBLUE', 'SKYBLUE+YELLOW', 'PINK+PURPLE', 'BLUE+YELLOW', 'BLUE+ORANGE'].map((p) => p.split('+').sort().join('+')))

const patterned = (p: ColorPiece) => !!p.pattern && p.pattern !== 'SOLID'
const unknown = (p: ColorPiece) => p.color === 'OTHER'

/** 두 벌의 색 궁합: 높을수록 잘 어울린다. 0 은 무난. */
export function pairScore(a: ColorPiece, b: ColorPiece): number {
  if (unknown(a) || unknown(b)) return 0
  const na = NEUTRAL.has(a.color)
  const nb = NEUTRAL.has(b.color)
  let s: number
  if (a.color === b.color) s = na ? 0 : -2 // 같은 쨍한 색(파랑+파랑)은 단조롭다. 검정+검정 같은 무채색 한 벌 룩은 괜찮다.
  else if (BLUE_FAMILY.has(a.color) && BLUE_FAMILY.has(b.color)) s = pairKey(a.color, b.color) === 'NAVY+SKYBLUE' ? 1 : 0 // 톤온톤
  else if (na && nb) s = pairKey(a.color, b.color) === 'BLACK+NAVY' ? 0 : 1
  else if (na !== nb) s = (na ? a.color : b.color) === 'KHAKI' && (na ? b.color : a.color) === 'GREEN' ? -1 : 2 // 무채색 + 포인트색이 가장 안전하다
  else if (CLASH.has(pairKey(a.color, b.color))) s = -3
  else s = OK_PAIR.has(pairKey(a.color, b.color)) ? 0 : -1
  if (patterned(a) && patterned(b)) s -= 2
  else if ((patterned(a) && !NEUTRAL.has(b.color)) || (patterned(b) && !NEUTRAL.has(a.color))) s -= 1
  return s
}

/** 상의-하의가 가장 눈에 띄므로 그대로, 겉옷은 상의/하의 각각과의 궁합을 절반씩 센다. */
export function comboColorScore(top: ColorPiece, bottom: ColorPiece, outer: ColorPiece | null): number {
  return pairScore(top, bottom) + (outer ? 0.5 * pairScore(outer, top) + 0.5 * pairScore(outer, bottom) : 0)
}

/** 눈에 띄게 어색한 상하의 조합이면 그 유형, 아니면 null */
export function colorIssueOf(top: ColorPiece, bottom: ColorPiece): ColorIssue | null {
  if (unknown(top) || unknown(bottom)) return null
  if (patterned(top) && patterned(bottom)) return 'PATTERN'
  if (top.color === bottom.color && !NEUTRAL.has(top.color)) return 'MONO'
  if (CLASH.has(pairKey(top.color, bottom.color))) return 'CLASH'
  return null
}

export const colorIssueTip: Record<ColorIssue, string> = {
  MONO: '상하의가 같은 색이라 단조로워 보일 수 있어요. 겉옷이나 신발, 가방을 흰색·회색 계열로 섞으면 훨씬 정돈돼 보여요',
  CLASH: '두 색이 강하게 부딪히는 조합이에요. 겉옷이나 소품을 흰색·회색·베이지처럼 차분한 색으로 맞추면 정리돼요',
  PATTERN: '무늬가 겹쳐서 복잡해 보일 수 있어요. 겉옷이나 소품은 무늬 없는 걸로 맞추세요',
}
