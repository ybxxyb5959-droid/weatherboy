import type { ClothingColor, ClothingPattern, ClothingType } from '@prisma/client'
import { clothingTypeMap, colorMap, patternMap } from '../../config/mappings.js'

/** 칭호가 붙으려면 직접 담은 옷이 이만큼은 있어야 한다 (한두 벌로 "어둠의 아이"가 되지 않게) */
export const MIN_CLOTHES = 5

export type TitleKey =
  | 'DARK_CHILD'
  | 'MINIMALIST'
  | 'PATTERN_MASTER'
  | 'PASTEL_FAIRY'
  | 'HOODIE_ADDICT'
  | 'WARM_BEAR'
  | 'TEE_ONLY'
  | 'OUTER_FAN'
  | 'SHIRT_GENTLE'
  | 'SKIRT_LOVER'
  | 'EARTH_TONE'
  | 'BLUE_SEA'
  | 'VITAMIN'
  | 'RAINBOW'
  | 'COLOR_LOVER'
  | 'ALL_SEASON'
  | 'BALANCED'

export interface TitleDef {
  key: TitleKey
  name: string
  /** 공유 카드와 화면에 나오는 한 줄 */
  tagline: string
  /** 이 칭호를 받는 조건 (화면에서 "어떻게 받나요?"에 보여준다) */
  rule: string
}

/** 점수가 같을 때 앞에 있는 칭호가 이긴다 */
export const TITLES: TitleDef[] = [
  { key: 'DARK_CHILD', name: '어둠의 아이', tagline: '당신의 옷장엔 빛이 들지 않는다…', rule: '검정 옷이 절반 이상' },
  { key: 'MINIMALIST', name: '무채색 미니멀리스트', tagline: '검정·회색·흰색, 그리고 무지. 더 이상 뭐가 필요해?', rule: '검정·회색·흰색이 80% 이상이고 무늬 없는 옷이 대부분' },
  { key: 'PATTERN_MASTER', name: '패턴 장인', tagline: '체크, 줄무늬, 도트… 무늬 없이는 외출 못 해', rule: '체크·줄무늬·도트·프린트 옷이 40% 이상' },
  { key: 'PASTEL_FAIRY', name: '파스텔 요정', tagline: '오늘도 반짝반짝 포근포근', rule: '분홍·하늘·베이지가 40% 이상' },
  { key: 'HOODIE_ADDICT', name: '후드티 중독자', tagline: '후드를 쓰면 마음이 편해져', rule: '후드티가 25% 이상(3벌 이상)' },
  { key: 'WARM_BEAR', name: '따뜻한 곰', tagline: '겨울잠을 준비하는 옷장', rule: '니트·패딩·코트가 35% 이상' },
  { key: 'TEE_ONLY', name: '반팔 한 장 인간', tagline: '추위? 그게 뭔데', rule: '반팔과 반바지가 절반 이상' },
  { key: 'OUTER_FAN', name: '겉옷 수집가', tagline: '겉옷 하나면 인생이 한 겹 더 따뜻해', rule: '겉옷(바람막이·자켓·가디건·코트·패딩)이 40% 이상' },
  { key: 'SHIRT_GENTLE', name: '셔츠 신사', tagline: '다림질은 마음에서부터', rule: '셔츠(반팔 셔츠 포함)가 25% 이상(3벌 이상)' },
  { key: 'SKIRT_LOVER', name: '스커트 러버', tagline: '걸을 때마다 살랑살랑', rule: '치마가 20% 이상(2벌 이상)' },
  { key: 'EARTH_TONE', name: '모카 라떼 인간', tagline: '따뜻한 카페 같은 옷장', rule: '베이지·갈색·카키가 50% 이상' },
  { key: 'BLUE_SEA', name: '푸른 바다', tagline: '파도처럼 시원한 옷장', rule: '파랑·네이비·하늘색이 50% 이상' },
  { key: 'VITAMIN', name: '비타민 폭탄', tagline: '눈이 번쩍! 에너지 충전 완료', rule: '빨강·주황·노랑이 40% 이상' },
  { key: 'RAINBOW', name: '무지개 수집가', tagline: '어느 색이든 환영이야', rule: '6가지 색 이상을 입고 한 색이 30%를 넘지 않음' },
  { key: 'COLOR_LOVER', name: '하나에만 꽂힌다', tagline: '이 색이 아니면 안 돼', rule: '검정이 아닌 한 가지 색이 절반 이상(3벌 이상)' },
  { key: 'ALL_SEASON', name: '사계절 준비 완료', tagline: '봄여름가을겨울, 언제든 나갈 수 있어', rule: '반팔·긴팔·얇은 겉옷·두꺼운 겉옷을 모두 갖춤(8벌 이상)' },
  { key: 'BALANCED', name: '균형 잡힌 옷장', tagline: '무엇이든 소화하는 올라운더', rule: '어느 쪽으로도 치우치지 않음' },
]
export const titleOf = (key: TitleKey) => TITLES.find((t) => t.key === key)!

