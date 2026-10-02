// 기상청 OpenAPI 어댑터 (공공데이터포털 apis.data.go.kr/1360000)
//
// [단기예보] VilageFcstInfoService_2.0/getVilageFcst
//   요청: serviceKey, pageNo, numOfRows, dataType=JSON, base_date(YYYYMMDD), base_time(HHMM), nx, ny
//   발표시각(base_time): 0200,0500,0800,1100,1400,1700,2000,2300 (각 발표 후 약 10분 뒤부터 조회 가능)
//   응답: response.header.resultCode('00' 정상), response.body.items.item[] { baseDate, baseTime, category, fcstDate, fcstTime, fcstValue, nx, ny }
//   category: POP 강수확률%, PTY 강수형태(0없음 1비 2비/눈 3눈 4소나기), PCP 1시간강수량, REH 습도%, SKY(1맑음 3구름많음 4흐림),
//             TMP 1시간기온℃, TMN 일최저, TMX 일최고, WSD 풍속m/s, UUU/VVV/VEC/SNO/WAV
//
// [중기예보] MidFcstInfoService/getMidTa(기온), getMidLandFcst(육상: 강수확률/날씨)
//   요청: serviceKey, pageNo, numOfRows, dataType=JSON, regId, tmFc(발표시각 YYYYMMDD0600|1800, 최근 24시간만 제공)
//   getMidTa: taMin3..taMax10 (발표일 기준 +3~+10일)
//   getMidLandFcst: rnSt3Am,rnSt3Pm..rnSt7Am,rnSt7Pm, rnSt8..rnSt10 (강수확률), wf3Am..wf7Pm, wf8..wf10 (날씨)
//
// !! 이 파일은 공식 활용가이드 기준으로 작성했으나 실제 서비스키로 호출 검증하지 않았다 (KMA_SERVICE_KEY 필요).
import { env } from '../../config/env.js'
import type { PrecipType } from '../../rules/outfitEngine.js'
import { AppError } from '../../utils/errors.js'
import { fromKst, kstDate, kstYmd, toKstParts } from '../../utils/time.js'
import type { DailyForecast, HourlyForecast, MidTermResult, ShortTermResult, WeatherProvider } from './types.js'

const BASE = 'https://apis.data.go.kr/1360000'
const SHORT_BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23]

/** 중기 육상예보 regId (광역) / 기온 regId (대표 도시). 값은 기상청 중기예보 구역 코드표 기준. */
const MID_LAND: Record<string, string> = {
  서울: '11B00000', 인천: '11B00000', 경기: '11B00000',
  대전: '11C20000', 세종: '11C20000', 충남: '11C20000', 충북: '11C10000',
  광주: '11F20000', 전남: '11F20000', 전북: '11F10000',
  대구: '11H10000', 경북: '11H10000', 부산: '11H20000', 울산: '11H20000', 경남: '11H20000',
  제주: '11G00000', 강원: '11D10000',
}
const MID_TEMP: Record<string, string> = {
  서울: '11B10101', 인천: '11B20201', 경기: '11B20601',
  대전: '11C20401', 세종: '11C20404', 충남: '11C20101', 충북: '11C10301',
  광주: '11F20501', 전남: '11F20401', 전북: '11F10201',
  대구: '11H10701', 경북: '11H10201', 부산: '11H20201', 울산: '11H20101', 경남: '11H20301',
  제주: '11G00201', 강원: '11D10401',
}
// 강원 영동(동해안) 시/군은 육상예보 regId 가 다르다.
const GANGWON_YEONGDONG = ['강릉', '속초', '동해', '삼척', '고성', '양양', '태백']

export function midRegIds(sido: string, district: string | null): { land: string; temp: string } | null {
  const land = MID_LAND[sido]
  const temp = MID_TEMP[sido]
  if (!land || !temp) return null
  if (sido === '강원' && district && GANGWON_YEONGDONG.some((d) => district.startsWith(d))) {
    return { land: '11D20000', temp: '11D20501' }
  }
  if (sido === '강원') return { land: '11D10000', temp: '11D10301' }
  if (sido === '제주' && district?.startsWith('서귀포')) return { land: '11G00000', temp: '11G00401' }
  return { land, temp }
}

