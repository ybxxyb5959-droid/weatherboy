// 사용자가 말로 "검정색 상의를 입고 싶어"처럼 원하는 옷을 말하면, 옷장에 없어도 그 옷을 "예시"로 입혀서 보여준다.
// 포멀한 정장은 정장 세트(셔츠 + 자켓 + 바지)가 보이도록 옷장에 없는 부분을 예시로 채운다.
// 예시 옷은 옷장에 담긴 옷이 아니라서 owned=false, example=true 로 표시한다. (결정론적 규칙이다: AI 를 쓰지 않는다)
import type { OutfitItem } from './outfitEngine.js'

export type Role = 'top' | 'bottom' | 'outer'

export interface WishPiece {
  role: Role
  /** 말한 옷 종류(예: 셔츠). 없으면 코디가 이미 고른 옷의 종류를 그대로 쓰고 색만 바꾼다 */
  type?: string
  color?: string
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

/** 말에서 원하는 옷(색, 종류)을 찾는다. 아무것도 못 찾으면 null */
export function parseWish(text: string): Wish | null {
  const t = text.replace(/\s+/g, ' ')
  const colors: { at: number; end: number; name: string }[] = []
  for (const [re, name] of COLOR_WORDS) {
    const m = re.exec(t)
    if (m) colors.push({ at: m.index, end: m.index + m[0].length, name })
  }
  const taken: [number, number][] = []
  const pieces: WishPiece[] = []
  for (const [re, role, type] of TYPE_WORDS) {
    const m = re.exec(t)
    if (!m) continue
    const at = m.index
    const end = at + m[0].length
    if (taken.some(([a, b]) => at < b && end > a)) continue // 이미 더 긴 말에 잡힌 자리
    taken.push([at, end])
    // 이 옷 바로 앞(8글자 안)에 나온 색이 이 옷의 색이다 ("검정색 상의")
    const color = colors.filter((c) => c.end <= at && at - c.end <= 8).sort((a, b) => b.end - a.end)[0]?.name
    if (!pieces.some((p) => p.role === role)) pieces.push({ role, type, color })
  }
  const suit = /정장|수트|슈트/.test(t)
  // 옷 낱말 없이 색만 말했다면 상의의 색으로 본다("검정색으로 입고 싶어")
  if (pieces.length === 0 && !suit && colors.length > 0) pieces.push({ role: 'top', color: colors[0]!.name })
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

/** 원하는 옷을 코디에 반영한다. 말한 자리의 옷만 예시로 바꾸고 나머지는 그대로 둔다. */
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
    const type = p.type ?? base?.type ?? DEFAULT_TYPE[p.role]
    const color = p.color ?? base?.color ?? '검정'
    // 말한 것이 이미 입고 있는 옷과 같으면(옷장에 그 옷이 있으면) 그대로 둔다
    if (base && base.type === type && base.color === color) continue
    const item = example(type, color)
    if (i >= 0) out[i] = item
    else out.push(item)
    applied.push(item.label)
  }
  return { items: out, applied: [...new Set(applied)] }
}
