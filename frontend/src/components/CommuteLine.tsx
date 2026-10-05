import { Link } from 'react-router-dom'
import HandText from './HandText'
import StickPerson from './StickPerson'
import type { ApiHourly } from '../types'
import type { Routine } from '../store'

const WET = ['rain', 'shower', 'snow', 'sleet', 'thunder']

const gap = (a: number, b: number) => Math.min(Math.abs(a - b), 24 - Math.abs(a - b))
const isWet = (s: ApiHourly | null | undefined) => !!s && (s.pop >= 40 || WET.includes(s.condition))

/** 지정한 날(YYYY-MM-DD)의 시간대별 예보 중, 목표 시각(시)에 가장 가까운 칸(1.5시간 이내). 없으면 null. */
function slotAt(hourly: ApiHourly[], time: string | null, ymd: string): ApiHourly | null {
  if (!time) return null
  const target = Number(time.split(':')[0])
  let best: ApiHourly | null = null
  for (const h of hourly) {
    if (new Date(h.time).toLocaleDateString('sv-SE') !== ymd) continue
    if (!best || gap(h.hour, target) < gap(best.hour, target)) best = h
  }
  return best && gap(best.hour, target) <= 1.5 ? best : null
}

/** 홈 외출 카드의 내용: 첫 줄은 외출·귀가 기온, 그 아래 줄마다 한마디씩 */
interface Commute {
  temps: string[]
  notes: string[]
  prefix: string
}

function lineFor(hourly: ApiHourly[], routine: Routine, day: Date): Commute | null {
  if (!routine.days.includes(day.getDay())) return null
  const ymd = day.toLocaleDateString('sv-SE')
  const out = slotAt(hourly, routine.outAt, ymd)
  const home = slotAt(hourly, routine.homeAt, ymd)
  if (!out && !home) return null

  const temps: string[] = []
  if (out) temps.push(`외출 ${out.temp}°`)
  if (home) temps.push(`귀가 ${home.temp}°`)
  const notes: string[] = []

  if (out && home) {
    const d = Math.abs(home.temp - out.temp)
    if (d >= 7) notes.push(home.temp < out.temp ? '들어올 때 더 추워요, 겉옷 챙기세요' : '낮엔 더워져요, 벗기 쉬운 겉옷이 좋아요')
    else if (d <= 3) notes.push('나갈 때와 들어올 때 기온이 비슷해요')
    else notes.push(`일교차 ${d}°`)
  }
  if (isWet(out) || isWet(home)) notes.push('우산도 챙겨요')
  return { temps, notes, prefix: '' }
}

/** 오늘 남은 외출이 있으면 오늘 것을, 오늘 건 모두 지났으면 내일 것을 보여준다 */
export function commuteSummary(hourly: ApiHourly[], routine: Routine, now = new Date()): Commute | null {
  const today = lineFor(hourly, routine, now)
  if (today) return today
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const next = lineFor(hourly, routine, tomorrow)
  return next ? { ...next, prefix: '내일 ' } : null
}

/** 홈의 외출 카드: 왼쪽 졸라맨 + 오른쪽 한 줄. 하루 패턴이 없으면 안내만 보여준다. */
export default function CommuteLine({ hourly, routine }: { hourly: ApiHourly[]; routine?: Routine }) {
  if (!routine || (!routine.outAt && !routine.homeAt)) {
    return (
      <p className="commute hint">
        <Link to="/settings/personal">
          <HandText>외출·귀가 시간을 정하면 그 시간 날씨를 알려드려요 ›</HandText>
        </Link>
      </p>
    )
  }

  const line = commuteSummary(hourly, routine)
  if (!line) return null
  return (
    <div className="commute scene">
      <div className="commute-people">
        <StickPerson mood="trip" size={62} />
      </div>
      <div className="commute-text">
        {/* 첫 줄: 외출·귀가 기온(→로 이어서, 중간에 끊기지 않게). 그 아래: 한마디씩 줄을 바꿔서 */}
        <p className="commute-temps">
          {line.temps.map((t, i) => (
            <span key={t} className="nb">
              <HandText>{`${i === 0 ? line.prefix : '→ '}${t}`}</HandText>
            </span>
          ))}
        </p>
        {line.notes.map((n) => (
          <p key={n} className="commute-note">
            <HandText>{n}</HandText>
          </p>
        ))}
      </div>
    </div>
  )
}
