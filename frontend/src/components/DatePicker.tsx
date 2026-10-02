import { useState } from 'react'
import ArrowButton from './ArrowButton'

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
const p2 = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${p2(m + 1)}-${p2(d)}`

interface Props {
  /** YYYY-MM-DD, 아직 안 골랐으면 '' */
  value: string
  onChange: (v: string) => void
  label: string
  /** 이 날짜보다 이전은 고를 수 없다 */
  min?: string
  id?: string
}

/** 우리 디자인의 날짜 선택기. 누르면 낙서 달력이 펼쳐지고, 날짜를 누르면 닫힌다. */
export default function DatePicker({ value, onChange, label, min, id }: Props) {
  const initial = value ? new Date(`${value}T00:00:00`) : new Date()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState({ y: initial.getFullYear(), m: initial.getMonth() })
  const [todayStr] = useState(() => {
    const t = new Date()
    return ymd(t.getFullYear(), t.getMonth(), t.getDate())
  })

  const first = new Date(view.y, view.m, 1).getDay()
  const days = new Date(view.y, view.m + 1, 0).getDate()
  // 항상 6주(42칸): 달마다 높이가 달라져 버튼이 움직이지 않게
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length < 42) cells.push(null)

  const go = (delta: number) =>
    setView(({ y, m }) => {
      const d = new Date(y, m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })

  const text = value
    ? `${value.slice(0, 4)}년 ${Number(value.slice(5, 7))}월 ${Number(value.slice(8))}일 (${WEEKDAY[new Date(`${value}T00:00:00`).getDay()]})`
    : '날짜를 골라요'

  return (
    <div className="dp">
      <button type="button" id={id} className="dbtn w2 dp-show" aria-expanded={open} aria-label={`${label} 선택`} onClick={() => setOpen((o) => !o)}>
        {text}
      </button>
      {open && (
        <div className="dp-panel box w3" role="group" aria-label={label}>
          <div className="cal-head">
            <ArrowButton dir="prev" onClick={() => go(-1)} label="이전 달" />
            <strong>
              {view.y}년 {view.m + 1}월
            </strong>
            <ArrowButton dir="next" onClick={() => go(1)} label="다음 달" />
          </div>
          <div className="cal-grid dp-grid">
            {WEEKDAY.map((w, i) => (
              <div key={w} className={`cal-wd${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>
                {w}
              </div>
            ))}
            {cells.map((d, i) => {
              if (d == null) return <div key={`e${i}`} className="cal-day empty" aria-hidden="true" />
              const s = ymd(view.y, view.m, d)
              const disabled = !!min && s < min
              const dow = i % 7
              return (
                <button
                  key={s}
                  type="button"
                  disabled={disabled}
                  className={`cal-day${s === todayStr ? ' today' : ''}${s === value ? ' sel' : ''}${dow === 0 ? ' sun' : dow === 6 ? ' sat' : ''}${disabled ? ' dis' : ''}`}
                  aria-pressed={s === value}
                  aria-label={`${view.m + 1}월 ${d}일`}
                  onClick={() => {
                    onChange(s)
                    setOpen(false)
                  }}
                >
                  <span>{d}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
