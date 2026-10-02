import { useState } from 'react'
import DoodleButton from './DoodleButton'

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
const p2 = (n: number) => String(n).padStart(2, '0')

/** 'HH:mm'(24시간) <-> 오전/오후 + 1~12시 */
function split(value: string) {
  const [h, m] = value.split(':').map(Number)
  return { pm: h! >= 12, hour12: h! % 12 === 0 ? 12 : h! % 12, minute: m! }
}
function join(pm: boolean, hour12: number, minute: number) {
  return `${p2((hour12 % 12) + (pm ? 12 : 0))}:${p2(minute)}`
}

/** 우리 디자인의 시간 선택기. 누르면 오전/오후, 시, 분 칸이 펼쳐진다. */
export default function TimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const { pm, hour12, minute } = split(value)
  return (
    <>
      <button type="button" className="dbtn w2 tp-show" aria-expanded={open} aria-label={`${label} 시간 선택`} onClick={() => setOpen((o) => !o)}>
        <span className="tp-ampm">{pm ? '오후' : '오전'}</span> {hour12}:{p2(minute)}
      </button>
      {open && (
        <div className="tp-panel box w3" role="group" aria-label={`${label} 시간`}>
          <div className="row stretch">
            <DoodleButton seed={0} selected={!pm} onClick={() => onChange(join(false, hour12, minute))}>
              오전
            </DoodleButton>
            <DoodleButton seed={1} selected={pm} onClick={() => onChange(join(true, hour12, minute))}>
              오후
            </DoodleButton>
          </div>
          <div className="tp-grid">
            {HOURS.map((h) => (
              <button key={h} type="button" className={`tp-cell${h === hour12 ? ' on' : ''}`} aria-pressed={h === hour12} onClick={() => onChange(join(pm, h, minute))}>
                {h}
              </button>
            ))}
          </div>
          <div className="tiny">분</div>
          <div className="tp-grid">
            {MINUTES.map((m) => (
              <button key={m} type="button" className={`tp-cell${m === minute ? ' on' : ''}`} aria-pressed={m === minute} onClick={() => onChange(join(pm, hour12, m))}>
                {p2(m)}
              </button>
            ))}
          </div>
          <button type="button" className="dbtn w1 small tp-done" onClick={() => setOpen(false)}>
            확인
          </button>
        </div>
      )}
    </>
  )
}
