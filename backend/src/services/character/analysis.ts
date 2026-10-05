import type { ClothingColor, ClothingPattern, ClothingType, Thickness } from '@prisma/client'
import { categoryOfType, clothingTypeMap, colorMap, patternMap } from '../../config/mappings.js'

export const MIN_CLOTHES = 10

export type TitleKey =
  | 'DARK_CHILD' | 'MINIMALIST' | 'PATTERN_MASTER' | 'PASTEL_FAIRY'
  | 'HOODIE_ADDICT' | 'WARM_BEAR' | 'TEE_ONLY' | 'OUTER_FAN'
  | 'SHIRT_GENTLE' | 'SKIRT_LOVER' | 'EARTH_TONE' | 'BLUE_SEA'
  | 'VITAMIN' | 'RAINBOW' | 'COLOR_LOVER'
  | 'SUMMER_COOL' | 'SPRING_FALL' | 'WINTER_THICK' | 'TOP_HEAVY' | 'BOTTOM_HEAVY'

export interface TitleDef {
  key: TitleKey
  name: string
  tagline: string
  rule: string
  /** 현재 옷장의 실제 수치. 도감의 고정 정의에는 없고 분석 결과에만 있다. */
  reason?: string
}

export interface ClothesForAnalysis {
  type: ClothingType
  color: ClothingColor
  pattern: ClothingPattern
  thickness: Thickness
}

/** 희귀 칭호에 안 걸릴 때, 내 옷장에서 가장 두드러진 특징으로 만든 칭호. 도감에는 없다. */
export interface TasteTitle {
  key: 'TASTE'
  name: string
  tagline: string
  rule: string
  reason: string
  /** 캐릭터 복장을 맞추기 위한 값: 두드러진 것이 색/종류/무늬 중 무엇인지와 화면 문자열(예: '파랑'). 종류면 상의/하의/겉옷 구분도 준다. */
  kind: 'color' | 'type' | 'pattern'
  value: string
  category?: 'TOP' | 'BOTTOM' | 'OUTER'
}

export interface Share { name: string; count: number; share: number }
export interface Analysis {
  count: number
  /** 꾸미기 해제 조건. true여도 칭호 조건을 만족하지 않으면 title은 null이다. */
  ready: boolean
  need: number
  title: TitleDef | null
  /** 선택된 특징의 실제 비중(0~1). 충족 판정은 matchedTitles로 확인한다. */
  strength: number
  subTitle: TitleDef | null
  /** 희귀 칭호(title)가 없고 꾸미기가 열렸을 때만 채워진다. 특징이 정말 없으면 null. */
  taste: TasteTitle | null
  matchedTitles: TitleDef[]
  /** what에 명시한 예시 옷을 추가하면 주/부칭호로 나타나는 힌트만 제공한다. */
  next: { title: TitleDef; more: number; what: string; example: ClothesForAnalysis } | null
  colors: Share[]
  types: Share[]
  patterns: Share[]
}

type Predicate = (c: ClothesForAnalysis) => boolean
interface Requirement {
  label: string
  count: (items: ClothesForAnalysis[]) => number
  min?: number
  percent?: number
  maxPercent?: number
  unit?: string
}
interface TitleRule {
  key: TitleKey
  name: string
  tagline: string
  requirements: Requirement[]
  /** 구조 칭호는 특징 칭호 뒤에 둔다. 같은 비중이면 배열 순서가 우선이다. */
  structural?: boolean
  hint?: ClothesForAnalysis
}

