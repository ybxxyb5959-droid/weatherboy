// 기상청 공식 체감온도. 여름철(5~9월): 습구온도(Stull) 기반, 겨울철(10~4월): 기온 10℃ 이하 & 풍속 1.3m/s 이상일 때만 산출.
// 조건 미충족/데이터 부족 시 기온을 fallback으로 사용하고 method 로 알린다.
export interface FeelsInput {
  tempC: number
  windMs?: number | null
  humidity?: number | null
  month: number // 1-12 (KST)
}
export interface FeelsResult {
  feels: number
  method: 'SUMMER_STULL' | 'WINTER_WINDCHILL' | 'FALLBACK_TEMP'
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function feelsLike({ tempC, windMs, humidity, month }: FeelsInput): FeelsResult {
  const summer = month >= 5 && month <= 9
  if (summer) {
    if (humidity == null) return { feels: tempC, method: 'FALLBACK_TEMP' }
    const rh = humidity
    const tw =
      tempC * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
      Math.atan(tempC + rh) -
      Math.atan(rh - 1.676331) +
      0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
      4.686035
    const feels = -0.2442 + 0.55399 * tw + 0.45535 * tempC - 0.0022 * tw * tw + 0.00278 * tw * tempC + 3.0
    return { feels: round1(feels), method: 'SUMMER_STULL' }
  }
  if (tempC <= 10 && windMs != null && windMs >= 1.3) {
    const v = Math.pow(windMs * 3.6, 0.16) // km/h
    const feels = 13.12 + 0.6215 * tempC - 11.37 * v + 0.3965 * v * tempC
    return { feels: round1(feels), method: 'WINTER_WINDCHILL' }
  }
  return { feels: tempC, method: 'FALLBACK_TEMP' }
}