/** 현재 시각 기준 조회 가능한 가장 최근 단기예보 발표시각 (발표 +10분 이후) */
export function latestShortBase(now: Date): { baseDate: string; baseTime: string; issuedAt: Date } {
  const shifted = new Date(now.getTime() - 10 * 60_000)
  const k = toKstParts(shifted)
  const eligible = SHORT_BASE_HOURS.filter((h) => h <= k.hour)
  let date = kstDate(shifted)
  let hour: number
  if (eligible.length > 0) {
    hour = eligible[eligible.length - 1]!
  } else {
    hour = 23
    date = kstDate(new Date(shifted.getTime() - 24 * 3600_000))
  }
  const hh = String(hour).padStart(2, '0')
  return { baseDate: date.replace(/-/g, ''), baseTime: `${hh}00`, issuedAt: fromKst(date, `${hh}:00`) }
}

/** 중기예보 발표시각: 06:00 / 18:00 (발표 후 30분 지나서 조회) */
export function latestMidTmFc(now: Date): { tmFc: string; issuedAt: Date } {
  const shifted = new Date(now.getTime() - 30 * 60_000)
  const k = toKstParts(shifted)
  let date = kstDate(shifted)
  let hh: '06' | '18'
  if (k.hour >= 18) hh = '18'
  else if (k.hour >= 6) hh = '06'
  else {
    hh = '18'
    date = kstDate(new Date(shifted.getTime() - 24 * 3600_000))
  }
  return { tmFc: `${date.replace(/-/g, '')}${hh}00`, issuedAt: fromKst(date, `${hh}:00`) }
}

interface Envelope<T> {
  response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: { item?: T[] } | '' } }
}

