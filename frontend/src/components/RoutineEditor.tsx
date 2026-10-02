import DoodleButton from './DoodleButton'
import TimePicker from './TimePicker'
import type { Routine } from '../store'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
// 하루 패턴을 처음 정할 때의 기본 시간: 외출 오전 9:00, 귀가 오후 6:00
const DEFAULT_OUT = '09:00'
const DEFAULT_HOME = '18:00'

function TimeRow({ label, value, onChange, initial }: { label: string; value: string | null; onChange: (v: string | null) => void; initial: string }) {
  return (
    <div className="routine-row">
      <span className="routine-label">{label}</span>
      {value === null ? <span className="tiny">모르겠어요</span> : <TimePicker value={value} onChange={onChange} label={label} />}
      <button type="button" className="mini" onClick={() => onChange(value === null ? initial : null)}>
        {value === null ? '정하기' : '없음'}
      </button>
    </div>
  )
}

/** 하루 패턴 입력: 외출 시간, 들어오는 시간, 요일 */
export default function RoutineEditor({ value, onChange }: { value: Routine; onChange: (r: Routine) => void }) {
  const toggleDay = (d: number) =>
    onChange({ ...value, days: value.days.includes(d) ? value.days.filter((x) => x !== d) : [...value.days, d].sort() })
  return (
    <div className="routine">
      <TimeRow label="외출 시간" value={value.outAt} initial={DEFAULT_OUT} onChange={(v) => onChange({ ...value, outAt: v })} />
      <TimeRow label="귀가 시간" value={value.homeAt} initial={DEFAULT_HOME} onChange={(v) => onChange({ ...value, homeAt: v })} />
      <div className="routine-days" role="group" aria-label="외출하는 요일">
        {DAYS.map((d, i) => (
          <DoodleButton key={d} seed={i} className="small" selected={value.days.includes(i)} onClick={() => toggleDay(i)}>
            {d}
          </DoodleButton>
        ))}
      </div>
    </div>
  )
}
