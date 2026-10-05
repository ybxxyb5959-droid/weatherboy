import type { Mood } from '../components/StickPerson'
import type { EventKind } from '../mocks/events'

// '기타' 일정은 제목/장소에 들어 있는 말로 장면을 고른다. AI 없이 키워드 사전으로만 정해서 빠르고, 같은 제목이면 항상 같은 그림이다.
// 위에 있는 장면이 먼저다: "생일 저녁 약속"은 생일, "회식 저녁"은 회식, "팬미팅"은 미팅(일)이 아니라 공연.
const OTHER_SCENES: [Mood, string[]][] = [
  ['birthday', ['생일', '생파', '생신', '탄신', '버스데이', 'birthday']],
  ['gift', ['결혼식', '웨딩', '돌잔치', '돌잔', '백일잔치', '집들이', '선물', '환갑', '칠순', '축하']],
  ['date', ['데이트', '소개팅', '기념일', '주년', '프러포즈', '프로포즈', '여자친구', '남자친구', '여친', '남친']],
  ['drink', ['회식', '술자리', '술약속', '한잔', '호프', '맥주', '와인', '소주', '뒤풀이', '송년회', '신년회', '망년회', '포차', '이자카야', '파티']],
  ['show', ['공연', '콘서트', '영화', '뮤지컬', '연극', '전시', '페스티벌', '축제', '팬미팅', '미술관', '박물관', '팝업']],
  ['run', ['러닝', '런닝', '달리기', '조깅', '마라톤', '러너', '러닝크루', '트레일런', '10km', '5km', '10k']],
  ['sport', ['운동', '헬스', '축구', '풋살', '농구', '야구', '테니스', '자전거', '라이딩', '배드민턴', '골프', '수영', '요가', '필라테스', '볼링', '클라이밍', '스키', '스노보드']],
  ['meal', ['저녁', '점심', '아침', '식사', '밥', '맛집', '브런치', '카페', '모임', '동창회', '레스토랑', '고기', '외식', '약속']],
  ['work', ['회의', '미팅', '면접', '출근', '출장', '수업', '시험', '학교', '강의', '세미나', '워크숍', '워크샵', '발표', '학원', '교육', '컨퍼런스']],
]

/** 기타 일정의 제목(과 장소)에서 장면을 찾는다. 못 찾으면 null */
export function otherScene(text: string): Mood | null {
  const t = text.toLowerCase().replace(/\s+/g, '')
  for (const [mood, words] of OTHER_SCENES) if (words.some((w) => t.includes(w))) return mood
  return null
}

/** 일정 종류별 졸라맨 그림. 기타는 제목에 맞는 장면, 없으면 예보 준비 상태에 따라 기본 그림. */
export function eventMood(kind: EventKind, waiting: boolean, title = '', place = ''): Mood {
  if (kind === '여행') return 'travel'
  if (kind === '캠핑') return 'camp'
  if (kind === '등산') return 'hike'
  if (kind === '야외활동') return 'outdoor'
  return otherScene(`${title} ${place}`) ?? (waiting ? 'wait' : 'trip')
}

/** 장면이 큰 그림은 카드에서 조금 크게 보여준다 */
export const isSceneMood = (m: Mood) =>
  m === 'travel' || m === 'camp' || m === 'hike' || m === 'outdoor' || m === 'birthday' || m === 'meal' || m === 'show' || m === 'sport' || m === 'run'