const isType = (...types: ClothingType[]): Predicate => (c) => types.includes(c.type)
const isColor = (...colors: ClothingColor[]): Predicate => (c) => colors.includes(c.color)
const count = (items: ClothesForAnalysis[], pred: Predicate) => items.filter(pred).length
const plain: Predicate = (c) => c.pattern === 'SOLID'
const neutral = isColor('BLACK', 'GRAY', 'WHITE')
const colorful: Predicate = (c) => c.color !== 'OTHER' && !neutral(c)
const shortTop = isType('SHORT_SLEEVE', 'SHORT_SLEEVE_SHIRT')
const outer: Predicate = (c) => ['LIGHT_OUTER', 'HEAVY_OUTER'].includes(categoryOfType[c.type])
const warm: Predicate = (c) => isType('KNIT', 'COAT', 'PADDING')(c) && c.thickness !== 'THIN'
const isCategory = (...cats: string[]): Predicate => (c) => cats.includes(categoryOfType[c.type])
const thick = (t: Thickness): Predicate => (c) => c.thickness === t
const springFall: Predicate = (c) => isType('LONG_SLEEVE', 'SHIRT', 'SWEATSHIRT', 'CARDIGAN', 'JACKET', 'WINDBREAKER')(c) && c.thickness === 'NORMAL'
const distinct = (items: ClothesForAnalysis[], field: 'color' | 'type', pred: Predicate = () => true) => new Set(items.filter(pred).map((c) => c[field])).size
const largest = (items: ClothesForAnalysis[], field: 'color' | 'type', pred: Predicate = () => true) => {
  const values = new Map<string, number>()
  for (const c of items.filter(pred)) values.set(c[field], (values.get(c[field]) ?? 0) + 1)
  return Math.max(0, ...values.values())
}
const favorite = (items: ClothesForAnalysis[]) => [...new Set(items.filter(colorful).map((c) => c.color))]
  .sort((a, b) => count(items, isColor(b)) - count(items, isColor(a)) || a.localeCompare(b))[0]
const ratio = (label: string, pred: Predicate, percent: number, min = 3): Requirement => ({ label, count: (items) => count(items, pred), percent, min })
const hint = (type: ClothingType, color: ClothingColor = 'GREEN', pattern: ClothingPattern = 'SOLID', thickness: Thickness = 'NORMAL'): ClothesForAnalysis => ({ type, color, pattern, thickness })

