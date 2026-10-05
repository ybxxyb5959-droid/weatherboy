// Mock: 이후 GET/POST /api/events 로 교체
export type EventKind = '여행' | '캠핑' | '등산' | '야외활동' | '기타'
export type EventStatus = 'waiting' | 'ready'

export interface PlanEvent {
  id: string
  title: string
  startDate: string // YYYY-MM-DD
  endDate?: string
  place: string
  startTime: string
  endTime: string
  kind: EventKind
  status: EventStatus
  /** 외부 캘린더에서 가져온 일정 */
  imported?: boolean
  /** false 면 옷차림 대신 그날 날씨만 보여준다(기타 종류는 항상 false). 예전 응답에는 없을 수 있다 */
  needsOutfit?: boolean
  /** 장소의 위치(날씨 지역)를 찾았는가. false 면 내 기본 지역 날씨로 보여준다 */
  locationResolved?: boolean
}

/** 옷차림 추천이 필요한 종류(여행·캠핑·등산·야외활동). 기타는 날씨만 알려준다 */
export const outfitKinds: EventKind[] = ['여행', '캠핑', '등산', '야외활동']

export const eventKinds: EventKind[] = ['여행', '캠핑', '등산', '야외활동', '기타']

export const initialEvents: PlanEvent[] = [
  {
    id: 'jeju',
    title: '제주 여행',
    startDate: '2026-10-18',
    endDate: '2026-10-20',
    place: '제주도',
    startTime: '09:00',
    endTime: '20:00',
    kind: '여행',
    status: 'waiting',
  },
  {
    id: 'camping',
    title: '캠핑',
    startDate: '2026-10-26',
    place: '가평',
    startTime: '10:00',
    endTime: '18:00',
    kind: '캠핑',
    status: 'ready',
  },
]

export const statusLabel: Record<EventStatus, string> = {
  waiting: '날씨 대기중',
  ready: '옷차림 생성됨',
}

export function formatDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${m}월 ${d}일`
}

export function formatRange(e: PlanEvent): string {
  if (!e.endDate || e.endDate === e.startDate) return formatDay(e.startDate)
  const sameMonth = e.endDate.slice(5, 7) === e.startDate.slice(5, 7)
  const end = sameMonth ? `${Number(e.endDate.slice(8))}일` : formatDay(e.endDate)
  return `${formatDay(e.startDate)}~${end}`
}

export function dDay(iso: string, today = new Date()): number {
  const t = new Date(iso + 'T00:00:00')
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((t.getTime() - base.getTime()) / 86400000)
}
