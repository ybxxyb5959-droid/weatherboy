import type { ClothingColor, ClothingPattern, ClothingType } from '@prisma/client'
import { clothingTypeMap, colorMap, patternMap } from '../../config/mappings.js'

/** 칭호가 붙으려면 직접 담은 옷이 이만큼은 있어야 한다 (한두 벌로 "어둠의 아이"가 되지 않게) */
export const MIN_CLOTHES = 5

export type TitleKey = 'DARK_CHILD' | 'MINIMALIST' | 'PATTERN_MASTER' | 'PASTEL_FAIRY' | 'HOODIE_ADDICT' | 'WARM_BEAR' | 'TEE_ONLY' | 'BALANCED'

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
  if (n === 0) return { count: 0, ready: false, need: MIN_CLOTHES, title: null, strength: 0, colors, types, patterns }

  const frac = (pred: (c: ClothesForAnalysis) => boolean) => clothes.filter(pred).length / n
  const has = (c: ClothesForAnalysis, ...colorsIn: ClothingColor[]) => colorsIn.includes(c.color)
  const hoodie = clothes.filter((c) => c.type === 'HOODIE').length

  const score: Record<Exclude<TitleKey, 'BALANCED'>, number> = {
    DARK_CHILD: frac((c) => has(c, 'BLACK')) / 0.5,
    MINIMALIST: Math.min(frac((c) => has(c, 'BLACK', 'GRAY', 'WHITE')) / 0.8, frac((c) => c.pattern === 'SOLID') / 0.8),
    PATTERN_MASTER: frac((c) => c.pattern !== 'SOLID') / 0.4,
    PASTEL_FAIRY: frac((c) => has(c, 'PINK', 'SKYBLUE', 'BEIGE')) / 0.4,
    HOODIE_ADDICT: hoodie >= 3 ? hoodie / n / 0.25 : 0,
    WARM_BEAR: frac((c) => ['KNIT', 'PADDING', 'COAT'].includes(c.type)) / 0.35,
    TEE_ONLY: frac((c) => ['SHORT_SLEEVE', 'SHORTS'].includes(c.type)) / 0.5,
  }
  let best: TitleKey = 'BALANCED'
  let bestScore = 0
  for (const t of TITLES) {
    if (t.key === 'BALANCED') continue
    const s = score[t.key as keyof typeof score]
    if (s >= 1 && s > bestScore) {
      best = t.key
      bestScore = s
    }
  }
  return { count: n, ready, need: Math.max(0, MIN_CLOTHES - n), title: ready ? titleOf(best) : null, strength: Math.round(bestScore * 100) / 100, colors, types, patterns }
}
