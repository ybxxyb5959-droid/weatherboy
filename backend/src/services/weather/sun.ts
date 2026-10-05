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

/** 그 날(KST)의 일출·일몰 시각(KST HH:MM). 1분 간격으로 태양 고도가 지평선(-0.833°)을 넘는 때를 찾는다. 백야·극야처럼 뜨거나 지지 않는 날은 null */
export function sunTimes(kstYmd: string, lat: number, lng: number): { rise: string; set: string } | null {
  const start = new Date(`${kstYmd}T00:00:00+09:00`).getTime()
  const hm = (ms: number) => {
    const k = new Date(ms + 9 * 3600_000)
    return `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`
  }
  let rise: string | null = null
  let set: string | null = null
  let prev = solarElevation(new Date(start), lat, lng) >= SUNRISE_SUNSET_ELEVATION
  for (let m = 1; m < 1440; m++) {
    const t = start + m * 60_000
    const up = solarElevation(new Date(t), lat, lng) >= SUNRISE_SUNSET_ELEVATION
    if (up && !prev && !rise) rise = hm(t)
    if (!up && prev && !set) set = hm(t)
    prev = up
  }
  return rise && set ? { rise, set } : null
}

/** 그 시각에 해가 졌는가(일몰~일출 사이) */
export function isNightAt(at: Date, lat: number, lng: number): boolean {
  return solarElevation(at, lat, lng) < SUNRISE_SUNSET_ELEVATION
}
