// 사용자가 말로 "검정색 상의를 입고 싶어"처럼 원하는 옷을 말하면, 옷장에 없어도 그 옷을 "예시"로 입혀서 보여준다.
// 포멀한 정장은 정장 세트(셔츠 + 자켓 + 바지)가 보이도록 옷장에 없는 부분을 예시로 채운다.
// 예시 옷은 옷장에 담긴 옷이 아니라서 owned=false, example=true 로 표시한다. (결정론적 규칙이다: AI 를 쓰지 않는다)
import { clothingTypeMap, colorMap } from '../config/mappings.js'
import type { OutfitItem } from './outfitEngine.js'

export type Role = 'top' | 'bottom' | 'outer'
export type Tone = 'dark' | 'light'

export interface WishPiece {
  role: Role
  /** 말한 옷 종류(예: 셔츠). 없으면 코디가 이미 고른 옷의 종류를 그대로 쓰고 색만 바꾼다 */
  type?: string
  color?: string
  /** 어두운/밝은 톤("상의는 어둡고"). 색을 콕 집어 말하지 않았을 때 */
  tone?: Tone
}
export interface Wish {
  /** "정장"이라고 말했는가: 정장 세트를 입힌다 */
  suit: boolean
  pieces: WishPiece[]
}

export const TOP_TYPES = ['반팔', '반팔셔츠', '긴팔', '셔츠', '맨투맨', '니트', '후드티']
export const BOTTOM_TYPES = ['바지', '반바지', '치마']
export const OUTER_TYPES = ['바람막이', '자켓', '가디건', '코트', '패딩']
export const roleOf = (type: string): Role | null => (TOP_TYPES.includes(type) ? 'top' : BOTTOM_TYPES.includes(type) ? 'bottom' : OUTER_TYPES.includes(type) ? 'outer' : null)

// 색 낱말 -> 옷장 색 이름. 앞에 있는 것이 먼저 맞는다(남색은 파랑보다, 하늘은 파랑보다 먼저)
const COLOR_WORDS: [RegExp, string][] = [
  [/검정|검은|까만|블랙/, '검정'],
  [/네이비|남색|곤색/, '네이비'],
  [/하늘|스카이/, '하늘색'],
  [/흰|하얀|화이트/, '흰색'],
  [/회색|그레이|쥐색/, '회색'],
  [/베이지|아이보리|크림/, '베이지'],
  [/갈색|브라운|초콜릿/, '갈색'],
  [/카키|올리브/, '카키'],
  [/초록|녹색|그린/, '초록'],
  [/파란|파랑|블루/, '파랑'],
  [/빨간|빨강|레드/, '빨강'],
  [/분홍|핑크/, '분홍'],
  [/주황|오렌지/, '주황'],
  [/노란|노랑|옐로/, '노랑'],
  [/보라|퍼플/, '보라'],
]
// 톤 낱말(어둡다/밝다). 색 이름이 아니라 느낌만 말한 경우.
// 수식어("어두운 상의")는 뒤에 오는 옷에, 서술어("상의는 어둡고")는 앞에 나온 옷에 붙는다.
const TONE_WORDS: [RegExp, Tone, 'next' | 'prev'][] = [
  [/어두운|짙은|진한|딥|다크|칙칙한/g, 'dark', 'next'],
  [/어둡|어둠|짙|진하|칙칙/g, 'dark', 'prev'],
  [/밝은|연한|화사한|환한|산뜻한|라이트|파스텔/g, 'light', 'next'],
  [/밝|연하|화사|환하|산뜻/g, 'light', 'prev'],
]

// 옷 낱말 -> 종류(없으면 그 자리만 정한다). 긴 말이 먼저(반바지 > 바지, 티셔츠 > 셔츠)
const TYPE_WORDS: [RegExp, Role, string | undefined][] = [
  [/반바지/, 'bottom', '반바지'],
  [/치마|스커트/, 'bottom', '치마'],
  [/슬랙스|청바지|바지|팬츠/, 'bottom', '바지'],
  [/하의/, 'bottom', undefined],
  [/후드/, 'top', '후드티'],
  [/맨투맨/, 'top', '맨투맨'],
  [/니트|스웨터/, 'top', '니트'],
  [/반팔|티셔츠|티$|티\s/, 'top', '반팔'],
  [/긴팔/, 'top', '긴팔'],
  [/셔츠|블라우스/, 'top', '셔츠'],
  [/상의|윗옷/, 'top', undefined],
  [/자켓|재킷|블레이저/, 'outer', '자켓'],
  [/가디건/, 'outer', '가디건'],
  [/코트|트렌치/, 'outer', '코트'],
  [/패딩|점퍼/, 'outer', '패딩'],
  [/바람막이/, 'outer', '바람막이'],
  [/겉옷|외투/, 'outer', undefined],
]

interface Mod {
  at: number
  end: number
  attach: 'next' | 'prev'
  color?: string
  tone?: Tone
}

