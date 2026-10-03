import type { ClothingColor, ClothingPattern, ClothingType, Thickness } from '@prisma/client'
import { categoryOfType, clothingTypeMap, colorMap, patternMap } from '../../config/mappings.js'

export const MIN_CLOTHES = 5

export type TitleKey =
  | 'DARK_CHILD' | 'MINIMALIST' | 'PATTERN_MASTER' | 'PASTEL_FAIRY'
  | 'HOODIE_ADDICT' | 'WARM_BEAR' | 'TEE_ONLY' | 'OUTER_FAN'
  | 'SHIRT_GENTLE' | 'SKIRT_LOVER' | 'EARTH_TONE' | 'BLUE_SEA'
  | 'VITAMIN' | 'RAINBOW' | 'COLOR_LOVER' | 'ALL_SEASON' | 'BALANCED'

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
const longTop = isType('LONG_SLEEVE', 'SHIRT', 'SWEATSHIRT', 'KNIT', 'HOODIE')
const bottom: Predicate = (c) => categoryOfType[c.type] === 'BOTTOM'
const outer: Predicate = (c) => ['LIGHT_OUTER', 'HEAVY_OUTER'].includes(categoryOfType[c.type])
const lightOuter: Predicate = (c) => isType('WINDBREAKER', 'JACKET', 'CARDIGAN')(c) && c.thickness !== 'THICK'
const winterOuter: Predicate = (c) => isType('COAT', 'PADDING')(c) && c.thickness !== 'THIN'
const warm: Predicate = (c) => isType('KNIT', 'COAT', 'PADDING')(c) && c.thickness !== 'THIN'
const distinct = (items: ClothesForAnalysis[], field: 'color' | 'type', pred: Predicate = () => true) => new Set(items.filter(pred).map((c) => c[field])).size
const largest = (items: ClothesForAnalysis[], field: 'color' | 'type', pred: Predicate = () => true) => {
  const values = new Map<string, number>()
  for (const c of items.filter(pred)) values.set(c[field], (values.get(c[field]) ?? 0) + 1)
  return Math.max(0, ...values.values())
}
const favorite = (items: ClothesForAnalysis[]) => [...new Set(items.filter(colorful).map((c) => c.color))]
  .sort((a, b) => count(items, isColor(b)) - count(items, isColor(a)) || a.localeCompare(b))[0]
const ratio = (label: string, pred: Predicate, percent: number, min = 3): Requirement => ({ label, count: (items) => count(items, pred), percent, min })
const present = (label: string, pred: Predicate): Requirement => ({ label, count: (items) => count(items, pred), min: 1 })
const hint = (type: ClothingType, color: ClothingColor = 'GREEN', pattern: ClothingPattern = 'SOLID', thickness: Thickness = 'NORMAL'): ClothesForAnalysis => ({ type, color, pattern, thickness })

