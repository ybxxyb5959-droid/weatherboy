import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import HandText from '../components/HandText'
import Toast, { useToast } from '../components/Toast'
import CalendarConnectDialog, { ConnectionRow, type CalendarConn } from '../components/CalendarConnect'
import { eventMood, isSceneMood } from '../lib/eventMood'
import EventMenu from '../components/EventMenu'
import MonthCalendar, { type MonthView } from '../components/MonthCalendar'
import StickPerson from '../components/StickPerson'
import { EraserTool, FxBorder, PenTool } from '../components/NoteFx'
import { clearEventFx, peekEventFx, type EventFx } from '../lib/eventFx'
import { formatRange, statusLabel } from '../mocks/events'
import type { PlanEvent } from '../mocks/events'
import { api, errorMessage } from '../api'
import { useAsync } from '../hooks'

export default function EventsPage() {
  const { data, error, loading, reload } = useAsync(() => api<PlanEvent[]>('GET', '/api/events'))
  const events = data ?? []
  // 보고 있는 달: 처음엔 오늘이 속한 달. 달력을 넘기면 그 달의 일정이 위쪽 목록에 뜬다.
  const [view, setView] = useState<MonthView>(() => {
    const t = new Date()
    return { y: t.getFullYear(), m: t.getMonth() }
  })
  const p2 = (n: number) => String(n).padStart(2, '0')
  const monthStart = `${view.y}-${p2(view.m + 1)}-01`
  const monthEnd = `${view.y}-${p2(view.m + 1)}-${p2(new Date(view.y, view.m + 1, 0).getDate())}`
  // 그 달에 걸쳐 있는 일정(며칠짜리가 달을 넘어가도 양쪽 달에 보인다), 빠른 날짜순
  const monthEvents = events
    .filter((e) => e.startDate <= monthEnd && (e.endDate && e.endDate >= e.startDate ? e.endDate : e.startDate) >= monthStart)
    .sort((a, b) => (a.startDate + a.startTime).localeCompare(b.startDate + b.startTime))
  // 방금 만들거나 고친 일정은 쪽지에 펜으로 쓰는(고친 건 지우개로 지우고 다시 쓰는) 연출로 나타난다. 잠깐 뒤에는 평소 카드로 돌아간다.
  const [fx, setFx] = useState<Map<string, EventFx>>(() => peekEventFx())
  const [fxReady, setFxReady] = useState(false) // 그 카드가 화면에 보이는 자리에 온 뒤에 연출을 시작한다
  useEffect(() => {
    clearEventFx()
  }, [])
  const fxFirst = [...fx.keys()][0]
  const fxEvent = fxFirst ? events.find((x) => x.id === fxFirst) : undefined
  useEffect(() => {
    if (!fxEvent || fxReady) return
    // 방금 만든 일정이 다른 달이면 그 달로 넘어가고, 목록 아래쪽이면 카드가 보이게 스크롤한 다음 연출을 시작한다
    const y = Number(fxEvent.startDate.slice(0, 4))
    const m = Number(fxEvent.startDate.slice(5, 7)) - 1
    if (y !== view.y || m !== view.m) {
      setView({ y, m })
      return
    }
    const t = window.setTimeout(() => {
      document.querySelector(`[data-ev="${fxEvent.id}"]`)?.scrollIntoView({ block: 'center' })
      setFxReady(true)
    }, 150)
    return () => window.clearTimeout(t)
  }, [fxEvent, fxReady, view])
  useEffect(() => {
    if (!fxReady) return
    const t = window.setTimeout(() => {
      setFx(new Map())
      setFxReady(false)
    }, 3200)
    return () => window.clearTimeout(t)
  }, [fxReady])
  // 지운 일정은 구겨서 옆으로 던지는 연출을 보여준 뒤 목록을 다시 불러온다("움직임 줄이기"면 바로)
  const [crumpling, setCrumpling] = useState<string | null>(null)
  const crumple = (id: string) => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      reload()
      return
    }
    setCrumpling(id)
    window.setTimeout(reload, 900)
  }
  const conns = useAsync(() => api<CalendarConn[]>('GET', '/api/calendar'))
  const [connecting, setConnecting] = useState(false)
  const [notice, setNotice] = useState('')
  const toast = useToast()

  const afterChange = () => {
    reload()
    conns.reload()
  }
  const syncOne = async (c: CalendarConn) => {
    setNotice('')
    try {
      await api('POST', `/api/calendar/${c.id}/sync`)
    } catch (e) {
      setNotice(errorMessage(e))
    }
    afterChange()
  }
  const removeOne = async (c: CalendarConn) => {
    if (!window.confirm('연동을 해제하면 이 캘린더에서 가져온 일정이 모두 지워져요. 해제할까요?')) return
    setNotice('')
    try {
      await api('DELETE', `/api/calendar/${c.id}`)
    } catch (e) {
      setNotice(errorMessage(e))
    }
    afterChange()
  }
  return (
    <main className="events-page sticky-head">
      <div className="page-head">
        <h1>내 일정</h1>
        <div className="row head-actions">
          {/* 연동은 아직 준비중: 회색으로 두고, 누르면 안내만 띄운다 */}
          <button type="button" className="dbtn w3 small is-soon" aria-disabled="true" onClick={() => toast.show('캘린더 연동은 아직 준비중이에요')}>
            <HandText>캘린더 연동</HandText>
          </button>
          <Link to="/events/new" className="dbtn w1 small">
            <HandText>+ 일정 추가</HandText>
          </Link>
        </div>
      </div>
      {/* 일정 목록만 스크롤된다. 달력은 아래에 고정. */}
      <div className="events-list">
      {notice && <p role="alert" className="tiny">{notice}</p>}
      {(conns.data ?? []).length > 0 && (
        <ul className="conn-list">
          {(conns.data ?? []).map((c) => (
            <ConnectionRow key={c.id} c={c} onSync={() => void syncOne(c)} onRemove={() => void removeOne(c)} />
          ))}
        </ul>
      )}
      {loading && <p>불러오는 중…</p>}
      {error && (
        <div className="empty">
          <p role="alert">{error}</p>
          <button type="button" className="dbtn w1" onClick={reload}>
            다시 시도
          </button>
        </div>
      )}
      {!loading && !error && (
        <h2 className="month-title">
          {view.y !== new Date().getFullYear() ? `${view.y}년 ` : ''}
          {view.m + 1}월 일정
        </h2>
      )}
      {!loading && !error && monthEvents.length === 0 && (
        <div className="empty">
          <StickPerson mood="empty" size={140} />
          <p>{events.length === 0 ? '아직 일정이 없어요' : `${view.m + 1}월에는 일정이 없어요`}</p>
        </div>
      )}
      <div className="col">
        {monthEvents.map((e, i) => {
          const f = fx.get(e.id)
          return (
            <div key={e.id} data-ev={e.id} className={`card-wrap${f ? ' fx-new' : ''}${crumpling === e.id ? ' fx-crumple' : ''}`}>
              <Link to={`/events/${e.id}`} className={`box card note w${i % 4}${f ? (fxReady ? ` fx-${f.kind}` : ' fx-wait') : ''}`}>
                {f?.kind === 'created' && <FxBorder />}
                <div className="row between">
                  <div className="fx-wrap">
                    {f?.kind === 'edited' && (
                      <div className="fx-old" aria-hidden="true">
                        <div className="title">{f.oldTitle}</div>
                        <div>{f.oldRange}</div>
                      </div>
                    )}
                    <div className="fx-write">
                      <div className="title">{e.title}{e.imported && <span className="tiny"> · 📅 연동</span>}</div>
                      <div>{formatRange(e)}</div>
                    </div>
                    <div className="tiny fx-late">{e.needsOutfit === false ? '날씨만 알려드려요' : statusLabel[e.status]}</div>
                    {f?.kind === 'edited' && <EraserTool />}
                    {f && <PenTool />}
                  </div>
                  <div className="fx-late">
                    <StickPerson mood={eventMood(e.kind, e.status === 'waiting', e.title, e.place)} size={isSceneMood(eventMood(e.kind, false, e.title, e.place)) ? 84 : 64} />
                  </div>
                </div>
              </Link>
              <EventMenu event={e} onDeleted={() => crumple(e.id)} />
            </div>
          )
        })}
      </div>
      </div>

      {!loading && !error && <MonthCalendar events={events} view={view} onViewChange={setView} />}
      <Toast message={toast.message} />
      {connecting && (
        <CalendarConnectDialog
          onClose={() => setConnecting(false)}
          onConnected={() => {
            setConnecting(false)
            afterChange()
          }}
        />
      )}
    </main>
  )
}
