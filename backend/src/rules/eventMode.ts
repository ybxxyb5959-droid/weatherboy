import type { EventKind } from '@prisma/client'

/**
 * 일정에서 무엇을 보여줄까.
 *  - outfit:   옷차림 추천 (여행·캠핑, 그리고 활동이 아닌 야외 일정)
 *  - activity: 야외활동 점수 (러닝·축구·등산처럼 기능성 운동복을 입고 하는 야외 활동. 옷 추천은 하지 않는다)
 *  - weather:  그날 날씨만 (기타)
 * 종류가 같아도 제목으로 갈린다: 야외활동 "러닝" 은 점수, "소풍" 은 옷차림. 기타 "조깅" 은 점수, "회식" 은 날씨만.
 */
export type EventMode = 'outfit' | 'activity' | 'weather'

// 야외에서 몸을 쓰는 활동의 제목 말들 (헬스·요가·수영처럼 실내에서 하는 운동은 일부러 뺀다)
const OUTDOOR_ACTIVITY_WORDS = [
  '러닝', '런닝', '달리기', '조깅', '마라톤', '러너', '러닝크루', '트레일런', '10km', '5km', '10k',
  '축구', '풋살', '야구', '농구', '테니스', '배드민턴', '골프', '족구', '킥볼', '피구', '럭비', '크리켓',
  '자전거', '라이딩', '사이클', '킥보드',
  '등산', '산행', '트레킹', '하이킹', '둘레길', '올레길', '종주', '암벽', '클라이밍', '트래킹',
  '서핑', '패들보드', '카약', '카누', '래프팅', '낚시', '스키', '스노보드',
]

export const isOutdoorActivityTitle = (title: string): boolean => {
  const t = title.toLowerCase().replace(/\s+/g, '')
  return OUTDOOR_ACTIVITY_WORDS.some((w) => t.includes(w))
}

export function eventModeOf(kind: EventKind, title: string): EventMode {
  if (kind === 'TRAVEL' || kind === 'CAMPING') return 'outfit'
  if (kind === 'HIKING') return 'activity' // 등산은 종류 자체가 활동
  if (kind === 'OUTDOOR') return isOutdoorActivityTitle(title) ? 'activity' : 'outfit'
  return isOutdoorActivityTitle(title) ? 'activity' : 'weather' // 기타(예전 값 포함)
}