// 수치와 도감 문구는 같은 requirements에서 생성한다. 비율의 분모는 항상 내 옷 전체다.
// 동점: 구체적인 종류/단색 > 무늬 > 복합 색 계열 > 구조. 비율/기준으로 나누어 특정 칭호를 과대평가하지 않는다.
const RULES: TitleRule[] = [
  { key: 'HOODIE_ADDICT', name: '후드티 중독자', tagline: '후드를 쓰면 마음이 편해져', requirements: [ratio('후드티', isType('HOODIE'), 50)], hint: hint('HOODIE') },
  { key: 'SHIRT_GENTLE', name: '셔츠 신사', tagline: '다림질은 마음에서부터', requirements: [ratio('셔츠·반팔셔츠', isType('SHIRT', 'SHORT_SLEEVE_SHIRT'), 50)], hint: hint('SHIRT') },
  { key: 'SKIRT_LOVER', name: '스커트 러버', tagline: '걸을 때마다 살랑살랑', requirements: [ratio('치마', isType('SKIRT'), 50)], hint: hint('SKIRT') },
  { key: 'TEE_ONLY', name: '반팔 한 장 인간', tagline: '반팔 상의가 옷장의 주인공', requirements: [ratio('반팔·반팔셔츠 상의(반바지 제외)', shortTop, 60)], hint: hint('SHORT_SLEEVE') },
  { key: 'DARK_CHILD', name: '어둠의 아이', tagline: '당신의 옷장엔 빛이 들지 않는다…', requirements: [ratio('검정 옷', isColor('BLACK'), 60)], hint: hint('PANTS', 'BLACK') },
  { key: 'COLOR_LOVER', name: '하나에만 꽂힌다', tagline: '이 색이 아니면 안 돼', requirements: [{ label: '검정·회색·흰색·기타를 제외한 한 색', count: (items) => largest(items, 'color', colorful), percent: 60, min: 3 }] },
  { key: 'PATTERN_MASTER', name: '패턴 장인', tagline: '체크, 줄무늬, 도트… 무늬 없이는 외출 못 해', requirements: [ratio('체크·줄무늬·도트·프린트 옷', (c) => !plain(c), 60)], hint: hint('PANTS', 'GREEN', 'CHECK') },
  { key: 'MINIMALIST', name: '무채색 미니멀리스트', tagline: '검정·회색·흰색, 그리고 무지. 더 이상 뭐가 필요해?', requirements: [ratio('검정·회색·흰색이면서 무지인 옷', (c) => neutral(c) && plain(c), 80, 4)], hint: hint('PANTS', 'GRAY') },
  { key: 'WARM_BEAR', name: '따뜻한 곰', tagline: '겨울잠을 준비하는 옷장', requirements: [ratio('보통·두꺼움 니트·패딩·코트(얇음 제외)', warm, 50)], hint: hint('KNIT') },
  { key: 'OUTER_FAN', name: '겉옷 수집가', tagline: '겉옷 하나면 인생이 한 겹 더 따뜻해', requirements: [ratio('바람막이·자켓·가디건·코트·패딩', outer, 50)], hint: hint('JACKET') },
  { key: 'PASTEL_FAIRY', name: '파스텔 요정', tagline: '오늘도 반짝반짝 포근포근', requirements: [ratio('분홍·하늘색·베이지 옷', isColor('PINK', 'SKYBLUE', 'BEIGE'), 60), ratio('분홍·하늘색 옷', isColor('PINK', 'SKYBLUE'), 40, 2)], hint: hint('PANTS', 'PINK') },
  { key: 'EARTH_TONE', name: '모카 라떼 인간', tagline: '따뜻한 카페 같은 옷장', requirements: [ratio('베이지·갈색·카키 옷', isColor('BEIGE', 'BROWN', 'KHAKI'), 60)], hint: hint('PANTS', 'BROWN') },
  { key: 'BLUE_SEA', name: '푸른 바다', tagline: '파도처럼 시원한 옷장', requirements: [ratio('파랑·네이비·하늘색 옷', isColor('BLUE', 'NAVY', 'SKYBLUE'), 60)], hint: hint('PANTS', 'BLUE') },
  { key: 'VITAMIN', name: '비타민 폭탄', tagline: '눈이 번쩍! 에너지 충전 완료', requirements: [ratio('빨강·주황·노랑 옷', isColor('RED', 'ORANGE', 'YELLOW'), 60)], hint: hint('PANTS', 'RED') },
  { key: 'RAINBOW', name: '무지개 수집가', tagline: '어느 색이든 환영이야', structural: true, requirements: [
    { label: '검정·회색·흰색·기타를 제외한 색', count: (items) => distinct(items, 'color', colorful), min: 6, unit: '색' },
    ratio('검정·회색·흰색·기타를 제외한 옷', colorful, 80, 6),
    { label: '가장 많은 한 색', count: (items) => largest(items, 'color'), maxPercent: 30 },
  ] },
  { key: 'ALL_SEASON', name: '사계절 준비 완료', tagline: '계절별 상의·하의·겉옷을 갖춘 옷장', structural: true, requirements: [
    { label: '내 옷', count: (items) => items.length, min: 8 },
    present('반팔·반팔셔츠 상의', shortTop),
    present('긴팔·셔츠·맨투맨·니트·후드티 상의', longTop),
    present('하의(바지·반바지·치마)', bottom),
    present('얇음·보통 바람막이·자켓·가디건', lightOuter),
    present('보통·두꺼움 코트·패딩', winterOuter),
  ] },
  { key: 'BALANCED', name: '균형 잡힌 옷장', tagline: '색도 종류도 골고루 갖춘 옷장', structural: true, requirements: [
    { label: '옷 종류', count: (items) => distinct(items, 'type'), min: 4, unit: '종류' },
    { label: '기타를 제외한 색', count: (items) => distinct(items, 'color', (c) => c.color !== 'OTHER'), min: 3, unit: '색' },
    ratio('기타를 제외한 옷', (c) => c.color !== 'OTHER', 80, 4),
    present('상의', (c) => categoryOfType[c.type] === 'TOP'), present('하의', bottom), present('겉옷', outer),
    { label: '가장 많은 한 종류', count: (items) => largest(items, 'type'), maxPercent: 40 },
    { label: '가장 많은 한 색', count: (items) => largest(items, 'color'), maxPercent: 50 },
  ] },
]

