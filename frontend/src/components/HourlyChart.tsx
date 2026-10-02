import { WeatherDoodle } from './DoodleWeather'
import type { ApiHourly } from '../types'

const MAX_BAR = 90
const MIN_BAR = 14

/** marks: 외출/귀가처럼 특정 시각을 가까운 칸에 표시한다 */
export default function HourlyChart({ data, marks = [] }: { data: ApiHourly[]; marks?: { hour: number; label: string }[] }) {
  // 3시간 간격이라 표시할 시각에서 가장 가까운 칸(1.5시간 이내)에 붙인다. 자정을 넘나드는 경우도 24시간 원형으로 계산
  const gap = (a: number, b: number) => Math.min(Math.abs(a - b), 24 - Math.abs(a - b))
  const marksByIndex = new Map<number, string[]>()
  for (const m of marks) {
    let best = -1
    data.forEach((d, i) => {
      if (best < 0 || gap(d.hour, m.hour) < gap(data[best]!.hour, m.hour)) best = i
    })
    if (best >= 0 && gap(data[best]!.hour, m.hour) <= 1.5) marksByIndex.set(best, [...(marksByIndex.get(best) ?? []), m.label])
  }
  const temps = data.map((d) => d.temp)
  const lo = Math.min(...temps)
  const hi = Math.max(...temps)
  const barH = (t: number) => (hi === lo ? 52 : MIN_BAR + ((t - lo) / (hi - lo)) * (MAX_BAR - MIN_BAR))

  return (
    <div className="hourly" role="list" aria-label="시간대별 기온">
      {data.map((d, i) => (
        <div key={d.time} className="hcol" role="listitem">
          <WeatherDoodle kind={d.condition} size={30} />
          <div className="htemp">{d.temp}°</div>
          <div className="hbar-wrap">
            <div className={`hbar${i === 0 ? ' now' : ''}`} style={{ height: barH(d.temp) }} />
          </div>
          <div className="tiny">{i === 0 ? '지금' : `${d.hour}시`}</div>
          {(marksByIndex.get(i) ?? []).map((label) => (
            <div key={label} className="tiny hmark">{label}</div>
          ))}
          {d.pop >= 30 && <div className="tiny hpop">{d.pop}%</div>}
        </div>
      ))}
    </div>
  )
}