/** 말에서 원하는 옷(색, 톤, 종류)을 찾는다. 아무것도 못 찾으면 null */
export function parseWish(text: string): Wish | null {
  const t = text.replace(/\s+/g, ' ')
  const mods: Mod[] = []
  for (const [re, name] of COLOR_WORDS) {
    for (const m of t.matchAll(new RegExp(re.source, 'g'))) {
      const end = m.index! + m[0].length
      // "검정색으로 ..."처럼 뒤에 서술 조사가 붙으면 앞에 나온 옷의 색, 아니면 뒤에 오는 옷의 색("검정색 상의")
      const predicate = /^(색)?(으로|이고|이며|이|로|은|는)/.test(t.slice(end))
      mods.push({ at: m.index!, end, attach: predicate ? 'prev' : 'next', color: name })
    }
  }
  for (const [re, tone, attach] of TONE_WORDS) {
    for (const m of t.matchAll(re)) mods.push({ at: m.index!, end: m.index! + m[0].length, attach, tone })
  }
  // 먼저 옷 낱말의 자리를 모두 찾는다(긴 말이 먼저)
  const found: { at: number; end: number; role: Role; type?: string }[] = []
  for (const [re, role, type] of TYPE_WORDS) {
    const m = re.exec(t)
    if (!m) continue
    const at = m.index
    const end = at + m[0].length
    if (found.some((p) => at < p.end && end > p.at)) continue // 이미 더 긴 말에 잡힌 자리
    if (found.some((p) => p.role === role)) continue
    found.push({ at, end, role, type })
  }
  found.sort((x, y) => x.at - y.at)
  const pieces: WishPiece[] = found.map((p) => ({ role: p.role, type: p.type }))
  // 색/톤을 옷에 붙인다: 붙는 방향의 가까운 옷이 먼저, 없으면 반대 방향
  const nextOf = (m: Mod) => found.findIndex((p) => p.at >= m.end && p.at - m.end <= 8)
  const prevOf = (m: Mod) => found.map((p, i) => ({ p, i })).filter(({ p }) => p.end <= m.at).pop()?.i ?? -1
  const orphanTones: Tone[] = []
  const orphanColors: string[] = []
  for (const m of mods.sort((x, y) => x.at - y.at)) {
    let i = m.attach === 'next' ? nextOf(m) : prevOf(m)
    if (i < 0) i = m.attach === 'next' ? prevOf(m) : nextOf(m)
    if (i < 0) {
      if (m.tone) orphanTones.push(m.tone)
      if (m.color) orphanColors.push(m.color)
      continue
    }
    const piece = pieces[i]!
    if (m.color && !piece.color) piece.color = m.color
    if (m.tone && !piece.tone && !piece.color) piece.tone = m.tone
  }
  for (const p of pieces) if (p.color) delete p.tone // 색을 콕 집어 말했으면 그 색이 우선
  const suit = /정장|수트|슈트/.test(t)
  // 옷 낱말 없이 색만 말했다면 상의의 색으로 본다("검정색으로 입고 싶어")
  if (pieces.length === 0 && !suit && orphanColors.length > 0) pieces.push({ role: 'top', color: orphanColors[0] })
  // 옷 낱말 없이 톤만 말했다면("전체적으로 어둡게") 상의와 하의에 같은 톤을 준다
  else if (pieces.length === 0 && !suit && orphanTones.length > 0) pieces.push({ role: 'top', tone: orphanTones[0] }, { role: 'bottom', tone: orphanTones[0] })
  if (pieces.length === 0 && !suit) return null
  return { suit, pieces }
}

const example = (type: string, color: string, label?: string): OutfitItem & { example: true } => ({
  clothingId: null,
  type,
  color,
  pattern: '무지',
  label: label ?? `${color} ${type}(예시)`,
  owned: false,
  example: true,
})

const DRESSY_TOP = ['셔츠', '반팔셔츠', '니트']
const DRESSY_OUTER = ['자켓', '코트']

/**
 * 정장 세트: 셔츠 + 자켓 + 바지. 옷장에 이미 단정한 옷이 있으면 그걸 쓰고, 없는 부분만 예시로 채운다.
 * 채운 것이 있으면 알려줄 문장도 돌려준다.
 */
export function applySuit(items: OutfitItem[]): { items: OutfitItem[]; filled: string[] } {
  const out = [...items]
  const filled: string[] = []
  const put = (role: Role, ok: (t: string) => boolean, make: () => OutfitItem) => {
    const i = out.findIndex((it) => roleOf(it.type) === role)
    if (i >= 0 && ok(out[i]!.type)) return
    const item = make()
    if (i >= 0) out[i] = item
    else out.push(item)
    filled.push(item.label)
  }
  put('top', (t) => DRESSY_TOP.includes(t), () => example('셔츠', '흰색'))
  put('bottom', (t) => t === '바지', () => example('바지', '검정', '검정 슬랙스(예시)'))
  put('outer', (t) => DRESSY_OUTER.includes(t), () => example('자켓', '검정', '검정 정장 자켓(예시)'))
  return { items: out, filled }
}

