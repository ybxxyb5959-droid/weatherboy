import type { ApiWeather } from '../types'

/**
 * 지금 기온 추정: 기상청 실측은 정시에만 나오므로, 마지막 정시 관측값에서 다음 예보 칸의 기온으로 시간에 따라 이어서 짐작한다.
 * 실측이 아니라 추정이라 화면에 "추정"을 붙인다. 관측 시각이 너무 오래됐거나 예보 칸이 없으면 null(관측값 그대로).
 */
export function estimateTemp(w: Pick<ApiWeather, 'temp' | 'observedAt' | 'hourly'>, nowMs: number): number | null {
  if (!w.observedAt || !w.hourly?.length) return null
  const t0 = new Date(w.observedAt).getTime()
  if (nowMs <= t0 + 60_000 || nowMs - t0 > 100 * 60_000) return null
  const next = w.hourly.find((h) => new Date(h.time).getTime() >= t0 + 30 * 60_000)
  if (!next) return null
  const t1 = new Date(next.time).getTime()
  const frac = Math.min(1, Math.max(0, (nowMs - t0) / (t1 - t0)))
  const est = Math.round((w.temp + (next.temp - w.temp) * frac) * 10) / 10
  return Math.abs(est - w.temp) < 0.1 ? null : est
}
