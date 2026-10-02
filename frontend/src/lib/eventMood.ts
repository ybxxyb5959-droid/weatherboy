import type { Mood } from '../components/StickPerson'
import type { EventKind } from '../mocks/events'

/** 일정 종류별 졸라맨 그림. 기타는 예보 준비 상태에 따라 기본 그림. */
export function eventMood(kind: EventKind, waiting: boolean): Mood {
  if (kind === '여행') return 'travel'
  if (kind === '캠핑') return 'camp'
  if (kind === '등산') return 'hike'
  if (kind === '야외활동') return 'outdoor'
  return waiting ? 'wait' : 'trip'
}

/** 장면이 큰 그림은 카드에서 조금 크게 보여준다 */
export const isSceneMood = (m: Mood) => m === 'travel' || m === 'camp' || m === 'hike' || m === 'outdoor'