// 수치와 도감 문구는 같은 requirements에서 생성한다. 비율의 분모는 항상 내 옷 전체다.
// 동점: 구체적인 종류/단색 > 무늬 > 복합 색 계열 > 구조. 비율/기준으로 나누어 특정 칭호를 과대평가하지 않는다.
const RULES: TitleRule[] = [
  { key: 'HOODIE_ADDICT', name: '후드티 중독자', tagline: '후드를 쓰면 마음이 편해져', requirements: [ratio('후드티', isType('HOODIE'), 40)], hint: hint('HOODIE') },
  { key: 'SHIRT_GENTLE', name: '셔츠 신사', tagline: '다림질은 마음에서부터', requirements: [ratio('셔츠·반팔셔츠', isType('SHIRT', 'SHORT_SLEEVE_SHIRT'), 40)], hint: hint('SHIRT') },
  { key: 'SKIRT_LOVER', name: '스커트 러버', tagline: '걸을 때마다 살랑살랑', requirements: [ratio('치마', isType('SKIRT'), 40)], hint: hint('SKIRT') },
  { key: 'TEE_ONLY', name: '반팔 한 장 인간', tagline: '반팔 상의가 옷장의 주인공', requirements: [ratio('반팔·반팔셔츠 상의(반바지 제외)', shortTop, 50)], hint: hint('SHORT_SLEEVE') },
  { key: 'DARK_CHILD', name: '어둠의 아이', tagline: '당신의 옷장엔 빛이 들지 않는다…', requirements: [ratio('검정 옷', isColor('BLACK'), 50)], hint: hint('PANTS', 'BLACK') },
  { key: 'COLOR_LOVER', name: '하나에만 꽂힌다', tagline: '이 색이 아니면 안 돼', requirements: [{ label: '검정·회색·흰색·기타를 제외한 한 색', count: (items) => largest(items, 'color', colorful), percent: 50, min: 3 }] },
  { key: 'PATTERN_MASTER', name: '패턴 장인', tagline: '체크, 줄무늬, 도트… 무늬 없이는 외출 못 해', requirements: [ratio('체크·줄무늬·도트·프린트 옷', (c) => !plain(c), 50)], hint: hint('PANTS', 'GREEN', 'CHECK') },
  { key: 'MINIMALIST', name: '무채색 미니멀리스트', tagline: '검정·회색·흰색, 그리고 무지. 더 이상 뭐가 필요해?', requirements: [ratio('검정·회색·흰색이면서 무지인 옷', (c) => neutral(c) && plain(c), 65, 4)], hint: hint('PANTS', 'GRAY') },
  { key: 'WARM_BEAR', name: '따뜻한 곰', tagline: '겨울잠을 준비하는 옷장', requirements: [ratio('보통·두꺼움 니트·패딩·코트(얇음 제외)', warm, 40)], hint: hint('KNIT') },
  { key: 'OUTER_FAN', name: '겉옷 수집가', tagline: '겉옷 하나면 인생이 한 겹 더 따뜻해', requirements: [ratio('바람막이·자켓·가디건·코트·패딩', outer, 40)], hint: hint('JACKET') },
  { key: 'PASTEL_FAIRY', name: '파스텔 요정', tagline: '오늘도 반짝반짝 포근포근', requirements: [ratio('분홍·하늘색·베이지 옷', isColor('PINK', 'SKYBLUE', 'BEIGE'), 50), ratio('분홍·하늘색 옷', isColor('PINK', 'SKYBLUE'), 30, 2)], hint: hint('PANTS', 'PINK') },
  { key: 'EARTH_TONE', name: '모카 라떼 인간', tagline: '따뜻한 카페 같은 옷장', requirements: [ratio('베이지·갈색·카키 옷', isColor('BEIGE', 'BROWN', 'KHAKI'), 50)], hint: hint('PANTS', 'BROWN') },
  { key: 'BLUE_SEA', name: '푸른 바다', tagline: '파도처럼 시원한 옷장', requirements: [ratio('파랑·네이비·하늘색 옷', isColor('BLUE', 'NAVY', 'SKYBLUE'), 50)], hint: hint('PANTS', 'BLUE') },
  { key: 'VITAMIN', name: '비타민 폭탄', tagline: '눈이 번쩍! 에너지 충전 완료', requirements: [ratio('빨강·주황·노랑 옷', isColor('RED', 'ORANGE', 'YELLOW'), 50)], hint: hint('PANTS', 'RED') },
  { key: 'RAINBOW', name: '무지개 수집가', tagline: '어느 색이든 환영이야', structural: true, requirements: [
    { label: '검정·회색·흰색·기타를 제외한 색', count: (items) => distinct(items, 'color', colorful), min: 7, unit: '색' },
    ratio('검정·회색·흰색·기타를 제외한 옷', colorful, 80, 7),
    { label: '가장 많은 한 색', count: (items) => largest(items, 'color'), maxPercent: 30 },
  ] },
  { key: 'SUMMER_COOL', name: '여름 나라 주민', tagline: '시원한 게 최고야, 땀은 사절', requirements: [ratio('얇은 옷', thick('THIN'), 50)], hint: hint('SHORT_SLEEVE', 'WHITE', 'SOLID', 'THIN') },
  { key: 'WINTER_THICK', name: '한겨울 대비반', tagline: '두툼해야 마음이 놓여', requirements: [ratio('두꺼운 옷', thick('THICK'), 40)], hint: hint('PADDING', 'BLACK', 'SOLID', 'THICK') },
  { key: 'SPRING_FALL', name: '봄가을 산책러', tagline: '선선한 바람엔 딱 이 정도가 좋아', requirements: [ratio('보통 두께의 긴팔·셔츠·맨투맨·가디건·자켓·바람막이', springFall, 60)], hint: hint('LONG_SLEEVE', 'BEIGE') },
  { key: 'TOP_HEAVY', name: '상의 부자', tagline: '위는 풍족한데 아래는 늘 같은 바지', structural: true, requirements: [ratio('상의(반팔·긴팔·셔츠·맨투맨·니트·후드티)', isCategory('TOP'), 70, 7)], hint: hint('SHIRT', 'SKYBLUE') },
  { key: 'BOTTOM_HEAVY', name: '하의 부자', tagline: '바지·치마가 가득한 옷장', structural: true, requirements: [ratio('하의(바지·반바지·치마)', isCategory('BOTTOM'), 45, 4)], hint: hint('PANTS', 'NAVY') },
]