export interface ClothesForAnalysis {
  type: ClothingType
  color: ClothingColor
  pattern: ClothingPattern
}

export interface Share {
  name: string
  count: number
  share: number // 0~1
}

export interface Analysis {
  count: number
  /** 칭호를 줄 만큼 옷이 쌓였는가 */
  ready: boolean
  need: number // 칭호까지 더 필요한 옷 수 (ready 면 0)
  title: TitleDef | null
  /** 칭호 판정에서 가장 가깝게 맞은 정도 (1 이상이면 조건 충족) */
  strength: number
  /** 조건을 함께 만족한 두 번째 칭호 (없으면 null) */
  subTitle: TitleDef | null
  /** 몇 벌만 더 담으면 받을 수 있는 가장 가까운 칭호 */
  next: { title: TitleDef; more: number; what: string } | null
  colors: Share[]
  types: Share[]
  patterns: Share[]
}

const shares = (names: string[]): Share[] => {
  const m = new Map<string, number>()
  for (const n of names) m.set(n, (m.get(n) ?? 0) + 1)
  return [...m.entries()].map(([name, count]) => ({ name, count, share: count / names.length })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'))
}

/** 옷장 -> 칭호와 비중. 칭호마다 (비중 / 기준)을 점수로 하고, 1 이상인 것 중 가장 높은 점수가 이긴다. */
export function analyze(clothes: ClothesForAnalysis[]): Analysis {
  const n = clothes.length
  const ready = n >= MIN_CLOTHES
  const colors = shares(clothes.map((c) => colorMap.toUi(c.color)))
  const types = shares(clothes.map((c) => clothingTypeMap.toUi(c.type)))
  const patterns = shares(clothes.map((c) => patternMap.toUi(c.pattern)))
  if (n === 0) return { count: 0, ready: false, need: MIN_CLOTHES, title: null, strength: 0, subTitle: null, next: null, colors, types, patterns }

  const frac = (pred: (c: ClothesForAnalysis) => boolean) => clothes.filter(pred).length / n
  const has = (c: ClothesForAnalysis, ...colorsIn: ClothingColor[]) => colorsIn.includes(c.color)
  const hoodie = clothes.filter((c) => c.type === 'HOODIE').length

  const countOf = (pred: (c: ClothesForAnalysis) => boolean) => clothes.filter(pred).length
  const distinctColors = new Set(clothes.filter((c) => c.color !== 'OTHER').map((c) => c.color)).size
  const maxColorShare = Math.max(...colors.map((x) => x.share))
  const shirts = countOf((c) => c.type === 'SHIRT' || c.type === 'SHORT_SLEEVE_SHIRT')
  const skirts = countOf((c) => c.type === 'SKIRT')
  // 검정이 아닌 색 중 가장 많은 색 ('하나에만 꽂힌다'). 기타 색은 이름을 붙일 수 없어 뺀다
  const fav = colors.find((x) => x.name !== '검정' && x.name !== '기타')
  const isType = (...ts: ClothingType[]) => (c: ClothesForAnalysis) => ts.includes(c.type)
  const SUMMER = isType('SHORT_SLEEVE', 'SHORT_SLEEVE_SHIRT', 'SHORTS')
  const SPRING = isType('LONG_SLEEVE', 'SHIRT', 'SWEATSHIRT', 'KNIT', 'HOODIE')
  const LIGHT = isType('WINDBREAKER', 'JACKET', 'CARDIGAN')
  const HEAVY = isType('COAT', 'PADDING')
  const seasons = [SUMMER, SPRING, LIGHT, HEAVY].filter((f) => clothes.some(f)).length

  const score: Record<Exclude<TitleKey, 'BALANCED'>, number> = {
    DARK_CHILD: frac((c) => has(c, 'BLACK')) / 0.5,
    MINIMALIST: Math.min(frac((c) => has(c, 'BLACK', 'GRAY', 'WHITE')) / 0.8, frac((c) => c.pattern === 'SOLID') / 0.8),
    PATTERN_MASTER: frac((c) => c.pattern !== 'SOLID') / 0.4,
    PASTEL_FAIRY: frac((c) => has(c, 'PINK', 'SKYBLUE', 'BEIGE')) / 0.4,
    HOODIE_ADDICT: hoodie >= 3 ? hoodie / n / 0.25 : 0,
    WARM_BEAR: frac((c) => ['KNIT', 'PADDING', 'COAT'].includes(c.type)) / 0.35,
    TEE_ONLY: frac(SUMMER) / 0.5,
    OUTER_FAN: frac((c) => ['WINDBREAKER', 'JACKET', 'CARDIGAN', 'COAT', 'PADDING'].includes(c.type)) / 0.4,
    SHIRT_GENTLE: shirts >= 3 ? shirts / n / 0.25 : 0,
    SKIRT_LOVER: skirts >= 2 ? skirts / n / 0.2 : 0,
    EARTH_TONE: frac((c) => has(c, 'BEIGE', 'BROWN', 'KHAKI')) / 0.5,
    BLUE_SEA: frac((c) => has(c, 'BLUE', 'NAVY', 'SKYBLUE')) / 0.5,
    VITAMIN: frac((c) => has(c, 'RED', 'ORANGE', 'YELLOW')) / 0.4,
    RAINBOW: Math.min(distinctColors / 6, 0.3 / maxColorShare),
    COLOR_LOVER: fav && fav.count >= 3 ? fav.share / 0.5 : 0,
    // 다른 칭호와 같이 맞으면 그쪽이 먼저다(점수 1로 고정)
    ALL_SEASON: n >= 8 && seasons === 4 ? 1 : 0,
  }
  // 조건을 만족한 칭호를 점수 순으로(같으면 목록 앞쪽 먼저)
  const passed = TITLES.filter((t) => t.key !== 'BALANCED' && score[t.key as keyof typeof score] >= 1)
    .map((t, i) => ({ t, s: score[t.key as keyof typeof score], i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
  const best = passed[0]?.t.key ?? 'BALANCED'
  const bestScore = passed[0]?.s ?? 0
  // '하나에만 꽂힌다'는 한 줄 소개에 실제 색을 넣는다 (예: 초록 아니면 안 돼)
  const named = (t: TitleDef): TitleDef => (t.key === 'COLOR_LOVER' && fav ? { ...t, tagline: `${fav.name} 아니면 안 돼` } : t)

  // 다음 칭호 힌트: 비율로 받는 칭호 중, 그 옷을 몇 벌 더 담으면 조건을 채우는지. 가장 적게 담아도 되는 칭호를 고른다.
  const HINTS: { key: TitleKey; pred: (c: ClothesForAnalysis) => boolean; thr: number; min?: number; what: string }[] = [
    { key: 'DARK_CHILD', pred: (c) => has(c, 'BLACK'), thr: 0.5, what: '검정 옷' },
    { key: 'PATTERN_MASTER', pred: (c) => c.pattern !== 'SOLID', thr: 0.4, what: '무늬 있는 옷(체크·줄무늬·도트·프린트)' },
    { key: 'PASTEL_FAIRY', pred: (c) => has(c, 'PINK', 'SKYBLUE', 'BEIGE'), thr: 0.4, what: '분홍·하늘색·베이지 옷' },
    { key: 'HOODIE_ADDICT', pred: isType('HOODIE'), thr: 0.25, min: 3, what: '후드티' },
    { key: 'WARM_BEAR', pred: isType('KNIT', 'PADDING', 'COAT'), thr: 0.35, what: '니트·패딩·코트' },
    { key: 'TEE_ONLY', pred: SUMMER, thr: 0.5, what: '반팔·반바지' },
    { key: 'OUTER_FAN', pred: isType('WINDBREAKER', 'JACKET', 'CARDIGAN', 'COAT', 'PADDING'), thr: 0.4, what: '겉옷' },
    { key: 'SHIRT_GENTLE', pred: isType('SHIRT', 'SHORT_SLEEVE_SHIRT'), thr: 0.25, min: 3, what: '셔츠' },
    { key: 'SKIRT_LOVER', pred: isType('SKIRT'), thr: 0.2, min: 2, what: '치마' },
    { key: 'EARTH_TONE', pred: (c) => has(c, 'BEIGE', 'BROWN', 'KHAKI'), thr: 0.5, what: '베이지·갈색·카키 옷' },
    { key: 'BLUE_SEA', pred: (c) => has(c, 'BLUE', 'NAVY', 'SKYBLUE'), thr: 0.5, what: '파랑·네이비·하늘색 옷' },
    { key: 'VITAMIN', pred: (c) => has(c, 'RED', 'ORANGE', 'YELLOW'), thr: 0.4, what: '빨강·주황·노랑 옷' },
  ]
  const MAX_HINT = 3 // 이보다 많이 담아야 하면 힌트로 보여주지 않는다
  let next: Analysis['next'] = null
  if (ready) {
    for (const h of HINTS) {
      if (h.key === best || passed.some((p) => p.t.key === h.key)) continue
      const m = countOf(h.pred)
      // (m + k) / (n + k) >= thr 이고 m + k >= min 인 가장 작은 k
      const k = Math.max(Math.ceil((h.thr * n - m) / (1 - h.thr) - 1e-9), (h.min ?? 0) - m, 0)
      if (k >= 1 && k <= MAX_HINT && (!next || k < next.more)) next = { title: titleOf(h.key), more: k, what: h.what }
    }
  }
  const sub = passed.find((p) => p.t.key !== best)?.t ?? null
  return {
    count: n,
    ready,
    need: Math.max(0, MIN_CLOTHES - n),
    title: ready ? named(titleOf(best)) : null,
    strength: Math.round(bestScore * 100) / 100,
    subTitle: ready && sub ? named(sub) : null,
    next,
    colors,
    types,
    patterns,
  }
}
