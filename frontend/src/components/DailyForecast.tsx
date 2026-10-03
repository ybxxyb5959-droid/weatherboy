import { WeatherDoodle, type WeatherKind } from './DoodleWeather'
import type { ApiDaily } from '../types'

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

interface Today {
  tempMin: number | null
  tempMax: number | null
  condition: WeatherKind
  rainChance: number
}

const dayNumber = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!) / 86400_000
}
// 날짜 숫자. 달이 바뀌는 1일(과 맨 앞 칸)은 몇 월인지도 붙인다
const dateLabel = (ymd: string, first: boolean) => {
  const [, m, d] = ymd.split('-').map(Number)
  return first || d === 1 ? `${m}/${d}` : String(d)
}
const weekdayOf = (ymd: string) => new Date(dayNumber(ymd) * 86400_000).getUTCDay()

/** 오늘부터 일주일을 가로로 한 줄에 보여준다 (날짜 · 요일 · 최고/최저 · 날씨 그림 · 비 확률) */
export default function DailyForecast({ data, today }: { data: ApiDaily[]; today: Today }) {
  const todayYmd = new Date().toLocaleDateString('sv-SE')
  const days: (ApiDaily & { isToday?: boolean })[] = [
    {
      date: todayYmd,
      tempMin: today.tempMin ?? today.tempMax ?? 0,
      tempMax: today.tempMax ?? today.tempMin ?? 0,
      pop: today.rainChance,
      condition: today.condition,
      isToday: true,
    },
    ...data,
  ]
  const tomorrow = data[0]
  const diff = tomorrow && today.tempMax != null ? tomorrow.tempMax - today.tempMax : null
  const hint = diff == null || diff === 0 ? '' : diff > 0 ? `내일은 오늘보다 ${diff}° 높아요` : `내일은 오늘보다 ${-diff}° 낮아요`

  return (
    <section className="section daily">
      <h2>앞으로의 날씨</h2>
      <ol className="week" aria-label="일주일 날씨">
        {days.map((d, i) => {
          const wd = weekdayOf(d.date)
          return (
            <li key={d.date} className="wday">
              <span className="tiny wdate">{dateLabel(d.date, i === 0)}</span>
              <span className={`wname${d.isToday ? ' today' : wd === 6 ? ' sat' : wd === 0 ? ' sun' : ''}`}>{WEEKDAY[wd]}</span>
              <span className="wmax">{d.tempMax}°</span>
              <span className="wmin">{d.tempMin}°</span>
              <WeatherDoodle kind={d.condition} size={34} />
              <span className="tiny wpop">{d.pop >= 30 ? `${d.pop}%` : ''}</span>
            </li>
          )
        })}
      </ol>
      {hint && <p className="tiny dhint">{hint}</p>}
    </section>
  )
}