const describe = (r: Requirement) => `${r.label} ${[
  r.percent !== undefined && `${r.percent}% 이상`,
  r.maxPercent !== undefined && `${r.maxPercent}% 이하`,
  r.min !== undefined && `${r.min}${r.unit ?? '벌'} 이상`,
].filter(Boolean).join('·')}`
const def = (r: TitleRule): TitleDef => ({ key: r.key, name: r.name, tagline: r.tagline, rule: r.requirements.map(describe).join(' / ') })
// 도감 순서는 기존 그대로 유지하고, 선정 우선순위는 RULES에서 별도로 관리한다.
const DEX: TitleKey[] = ['DARK_CHILD', 'MINIMALIST', 'PATTERN_MASTER', 'PASTEL_FAIRY', 'HOODIE_ADDICT', 'WARM_BEAR', 'TEE_ONLY', 'OUTER_FAN', 'SHIRT_GENTLE', 'SKIRT_LOVER', 'EARTH_TONE', 'BLUE_SEA', 'VITAMIN', 'RAINBOW', 'COLOR_LOVER', 'SUMMER_COOL', 'SPRING_FALL', 'WINTER_THICK', 'TOP_HEAVY', 'BOTTOM_HEAVY']
export const TITLES = DEX.map((key) => def(RULES.find((r) => r.key === key)!))
export const titleOf = (key: TitleKey) => TITLES.find((t) => t.key === key)!

const evaluate = (items: ClothesForAnalysis[], min = MIN_CLOTHES) => {
  const n = items.length
  if (n < min) return []
  return RULES.flatMap((r, priority) => {
    const values = r.requirements.map((req) => ({ req, count: req.count(items) }))
    if (!values.every(({ req, count: m }) => (req.min === undefined || m >= req.min)
      && (req.percent === undefined || 100 * m >= req.percent * n)
      && (req.maxPercent === undefined || 100 * m <= req.maxPercent * n))) return []
    const title = def(r)
    const fav = r.key === 'COLOR_LOVER' ? favorite(items) : undefined
    if (fav) title.tagline = `${colorMap.toUi(fav)} 아니면 안 돼`
    title.reason = values.map(({ req, count: m }) => {
      const label = fav ? `${colorMap.toUi(fav)} 옷` : req.label
      // 내림하여 경계 아래의 실제 비율을 충족 비율로 보이지 않게 한다. 벌수도 함께 표시한다.
      return req.percent !== undefined || req.maxPercent !== undefined
        ? `${label} ${m}/${n}벌(${Math.floor(1000 * m / n) / 10}%)`
        : `${label} ${m}${req.unit ?? '벌'}`
    }).join(' · ')
    return [{ title, structural: !!r.structural, priority, strength: r.structural ? 0 : values[0]!.count / n }]
  }).sort((a, b) => Number(a.structural) - Number(b.structural) || b.strength - a.strength || a.priority - b.priority)
}

