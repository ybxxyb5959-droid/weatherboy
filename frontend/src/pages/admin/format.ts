// ───── 표시 도우미 ─────
export const KIND_LABEL = { BUG: '불편·오류', IDEA: '제안', OTHER: '기타' } as const
export const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n)
export const fmtDate = (iso: string | null) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export const fmtDay = (iso: string | null) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
export const ago = (iso: string | null, now = Date.now()) => {
  if (!iso) return '-'
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  if (m < 60 * 24) return `${Math.round(m / 60)}시간 전`
  return `${Math.round(m / 1440)}일 전`
}
export const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 1000) / 10}%` : '-')
export const secs = (ms: number | null) => (ms == null ? '-' : `${(ms / 1000).toFixed(1)}초`)
export const uptime = (s: number) => (s < 3600 ? `${Math.round(s / 60)}분` : s < 86400 ? `${Math.round(s / 3600)}시간` : `${Math.round(s / 86400)}일`)
export const KIND_NAME: Record<string, string> = { MORNING: '아침 옷차림', RAIN: '비·우산', COLD_RETURN: '귀가 추위', DUST: '미세먼지', FEEDBACK: '후기 요청', CLOSET: '옷장 리마인드', NOTICE: '공지', EVENT_FIRST: '일정 첫 알림', EVENT_CHANGE: '예보 변경', EVENT: '일정', TEST: '알림 시험' }

/** 최근 N일을 한국 날짜로 채워서(없는 날은 0) 돌려준다 */
export function padDays(rows: { d: string; v: number }[], n: number) {
  const by = new Map(rows.map((r) => [r.d, r.v]))
  const kst = Date.now() + 9 * 3600_000
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(kst - (n - 1 - i) * 86400_000).toISOString().slice(0, 10)
    return { d, v: by.get(d) ?? 0 }
  })
}
