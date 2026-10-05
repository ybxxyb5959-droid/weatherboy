import type { OutingPoint } from './outfitEngine.js'
import { kstDate, toKstParts } from '../utils/time.js'

/** 야외활동 점수(0~100): 기온·비·바람·미세먼지를 보고 밖에서 몸을 쓰기 좋은 정도. 옷은 보지 않는다(운동복을 입으니까). */
export type ActivityGrade = 'great' | 'good' | 'fair' | 'poor' | 'bad'

export interface ActivityFactor {
  /** 0~100. 정보가 없으면 null (미세먼지는 예보가 없는 날이 많다) */
  score: number | null
  /** 화면에 쓰는 값 (예: "체감 14°", "강수 20%") */
  value: string
}

export interface DayActivity {
  date: string
  score: number
  grade: ActivityGrade
  label: string
  factors: { temp: ActivityFactor; rain: ActivityFactor; wind: ActivityFactor; air: ActivityFactor }
  /** 그날 일출·일몰(KST HH:MM). 위치를 모르거나 해가 안 뜨고/안 지는 날이면 null */
  sun: { rise: string; set: string } | null
  tip: string
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
/** 평균에 가장 나쁜 순간을 섞는다: 하루 중 잠깐 비가 와도 점수에 반영되게 */
const blend = (xs: number[]) => mean(xs) * 0.6 + Math.min(...xs) * 0.4

// 체감 10~17° 가 가장 좋다. 10° 아래는 1° 마다 10점(체감 5° 는 50점, 0° 는 0점), 17° 위는 1° 마다 7점 깎는다
const tempScore = (feels: number) => clamp(feels < 10 ? 100 - (10 - feels) * 10 : feels > 17 ? 100 - (feels - 17) * 7 : 100)
const windScore = (ms: number) => clamp(ms <= 3 ? 100 : 100 - (ms - 3) * 10)
const rainScore = (p: OutingPoint) => (p.precip !== 'none' ? (p.pop >= 60 || p.precip === 'snow' ? 5 : 20) : clamp(100 - p.pop * 0.8))
const AIR_SCORE = [null, 100, 75, 35, 5] as const
const AIR_LABEL = ['', '좋음', '보통', '나쁨', '매우 나쁨'] as const

const GRADES: [number, ActivityGrade, string][] = [
  [80, 'great', '아주 좋아요'],
  [65, 'good', '좋아요'],
  [45, 'fair', '보통이에요'],
  [25, 'poor', '별로예요'],
  [0, 'bad', '쉬는 게 좋아요'],
]

const ACTIVE_FROM = 6
const ACTIVE_TO = 22 // 6시 ~ 22시 사이만 본다(한밤·새벽은 활동 시간이 아니다)
const hourOf = (p: OutingPoint) => toKstParts(p.at).hour

function factorsOf(pts: OutingPoint[], air: number | null, airIsForecast = false) {
  const feels = Math.round(mean(pts.map((p) => p.feels)))
  const pop = Math.max(...pts.map((p) => p.pop))
  const windAvg = mean(pts.map((p) => p.wind))
  const airScore = air != null ? AIR_SCORE[air] ?? null : null
  return {
    temp: { score: Math.round(blend(pts.map((p) => tempScore(p.feels)))), value: `체감 ${feels}°` },
    rain: { score: Math.round(blend(pts.map(rainScore))), value: `강수 ${pop}%` },
    wind: { score: Math.round(blend(pts.map((p) => windScore(p.wind)))), value: `${windAvg.toFixed(1)}m/s` },
    air: { score: airScore, value: air != null ? `${airIsForecast ? '예보 ' : ''}${AIR_LABEL[air] ?? '-'}` : '예보 없음' },
    feels,
  }
}

/** 네 요인을 가중 평균(기온 35 · 비 30 · 미세먼지 20 · 바람 15). 미세먼지 정보가 없으면 나머지로 맞춘다. 한 가지가 아주 나쁘면 그 점수보다 35점 넘게 높을 수 없다 */
function totalOf(f: { temp: ActivityFactor; rain: ActivityFactor; wind: ActivityFactor; air: ActivityFactor }): number {
  const parts: [number, number][] = [[f.temp.score ?? 0, 35], [f.rain.score ?? 0, 30], [f.wind.score ?? 0, 15]]
  if (f.air.score != null) parts.push([f.air.score, 20])
  const w = parts.reduce((a, [, x]) => a + x, 0)
  const weighted = parts.reduce((a, [s, x]) => a + s * x, 0) / w
  const worst = Math.min(...parts.map(([s]) => s))
  return Math.round(Math.min(weighted, worst + 35))
}

function tipOf(f: ReturnType<typeof factorsOf>): string {
  const low = (s: number | null) => s != null && s < 50
  if (low(f.rain.score)) return '비 소식이 있어요. 실내 운동이나 다른 날을 골라보세요.'
  if (low(f.air.score)) return '미세먼지가 나빠요. 마스크를 쓰거나 실내 운동을 추천해요.'
  if (low(f.wind.score)) return '바람이 강해요. 바람막이를 챙겨요.'
  // 쌀쌀함은 점수가 아직 괜찮아 보여도 알려준다(체감 7° 미만이면 기온 점수 70 미만)
  if (f.feels < 10 && f.temp.score != null && f.temp.score < 70) return '쌀쌀해요. 몸을 충분히 풀고, 얇은 겉옷을 챙겨요.'
  if (low(f.temp.score)) return '더워요. 물을 챙기고 한낮은 피해요.'
  return '활동하기 좋은 날씨예요.'
}

/**
 * 일정 기간의 예보를 날짜별 야외활동 점수로 만든다.
 * airGrade 는 지금 측정한 대기질(1좋음~4매우나쁨)이라 오늘 날짜에만 쓰고, airForecast 는 날짜별 대기질 예보 등급(시간대별 예보는 없다).
 * 오늘은 측정값과 예보 중 나쁜 쪽을 쓰고(저녁에 나빠진다는 예보를 놓치지 않게), 그 외 날짜는 예보만 쓴다. 예보도 없으면 "예보 없음"이고 점수에서 빠진다.
 */
export function activityByDay(points: OutingPoint[], airGrade: number | null, today: string, sunOf?: (date: string) => { rise: string; set: string } | null, airForecast?: Record<string, number>): DayActivity[] {
  const byDay = new Map<string, OutingPoint[]>()
  for (const p of points) {
    const d = kstDate(p.at)
    byDay.set(d, [...(byDay.get(d) ?? []), p])
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, all]) => {
      // 중기예보 날짜는 정오 한 시각에 최저/최고 두 점만 있다 -> 시간대 구분 없음
      const hourly = new Set(all.map((p) => p.at.getTime())).size > 1
      const active = hourly ? all.filter((p) => hourOf(p) >= ACTIVE_FROM && hourOf(p) < ACTIVE_TO) : all
      const pts = active.length ? active : all
      const forecast = airForecast?.[date] ?? null
      const measured = date === today ? airGrade : null
      const air = measured != null && forecast != null ? Math.max(measured, forecast) : measured ?? forecast
      const f = factorsOf(pts, air, air != null && (measured == null || (forecast != null && forecast >= measured)))
      const score = totalOf(f)
      const grade = GRADES.find(([min]) => score >= min)!
      return {
        date,
        score,
        grade: grade[1],
        label: grade[2],
        factors: { temp: { score: f.temp.score, value: f.temp.value }, rain: f.rain, wind: f.wind, air: f.air },
        sun: sunOf?.(date) ?? null,
        tip: tipOf(f),
      }
    })
}