const shares = (names: string[]): Share[] => {
  const m = new Map<string, number>()
  for (const name of names) m.set(name, (m.get(name) ?? 0) + 1)
  return [...m.entries()].map(([name, count]) => ({ name, count, share: count / names.length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'))
}

/** 가장 두드러진 한 가지(개수가 같으면 색 > 종류 > 무늬)로 이름을 만든다. 같은 특징이 2벌 미만이면 만들지 않는다. */
export function tasteOf(items: ClothesForAnalysis[]): TasteTitle | null {
  const n = items.length
  if (n === 0) return null
  const top = (values: string[]) => {
    const m = new Map<string, number>()
    for (const v of values) m.set(v, (m.get(v) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  }
  const order = ['color', 'type', 'pattern']
  const cands: { kind: 'color' | 'type' | 'pattern'; ui: string; count: number; category?: 'TOP' | 'BOTTOM' | 'OUTER' }[] = []
  const color = top(items.filter((c) => c.color !== 'OTHER').map((c) => c.color))
  if (color) cands.push({ kind: 'color', ui: colorMap.toUi(color[0] as ClothingColor), count: color[1] })
  const type = top(items.map((c) => c.type))
  if (type) {
    const cat = categoryOfType[type[0] as ClothingType]
    cands.push({ kind: 'type', ui: clothingTypeMap.toUi(type[0] as ClothingType), count: type[1], category: cat === 'TOP' || cat === 'BOTTOM' ? cat : 'OUTER' })
  }
  const pattern = top(items.filter((c) => c.pattern !== 'SOLID').map((c) => c.pattern))
  if (pattern) cands.push({ kind: 'pattern', ui: patternMap.toUi(pattern[0] as ClothingPattern), count: pattern[1] })
  const best = cands.filter((c) => c.count >= 2).sort((a, b) => b.count - a.count || order.indexOf(a.kind) - order.indexOf(b.kind))[0]
  if (!best) return null
  const pct = Math.floor((1000 * best.count) / n) / 10
  const reason = `${best.ui}${best.kind === 'type' ? '' : ' 옷'} ${best.count}/${n}벌(${pct}%)`
  const byKind = {
    color: { name: `${best.ui} 편애 중`, tagline: `자꾸 손이 가는 ${best.ui}` },
    type: { name: `${best.ui} 단골`, tagline: '내 옷장의 단골손님' },
    pattern: { name: `${best.ui} 포인트`, tagline: '무늬 하나쯤은 있어야지' },
  }[best.kind]
  return { key: 'TASTE', ...byKind, rule: '내 옷장에서 가장 눈에 띄는 취향이에요', reason, kind: best.kind, value: best.ui, category: best.category }
}

/** min: 캐릭터가 열리는 최소 옷 벌 수(기본은 MIN_CLOTHES). 칭호 규칙만 따로 시험할 때 바꿔 쓴다. */
export function analyze(clothes: ClothesForAnalysis[], min = MIN_CLOTHES): Analysis {
  const n = clothes.length
  const passed = evaluate(clothes, min)
  let next: Analysis['next'] = null
  if (n >= min) {
    for (const r of RULES) {
      if (passed.some((p) => p.title.key === r.key)) continue
      const fav = favorite(clothes)
      const example = r.key === 'COLOR_LOVER' && fav ? hint('PANTS', fav) : r.hint
      if (!example) continue
      for (let more = 1; more <= Math.min(3, 500 - n); more++) {
        // 비율뿐 아니라 복합 조건과 선정 순위까지 같은 판정기로 검증한다.
        const projected = evaluate([...clothes, ...Array.from({ length: more }, () => example)], min)
        if (!projected.slice(0, 2).some((p) => p.title.key === r.key)) continue
        if (!next || more < next.more) next = {
          title: titleOf(r.key), more, example,
          what: `${colorMap.toUi(example.color)} ${patternMap.toUi(example.pattern)} ${clothingTypeMap.toUi(example.type)}(두께 ${example.thickness === 'NORMAL' ? '보통' : example.thickness === 'THIN' ? '얇음' : '두꺼움'})`,
        }
        break
      }
    }
  }
  return {
    count: n, ready: n >= min, need: Math.max(0, min - n),
    title: passed[0]?.title ?? null, subTitle: passed[1]?.title ?? null,
    taste: n >= min && passed.length === 0 ? tasteOf(clothes) : null,
    strength: passed[0]?.strength ?? 0, matchedTitles: passed.map((p) => p.title), next,
    colors: shares(clothes.map((c) => colorMap.toUi(c.color))),
    types: shares(clothes.map((c) => clothingTypeMap.toUi(c.type))),
    patterns: shares(clothes.map((c) => patternMap.toUi(c.pattern))),
  }
}