const describe = (r: Requirement) => `${r.label} ${[
  r.percent !== undefined && `${r.percent}% 이상`,
  r.maxPercent !== undefined && `${r.maxPercent}% 이하`,
  r.min !== undefined && `${r.min}${r.unit ?? '벌'} 이상`,
].filter(Boolean).join('·')}`
const def = (r: TitleRule): TitleDef => ({ key: r.key, name: r.name, tagline: r.tagline, rule: r.requirements.map(describe).join(' / ') })
// 도감 순서는 기존 그대로 유지하고, 선정 우선순위는 RULES에서 별도로 관리한다.
const DEX: TitleKey[] = ['DARK_CHILD', 'MINIMALIST', 'PATTERN_MASTER', 'PASTEL_FAIRY', 'HOODIE_ADDICT', 'WARM_BEAR', 'TEE_ONLY', 'OUTER_FAN', 'SHIRT_GENTLE', 'SKIRT_LOVER', 'EARTH_TONE', 'BLUE_SEA', 'VITAMIN', 'RAINBOW', 'COLOR_LOVER', 'ALL_SEASON', 'BALANCED']
export const TITLES = DEX.map((key) => def(RULES.find((r) => r.key === key)!))
export const titleOf = (key: TitleKey) => TITLES.find((t) => t.key === key)!

const evaluate = (items: ClothesForAnalysis[]) => {
  const n = items.length
  if (n < MIN_CLOTHES) return []
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

export function analyze(clothes: ClothesForAnalysis[]): Analysis {
  const n = clothes.length
  const passed = evaluate(clothes)
  let next: Analysis['next'] = null
  if (n >= MIN_CLOTHES) {
    for (const r of RULES) {
      if (passed.some((p) => p.title.key === r.key)) continue
      const fav = favorite(clothes)
      const example = r.key === 'COLOR_LOVER' && fav ? hint('PANTS', fav) : r.hint
      if (!example) continue
      for (let more = 1; more <= Math.min(3, 500 - n); more++) {
        // 비율뿐 아니라 복합 조건과 선정 순위까지 같은 판정기로 검증한다.
        const projected = evaluate([...clothes, ...Array.from({ length: more }, () => example)])
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
    count: n, ready: n >= MIN_CLOTHES, need: Math.max(0, MIN_CLOTHES - n),
    title: passed[0]?.title ?? null, subTitle: passed[1]?.title ?? null,
    strength: passed[0]?.strength ?? 0, matchedTitles: passed.map((p) => p.title), next,
    colors: shares(clothes.map((c) => colorMap.toUi(c.color))),
    types: shares(clothes.map((c) => clothingTypeMap.toUi(c.type))),
    patterns: shares(clothes.map((c) => patternMap.toUi(c.pattern))),
  }
}
