import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import HandText from './HandText'
import type { PlanEvent } from '../mocks/events'

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
const p2 = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${p2(m + 1)}-${p2(d)}`

/** 일정이 걸쳐 있는 모든 날짜(YYYY-MM-DD)를 펼친다 */
function datesOf(e: PlanEvent): string[] {
  const out: string[] = []
  const [sy, sm, sd] = e.startDate.split('-').map(Number)
  const end = e.endDate && e.endDate >= e.startDate ? e.endDate : e.startDate
  const cur = new Date(Date.UTC(sy!, sm! - 1, sd!))
  for (let i = 0; i < 62; i++) {
    const s = cur.toISOString().slice(0, 10)
    out.push(s)
    if (s >= end) break
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

/** 우리 디자인(삐뚤빼뚤 낙서)의 한 달 달력. 일정이 있는 날은 점으로, 오늘은 동그라미로 표시한다. */
export default function MonthCalendar({ events }: { events: PlanEvent[] }) {
  const [today] = useState(() => new Date())
  const todayStr = ymd(today.getFullYear(), today.getMonth(), today.getDate())
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [selected, setSelected] = useState(todayStr)

  const byDate = useMemo(() => {
    const map = new Map<string, PlanEvent[]>()
    for (const e of events) for (const d of datesOf(e)) map.set(d, [...(map.get(d) ?? []), e])
    return map
  }, [events])

  const first = new Date(view.y, view.m, 1).getDay()
  const days = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  // 항상 6주(42칸)로 그려서 달마다 높이가 달라져 ◀ ▶ 가 움직이지 않게 한다
  while (cells.length < 42) cells.push(null)

  const go = (delta: number) => setView(({ y, m }) => {
    const d = new Date(y, m + delta, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const picked = byDate.get(selected) ?? []

  return (
    <section className="section cal">
      <div className="cal-head">
        <button type="button" className="mini" onClick={() => go(-1)} aria-label="이전 달">◀</button>
        <h2>
          {view.y}년 {view.m + 1}월
        </h2>
        <button type="button" className="mini" onClick={() => go(1)} aria-label="다음 달">▶</button>
      </div>
      <hr className="scribble under-title" />
      <div className="cal-grid" role="grid">
        {WEEKDAY.map((w, i) => (
          <div key={w} className={`cal-wd${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d == null) return <div key={`e${i}`} className="cal-day empty" aria-hidden="true" />
          const s = ymd(view.y, view.m, d)
          const has = byDate.has(s)
          const dow = i % 7
          return (
            <button
              key={s}
              type="button"
              className={`cal-day${s === todayStr ? ' today' : ''}${s === selected ? ' sel' : ''}${dow === 0 ? ' sun' : dow === 6 ? ' sat' : ''}`}
              onClick={() => setSelected(s)}
              aria-label={`${view.m + 1}월 ${d}일${has ? ', 일정 있음' : ''}`}
              aria-pressed={s === selected}
            >
              <span>{d}</span>
              <i className={has ? 'dot' : 'dot off'} />
            </button>
          )
        })}
      </div>

      <div className="cal-pick">
        <div className="row between">
          <strong>
            <HandText>{`${Number(selected.slice(5, 7))}월 ${Number(selected.slice(8))}일`}</HandText>
          </strong>
          <Link to={`/events/new?date=${selected}`} className="dbtn w2 small">
            <HandText>+ 이 날 일정 추가</HandText>
          </Link>
        </div>
        {picked.length === 0 ? (
          <p className="tiny">이 날은 일정이 없어요</p>
        ) : (
          <ul>
            {picked.map((e) => (
              <li key={e.id}>
                <Link to={`/events/${e.id}`}>
                  {e.startTime} {e.title}
                  {e.place ? ` · ${e.place}` : ''}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
