import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'

const p2 = (n: number) => String(n).padStart(2, '0')

/** 'HH:mm'(24시간) <-> 오전/오후 + 1~12시 */
function split(value: string) {
  const [h, m] = value.split(':').map(Number)
  return { pm: h! >= 12, hour12: h! % 12 === 0 ? 12 : h! % 12, minute: m! }
}
function join(pm: boolean, hour12: number, minute: number) {
  return `${p2((hour12 % 12) + (pm ? 12 : 0))}:${p2(minute)}`
}

const AMPM = ['오전', '오후']
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const MINUTES = [0, 10, 20, 30, 40, 50]
const ROW = 44 // 휠 한 칸 높이(px). CSS(.tp-wheel li, .tp-band)와 같아야 한다

/**
 * 위아래로 굴려 고르는 한 칸짜리 휠. 가운데 띠에 걸린 값이 선택된다.
 * 굴리기가 멈추면(잠깐 스크롤이 없으면) 그 칸으로 딱 맞추고 onChange 를 부른다. 눌러도 그 칸으로 간다.
 */
function Wheel({ items, index, onChange, label }: { items: string[]; index: number; onChange: (i: number) => void; label: string }) {
  const box = useRef<HTMLUListElement>(null)
  const settle = useRef<number | undefined>(undefined)
  const dragging = useRef(false)

  // 바깥에서 값이 바뀌면(처음 열 때, 다른 칸 때문에) 그 칸으로 맞춘다. 사용자가 굴리는 중이면 건드리지 않는다.
  useLayoutEffect(() => {
    const el = box.current
    if (!el || dragging.current) return
    if (Math.abs(el.scrollTop - index * ROW) > 2) el.scrollTop = index * ROW
  }, [index])
  useEffect(() => () => window.clearTimeout(settle.current), [])

  const onScroll = () => {
    dragging.current = true
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => {
      const el = box.current
      dragging.current = false
      if (!el) return
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ROW)))
      if (Math.abs(el.scrollTop - i * ROW) > 1) el.scrollTo({ top: i * ROW, behavior: 'smooth' })
      if (i !== index) onChange(i)
    }, 110)
  }
  const go = (i: number) => {
    box.current?.scrollTo({ top: i * ROW, behavior: 'smooth' })
    onChange(i)
  }
  const key = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    go(Math.max(0, Math.min(items.length - 1, index + d)))
  }

  return (
    <ul
      ref={box}
      className="tp-wheel"
      role="listbox"
      tabIndex={0}
      aria-label={label}
      onScroll={onScroll}
      onKeyDown={key}
    >
      {items.map((t, i) => (
        <li key={t} role="option" aria-selected={i === index} className={i === index ? 'on' : undefined} onClick={() => go(i)}>
          {t}
        </li>
      ))}
    </ul>
  )
}

/** 시간 고르기: 누르면 오전/오후 · 시 · 분 세 칸짜리 휠이 펼쳐진다(분은 10분 단위). */
export default function TimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const { pm, hour12, minute } = split(value)
  // 10분 단위가 아닌 값(예: 08:15)은 가장 가까운 칸에 걸쳐 보여준다. 굴리기 전까지 값은 그대로다.
  const minIdx = Math.min(MINUTES.length - 1, Math.round(minute / 10))

  return (
    <>
      <button type="button" className="dbtn w2 tp-show" aria-expanded={open} aria-label={`${label} 시간 선택`} onClick={() => setOpen((o) => !o)}>
        <span className="tp-ampm">{pm ? '오후' : '오전'}</span> {hour12}:{p2(minute)}
      </button>
      {open && (
        <div className="tp-panel box w3" role="group" aria-label={`${label} 시간`}>
          <div className="tp-wheels">
            <div className="tp-band" aria-hidden="true" />
            <Wheel items={AMPM} index={pm ? 1 : 0} label={`${label} 오전 오후`} onChange={(i) => onChange(join(i === 1, hour12, minute))} />
            <Wheel items={HOURS.map(String)} index={hour12 - 1} label={`${label} 시`} onChange={(i) => onChange(join(pm, HOURS[i]!, minute))} />
            <Wheel items={MINUTES.map(p2)} index={minIdx} label={`${label} 분`} onChange={(i) => onChange(join(pm, hour12, MINUTES[i]!))} />
          </div>
          <button type="button" className="dbtn w1 small tp-done" onClick={() => setOpen(false)}>
            확인
          </button>
        </div>
      )}
    </>
  )
}
