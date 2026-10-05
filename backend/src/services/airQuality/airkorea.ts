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

const FORECAST_URL = 'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMinuDustFrcstDspth'

// 예보통보 권역: 대부분 시도 이름과 같고, 경기는 남부/북부, 강원은 영동/영서로 나뉜다(구·시 이름으로 가른다. 대략적인 구분)
const GYEONGGI_NORTH = ['의정부', '양주', '동두천', '포천', '연천', '파주', '고양', '남양주', '가평', '구리']
const GANGWON_EAST = ['강릉', '동해', '속초', '삼척', '태백', '고성', '양양']
export function forecastAreaOf(sido: string, district: string | null): string {
  const d = (district ?? '').replace(/s/g, '')
  if (sido === '경기') return GYEONGGI_NORTH.some((n) => d.startsWith(n)) ? '경기북부' : '경기남부'
  if (sido === '강원') return GANGWON_EAST.some((n) => d.startsWith(n)) ? '영동' : '영서'
  return sido
}

const GRADE_OF_TEXT: Record<string, number> = { 좋음: 1, 보통: 2, 나쁨: 3, '매우나쁨': 4 }

interface ForecastRow {
  informData?: string
  informGrade?: string
  dataTime?: string
}

/** 예보통보 여러 건(발표 시각이 다른 같은 날짜 포함)에서 날짜별로 가장 늦게 발표된 것의 해당 권역 등급을 뽑는다 */
export function forecastGrades(rows: ForecastRow[], area: string): Record<string, number> {
  const latest = new Map<string, ForecastRow>()
  for (const r of rows) {
    if (!r.informData || !r.informGrade) continue
    const cur = latest.get(r.informData)
    if (!cur || (r.dataTime ?? '') > (cur.dataTime ?? '')) latest.set(r.informData, r)
  }
  const out: Record<string, number> = {}
  for (const [date, r] of latest) {
    const m = r.informGrade!.split(',').map((x) => x.split(':').map((y) => y.trim())).find(([k]) => k === area)
    const g = m?.[1] ? GRADE_OF_TEXT[m[1].replace(/s/g, '')] : undefined
    if (g) out[date] = g
  }
  return out
}

export class AirKoreaProvider implements AirQualityProvider {
  constructor(private fetchImpl: typeof fetch = fetch) {}
  get configured() {
    return !!env.AIRKOREA_SERVICE_KEY
  }

  /** 오늘 이후 날짜별 예보 등급. 초미세먼지(PM25)·미세먼지(PM10) 중 나쁜 쪽. 실패하면 던진다(부르는 쪽이 비어 있는 것으로 본다) */
  async fetchForecast(regionSido: string, regionDistrict: string | null): Promise<Record<string, number>> {
    if (!this.configured) throw new AppError(503, 'AIR_NOT_CONFIGURED', '미세먼지 서비스가 설정되지 않았어요.')
    let key = env.AIRKOREA_SERVICE_KEY
    try {
      key = decodeURIComponent(key)
    } catch {
      /* keep */
    }
    const searchDate = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
    const area = forecastAreaOf(regionSido, regionDistrict)
    const one = async (informCode: 'PM10' | 'PM25') => {
      const q = new URLSearchParams({ serviceKey: key, returnType: 'json', numOfRows: '20', pageNo: '1', searchDate, informCode })
      const res = await this.fetchImpl(`${FORECAST_URL}?${q}`, { signal: AbortSignal.timeout(4_000) })
      const json = JSON.parse(await res.text()) as { response?: { header?: { resultCode?: string }; body?: { items?: ForecastRow[] } } }
      if (json.response?.header?.resultCode !== '00') throw new AppError(502, 'AIR_UPSTREAM_ERROR', '에어코리아 예보 응답 오류')
      return forecastGrades(json.response?.body?.items ?? [], area)
    }
    const [a, b] = await Promise.all([one('PM10'), one('PM25')])
    const out: Record<string, number> = { ...a }
    for (const [d, g] of Object.entries(b)) out[d] = Math.max(out[d] ?? 0, g)
    return out
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
