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
}

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