const DEFAULT_TYPE: Record<Role, string> = { top: '긴팔', bottom: '바지', outer: '자켓' }

// 톤 -> 옷장 색 이름(UI). 옷장 색이 이 톤인지 판단하고, 예시 옷을 만들 때 기본 색으로도 쓴다.
const DARK_UI = ['검정', '네이비', '갈색', '카키']
const LIGHT_UI = ['흰색', '베이지', '하늘색', '분홍', '노랑']
const TONE_DEFAULT: Record<Tone, Record<Role, string>> = {
  dark: { top: '검정', bottom: '네이비', outer: '검정' },
  light: { top: '흰색', bottom: '베이지', outer: '베이지' },
}
const toneOfUi = (color: string): Tone | null => (DARK_UI.includes(color) ? 'dark' : LIGHT_UI.includes(color) ? 'light' : null)

/** 이 옷이 말한 조건(색/톤/종류)을 모두 만족하는가 */
function satisfies(item: OutfitItem | null, p: WishPiece): boolean {
  if (!item) return false
  if (p.type && item.type !== p.type) return false
  if (p.color && item.color !== p.color) return false
  if (!p.color && p.tone && toneOfUi(item.color) !== p.tone) return false
  return true
}

/** 원하는 옷을 코디에 반영한다. 옷장에서 고른 옷이 이미 조건에 맞으면 그대로 두고, 안 맞는 자리만 예시로 바꾼다. */
export function applyWish(items: OutfitItem[], wish: Wish): { items: OutfitItem[]; applied: string[] } {
  let out = [...items]
  const applied: string[] = []
  if (wish.suit) {
    const r = applySuit(out)
    out = r.items
    applied.push(...r.filled)
  }
  for (const p of wish.pieces) {
    const i = out.findIndex((it) => roleOf(it.type) === p.role)
    const base = i >= 0 ? out[i]! : null
    if (satisfies(base, p)) continue // 옷장에서 이미 맞는 옷을 골랐다
    const type = p.type ?? base?.type ?? DEFAULT_TYPE[p.role]
    const color = p.color ?? (p.tone ? TONE_DEFAULT[p.tone][p.role] : (base?.color ?? '검정'))
    const item = example(type, color)
    if (i >= 0) out[i] = item
    else out.push(item)
    applied.push(item.label)
  }
  return { items: out, applied: [...new Set(applied)] }
}

// ───── 코디 엔진에 넘기는 "원하는 조합" 점수 ─────
// 날씨(보온) 조건은 그대로 두고, 그 조건을 만족하는 조합 중 말한 색/톤/종류에 가까운 옷장 조합이 먼저 뽑히게 한다.
interface PieceWish {
  colors?: string[] // DB 색 (BLACK ...)
  tone?: Tone
  types?: string[] // DB 종류 (SHIRT ...)
}
export interface EngineWish {
  top?: PieceWish
  bottom?: PieceWish
  outer?: PieceWish
}
const DARK_DB = new Set(['BLACK', 'NAVY', 'BROWN', 'KHAKI'])
const LIGHT_DB = new Set(['WHITE', 'BEIGE', 'SKYBLUE', 'PINK', 'YELLOW'])

const safe = <T,>(fn: () => T): T | undefined => {
  try {
    return fn()
  } catch {
    return undefined
  }
}

export function toEngineWish(w: Wish): EngineWish {
  const out: EngineWish = {}
  for (const p of w.pieces) {
    const color = p.color ? safe(() => colorMap.toDb(p.color as never)) : undefined
    const type = p.type ? safe(() => clothingTypeMap.toDb(p.type as never)) : undefined
    out[p.role] = { colors: color ? [color] : undefined, tone: p.color ? undefined : p.tone, types: type ? [type] : undefined }
  }
  return out
}

function pieceFit(w: PieceWish | undefined, piece: { type: string; color: string } | null): number {
  if (!w) return 0
  if (!piece) return -3 // 원하는 자리인데 그 옷이 없는 조합(예: 겉옷을 원했는데 안 입는 조합)
  let s = 0
  if (w.colors?.length) s += w.colors.includes(piece.color) ? 8 : 0
  if (w.tone) {
    const set = w.tone === 'dark' ? DARK_DB : LIGHT_DB
    const opposite = w.tone === 'dark' ? LIGHT_DB : DARK_DB
    s += set.has(piece.color) ? 6 : opposite.has(piece.color) ? -4 : 0
  }
  if (w.types?.length) s += w.types.includes(piece.type) ? 6 : 0
  return s
}

/** 조합이 말한 조건에 얼마나 가까운가(높을수록 가까움) */
export function wishFit(w: EngineWish, c: { top: { type: string; color: string }; bottom: { type: string; color: string }; outer: { type: string; color: string } | null }): number {
  return pieceFit(w.top, c.top) + pieceFit(w.bottom, c.bottom) + pieceFit(w.outer, c.outer)
}