function decodeKey(raw: string): string {
  // 포털은 Encoding/Decoding 키 두 종류를 준다. 어떤 것을 넣어도 동작하도록 디코딩 후 URLSearchParams 로 인코딩.
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

async function callKma<T>(path: string, params: Record<string, string>, fetchImpl: typeof fetch): Promise<T[]> {
  if (!env.KMA_SERVICE_KEY) throw new AppError(503, 'WEATHER_NOT_CONFIGURED', '날씨 서비스가 설정되지 않았어요.')
  const q = new URLSearchParams({ serviceKey: decodeKey(env.KMA_SERVICE_KEY), pageNo: '1', dataType: 'JSON', ...params })
  const res = await fetchImpl(`${BASE}/${path}?${q}`, { signal: AbortSignal.timeout(15_000) })
  const text = await res.text()
  let json: Envelope<T>
  try {
    json = JSON.parse(text) as Envelope<T>
  } catch {
    // 키 오류 등은 JSON 이 아닌 XML 로 내려온다. 키가 로그에 남지 않도록 본문 일부만 사용.
    throw new AppError(502, 'WEATHER_UPSTREAM_ERROR', `기상청 응답 오류(HTTP ${res.status})`)
  }
  const code = json.response?.header?.resultCode
  if (code !== '00') {
    if (code === '03') return [] // NO_DATA
    throw new AppError(502, 'WEATHER_UPSTREAM_ERROR', `기상청 응답 오류(${code ?? 'unknown'})`)
  }
  const items = json.response?.body?.items
  return items && typeof items === 'object' ? (items.item ?? []) : []
}

interface ShortItem {
  category: string
  fcstDate: string
  fcstTime: string
  fcstValue: string
}

const ptyToPrecip = (v: string): PrecipType => ({ '0': 'none', '1': 'rain', '2': 'sleet', '3': 'snow', '4': 'shower' })[v] as PrecipType ?? 'none'
const skyOf = (v: string | undefined) => (v === '1' ? 'clear' : v === '3' ? 'partly' : v === '4' ? 'cloudy' : null)

export function parseShortItems(items: ShortItem[]): Omit<ShortTermResult, 'issuedAt'> {
  const byTime = new Map<string, Record<string, string>>()
  const dailyMin = new Map<string, number>()
  const dailyMax = new Map<string, number>()
  const dash = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
  for (const it of items) {
    const key = `${it.fcstDate}${it.fcstTime}`
    if (it.category === 'TMN') dailyMin.set(dash(it.fcstDate), Number(it.fcstValue))
    else if (it.category === 'TMX') dailyMax.set(dash(it.fcstDate), Number(it.fcstValue))
    const row = byTime.get(key) ?? {}
    row[it.category] = it.fcstValue
    byTime.set(key, row)
  }
  const hourly: HourlyForecast[] = []
  for (const [key, r] of [...byTime.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (r.TMP === undefined) continue
    const date = dash(key.slice(0, 8))
    hourly.push({
      targetAt: fromKst(date, `${key.slice(8, 10)}:${key.slice(10, 12)}`),
      temp: Number(r.TMP),
      pop: r.POP !== undefined ? Number(r.POP) : 0,
      precip: ptyToPrecip(r.PTY ?? '0'),
      wind: r.WSD !== undefined ? Number(r.WSD) : 0,
      humidity: r.REH !== undefined ? Number(r.REH) : null,
      sky: skyOf(r.SKY),
    })
  }
  return { hourly, dailyMin, dailyMax }
}

function precipFromText(t: string | null): PrecipType {
  if (!t) return 'none'
  const rain = t.includes('비') || t.includes('소나기')
  const snow = t.includes('눈')
  if (rain && snow) return 'sleet'
  if (t.includes('소나기')) return 'shower'
  if (rain) return 'rain'
  if (snow) return 'snow'
  return 'none'
}

export function parseMid(ta: Record<string, unknown> | undefined, land: Record<string, unknown> | undefined, issuedAt: Date): DailyForecast[] {
  const out: DailyForecast[] = []
  if (!ta) return out
  const base = kstDate(issuedAt)
  for (let d = 3; d <= 10; d++) {
    const min = ta[`taMin${d}`]
    const max = ta[`taMax${d}`]
    if (typeof min !== 'number' || typeof max !== 'number') continue
    const am = land?.[`rnSt${d}Am`]
    const pm = land?.[`rnSt${d}Pm`]
    const single = land?.[`rnSt${d}`]
    const pops = [am, pm, single].filter((v): v is number => typeof v === 'number')
    const wfs = [land?.[`wf${d}Am`], land?.[`wf${d}Pm`], land?.[`wf${d}`]].filter((v): v is string => typeof v === 'string')
    const date = kstDate(new Date(fromKst(base, '12:00').getTime() + d * 86400_000))
    const skyText = wfs.join(' / ') || null
    out.push({ date, tempMin: min, tempMax: max, pop: pops.length ? Math.max(...pops) : 0, precip: precipFromText(skyText), skyText })
  }
  return out
}

export class KmaWeatherProvider implements WeatherProvider {
  constructor(private fetchImpl: typeof fetch = fetch) {}

  get configured() {
    return !!env.KMA_SERVICE_KEY
  }

  async fetchShortTerm(nx: number, ny: number, now: Date): Promise<ShortTermResult> {
    const { baseDate, baseTime, issuedAt } = latestShortBase(now)
    const items = await callKma<ShortItem>(
      'VilageFcstInfoService_2.0/getVilageFcst',
      { numOfRows: '1500', base_date: baseDate, base_time: baseTime, nx: String(nx), ny: String(ny) },
      this.fetchImpl,
    )
    if (items.length === 0) throw new AppError(502, 'WEATHER_UPSTREAM_ERROR', '기상청 단기예보 데이터가 비어 있어요.')
    return { issuedAt, ...parseShortItems(items) }
  }

  async fetchMidTerm(regionSido: string, regionDistrict: string | null, now: Date): Promise<MidTermResult> {
    const ids = midRegIds(regionSido, regionDistrict)
    if (!ids) throw new AppError(422, 'REGION_UNSUPPORTED', '이 지역은 중기예보 구역을 찾지 못했어요.')
    const { tmFc, issuedAt } = latestMidTmFc(now)
    const common = { numOfRows: '10', tmFc }
    const [ta, land] = await Promise.all([
      callKma<Record<string, unknown>>('MidFcstInfoService/getMidTa', { ...common, regId: ids.temp }, this.fetchImpl),
      callKma<Record<string, unknown>>('MidFcstInfoService/getMidLandFcst', { ...common, regId: ids.land }, this.fetchImpl),
    ])
    return { issuedAt, daily: parseMid(ta[0], land[0], issuedAt) }
  }
}

export { kstYmd }
