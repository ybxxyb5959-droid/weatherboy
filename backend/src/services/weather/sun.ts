// 해가 떠 있는지 계산한다(외부 API 없이 날짜·위치로 태양 고도를 구하는 천문 공식).
// 정확도는 일출·일몰 시각 기준 1~2분 안팎이면 충분하다(옷차림 그림을 낮/밤으로 가르는 용도).
const RAD = Math.PI / 180

/** 태양의 고도(도). 지평선 위면 양수. 날짜는 UTC 기준 시각 그대로, 경도는 동경이 양수. */
export function solarElevation(at: Date, lat: number, lng: number): number {
  const n = at.getTime() / 86_400_000 + 2440587.5 - 2451545.0 // J2000 기준 일수
  const L = (280.46 + 0.9856474 * n) % 360 // 평균 황경
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD // 평균 근점이각
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD // 황경
  const eps = (23.439 - 0.0000004 * n) * RAD // 황도 경사
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda)) // 적위
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) // 적경
  const gmstHours = (18.697374558 + 24.06570982441908 * n) % 24
  const hourAngle = (gmstHours * 15 + lng) * RAD - ra
  const sinEl = Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(hourAngle)
  return Math.asin(sinEl) / RAD
}

/** 일출·일몰의 기준: 태양 윗부분이 지평선에 걸릴 때(대기 굴절 포함) 고도 -0.833° */
export const SUNRISE_SUNSET_ELEVATION = -0.833

/** 그 시각에 해가 졌는가(일몰~일출 사이) */
export function isNightAt(at: Date, lat: number, lng: number): boolean {
  return solarElevation(at, lat, lng) < SUNRISE_SUNSET_ELEVATION
}
