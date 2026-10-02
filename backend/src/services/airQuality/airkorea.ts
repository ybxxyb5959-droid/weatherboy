// 한국환경공단 에어코리아 대기오염정보 (공공데이터포털)
//   GET https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty  (시도별 실시간 측정정보)
//   요청: serviceKey, returnType=json, numOfRows, pageNo, sidoName(서울,부산,...,제주,세종), ver=1.3
//   응답: response.body.items[]: stationName, dataTime, pm10Value, pm25Value, pm10Grade/pm25Grade(24시간 등급), pm10Grade1h/pm25Grade1h(1시간 등급) (1좋음 2보통 3나쁨 4매우나쁨), 결측은 "-" 또는 null
//   현재 시점 판단이므로 1시간 등급을 우선 사용하고, 없으면 24시간 등급을 쓴다.
//
// !! 공식 활용가이드 기준 작성. 실제 서비스키로 호출 검증하지 않았다 (AIRKOREA_SERVICE_KEY 필요).
import { env } from '../../config/env.js'
import { AppError } from '../../utils/errors.js'
import type { AirQualityProvider, AirQualityReading } from '../weather/types.js'

const URL_BASE = 'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty'

interface Row {
  stationName?: string
  pm10Value?: string | null
  pm25Value?: string | null
  pm10Grade?: string | null
  pm25Grade?: string | null
  pm10Grade1h?: string | null
  pm25Grade1h?: string | null
}

const num = (v: string | null | undefined): number | null => {
  if (v == null || v === '-' || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** 에어코리아 통합 기준(환경부 고시): PM10 30/80/150, PM2.5 15/35/75. API 등급이 없을 때만 사용. */
export const pm10GradeOf = (v: number) => (v <= 30 ? 1 : v <= 80 ? 2 : v <= 150 ? 3 : 4)
export const pm25GradeOf = (v: number) => (v <= 15 ? 1 : v <= 35 ? 2 : v <= 75 ? 3 : 4)

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2)
}

export function pickReading(rows: Row[], sido: string, district: string | null): AirQualityReading {
  const matched = district ? rows.filter((r) => r.stationName && district.startsWith(r.stationName.replace(/\s/g, ''))) : []
  const use = matched.length > 0 ? matched : rows
  const pm10 = median(use.map((r) => num(r.pm10Value)).filter((n): n is number => n != null))
  const pm25 = median(use.map((r) => num(r.pm25Value)).filter((n): n is number => n != null))
  const g10 = median(use.map((r) => num(r.pm10Grade1h ?? r.pm10Grade)).filter((n): n is number => n != null))
  const g25 = median(use.map((r) => num(r.pm25Grade1h ?? r.pm25Grade)).filter((n): n is number => n != null))
  return {
    region: sido,
    stationName: matched.length > 0 ? (matched[0]!.stationName ?? null) : null,
    pm10,
    pm25,
    pm10Grade: g10 ?? (pm10 != null ? pm10GradeOf(pm10) : null),
    pm25Grade: g25 ?? (pm25 != null ? pm25GradeOf(pm25) : null),
  }
}

export class AirKoreaProvider implements AirQualityProvider {
  constructor(private fetchImpl: typeof fetch = fetch) {}
  get configured() {
    return !!env.AIRKOREA_SERVICE_KEY
  }

  async fetch(regionSido: string, regionDistrict: string | null): Promise<AirQualityReading> {
    if (!this.configured) throw new AppError(503, 'AIR_NOT_CONFIGURED', '미세먼지 서비스가 설정되지 않았어요.')
    let key = env.AIRKOREA_SERVICE_KEY
    try {
      key = decodeURIComponent(key)
    } catch {
      /* keep */
    }
    const q = new URLSearchParams({ serviceKey: key, returnType: 'json', numOfRows: '200', pageNo: '1', sidoName: regionSido, ver: '1.3' })
    // 에어코리아는 평소 0.3초 안팎이지만 가끔 수십 초 멈춘다 -> 짧은 타임아웃 + 1회 재시도
    let json: { response?: { header?: { resultCode?: string }; body?: { items?: Row[] } } } | null = null
    let lastStatus = 0
    for (let attempt = 1; attempt <= 2 && !json; attempt++) {
      try {
        const res = await this.fetchImpl(`${URL_BASE}?${q}`, { signal: AbortSignal.timeout(4_000) })
        lastStatus = res.status
        json = JSON.parse(await res.text())
      } catch {
        json = null
      }
    }
    if (!json) throw new AppError(502, 'AIR_UPSTREAM_ERROR', `에어코리아 응답 오류(HTTP ${lastStatus || 'timeout'})`)
    if (json.response?.header?.resultCode !== '00') throw new AppError(502, 'AIR_UPSTREAM_ERROR', `에어코리아 응답 오류(${json.response?.header?.resultCode ?? 'unknown'})`)
    const rows = json.response?.body?.items ?? []
    if (rows.length === 0) throw new AppError(502, 'AIR_UPSTREAM_ERROR', '에어코리아 데이터가 비어 있어요.')
    return pickReading(rows, regionSido, regionDistrict)
  }
}
