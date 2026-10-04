// 관리자용 AI 사용 현황: 호출 기록(aiCallLog)을 하루/종류별로 모아 보여주기 좋은 모양으로 만든다.
import { kstDate } from '../../utils/time.js'

export interface UsageRow {
  /** KST 날짜(YYYY-MM-DD) */
  d: string
  /** photo | text | explain | null(요청 밖 호출, 예전 기록) */
  kind: string | null
  status: 'SUCCESS' | 'FAILED'
  c: number
  avgMs: number | null
}

export interface DayUsage {
  date: string
  photo: number
  text: number
  /** 추천 설명을 AI 로 만든 호출(자동) */
  explain: number
  other: number
  total: number
  failed: number
}

/** 최근 days 일(오늘 포함)을 날짜순으로 채운다. 기록이 없는 날은 0. */
export function buildDays(rows: UsageRow[], days: number, now = new Date()): DayUsage[] {
  const out: DayUsage[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = kstDate(new Date(now.getTime() - i * 86400_000))
    out.push({ date, photo: 0, text: 0, explain: 0, other: 0, total: 0, failed: 0 })
  }
  const byDate = new Map(out.map((d) => [d.date, d]))
  for (const r of rows) {
    const day = byDate.get(r.d)
    if (!day) continue
    if (r.kind === 'photo') day.photo += r.c
    else if (r.kind === 'text') day.text += r.c
    else if (r.kind === 'explain') day.explain += r.c
    else day.other += r.c
    day.total += r.c
    if (r.status === 'FAILED') day.failed += r.c
  }
  return out
}

/** 종류별 평균 응답 시간(ms). 기록이 없으면 null. 건수로 가중 평균한다. */
export function avgMsByKind(rows: UsageRow[]): { photo: number | null; text: number | null } {
  const calc = (kind: string) => {
    const rs = rows.filter((r) => r.kind === kind && r.avgMs != null)
    const n = rs.reduce((a, r) => a + r.c, 0)
    return n ? Math.round(rs.reduce((a, r) => a + r.avgMs! * r.c, 0) / n) : null
  }
  return { photo: calc('photo'), text: calc('text') }
}

/** 실패 비율(%). 호출이 없으면 null */
export const failureRate = (days: DayUsage[]): number | null => {
  const total = days.reduce((a, d) => a + d.total, 0)
  return total ? Math.round((days.reduce((a, d) => a + d.failed, 0) / total) * 1000) / 10 : null
}
