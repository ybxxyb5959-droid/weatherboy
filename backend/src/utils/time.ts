// 서비스 표시 기준: Asia/Seoul (UTC+9, DST 없음). DB는 UTC.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

export function toKstParts(d: Date) {
  const k = new Date(d.getTime() + KST_OFFSET_MS)
  return {
    year: k.getUTCFullYear(),
    month: k.getUTCMonth() + 1,
    day: k.getUTCDate(),
    hour: k.getUTCHours(),
    minute: k.getUTCMinutes(),
  }
}

const p2 = (n: number) => String(n).padStart(2, '0')

export const kstDate = (d: Date) => {
  const t = toKstParts(d)
  return `${t.year}-${p2(t.month)}-${p2(t.day)}`
}
export const kstTime = (d: Date) => {
  const t = toKstParts(d)
  return `${p2(t.hour)}:${p2(t.minute)}`
}
export const kstYmd = (d: Date) => kstDate(d).replace(/-/g, '')

/** KST 'YYYY-MM-DD' + 'HH:mm' -> UTC Date */
export function fromKst(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!, hh!, mm!) - KST_OFFSET_MS)
}

/** KST 기준 자정 UTC Date */
export const kstStartOfDay = (d: Date) => fromKst(kstDate(d), '00:00')

/** 23:00~07:00 KST 야간 여부 (Push 금지 시간) */
export function isQuietHoursKst(d: Date): boolean {
  const h = toKstParts(d).hour
  return h >= 23 || h < 7
}
