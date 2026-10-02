// 옷장에 없는 옷(일반 추천)은 서버가 색을 정하지 않는다('기타'). 화면에서는 다 같은 주황으로 보이지 않도록
// 옷마다 다른 색을 뽑아 보여준다. 같은 날·같은 옷 종류는 항상 같은 색이라 화면이 다시 그려져도 바뀌지 않는다.
import { categories } from '../mocks/clothes'

const TOP_COLORS = ['흰색', '하늘색', '분홍', '베이지', '회색', '초록', '파랑', '노랑', '네이비', '카키', '빨강', '보라']
const BOTTOM_COLORS = ['검정', '네이비', '회색', '베이지', '카키', '파랑', '갈색']
const OUTER_COLORS = ['베이지', '카키', '네이비', '검정', '회색', '갈색', '초록']

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function genericColor(type: string, day: string): string {
  const pool = categories[1]!.types.includes(type) ? BOTTOM_COLORS : categories[2]!.types.includes(type) ? OUTER_COLORS : TOP_COLORS
  return pool[hash(`${day}|${type}`) % pool.length]!
}
