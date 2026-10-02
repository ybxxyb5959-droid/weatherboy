import { useState } from 'react'
import { Link } from 'react-router-dom'
import HandText from '../components/HandText'
import CalendarConnectDialog, { ConnectionRow, type CalendarConn } from '../components/CalendarConnect'
import { eventMood, isSceneMood } from '../lib/eventMood'
import EventMenu from '../components/EventMenu'
import MonthCalendar from '../components/MonthCalendar'
import StickPerson from '../components/StickPerson'
import { formatRange, statusLabel } from '../mocks/events'
import type { PlanEvent } from '../mocks/events'
import { api, errorMessage } from '../api'
import { useAsync } from '../hooks'

export default function EventsPage() {
  const { data, error, loading, reload } = useAsync(() => api<PlanEvent[]>('GET', '/api/events'))
  const events = data ?? []
  const conns = useAsync(() => api<CalendarConn[]>('GET', '/api/calendar'))
  const [connecting, setConnecting] = useState(false)
  const [notice, setNotice] = useState('')

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
    <main className="events-page">
      <div className="page-head">
        <h1>내 일정</h1>
        <div className="row head-actions">
          <button type="button" className="dbtn w3 small" onClick={() => setConnecting(true)}>
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
      {!loading && !error && events.length === 0 && (
        <div className="empty">
          <StickPerson mood="empty" size={140} />
          <p>아직 일정이 없어요</p>
        </div>
      )}
      <div className="col">
        {events.map((e, i) => (
          <div key={e.id} className="card-wrap">
          <Link to={`/events/${e.id}`} className={`box card w${i % 4}`}>
              <div className="row between">
                <div>
                  <div className="title">{e.title}{e.imported && <span className="tiny"> · 📅 연동</span>}</div>
                  <div>{formatRange(e)}</div>
                  <div className="tiny">{statusLabel[e.status]}</div>
                </div>
                <StickPerson mood={eventMood(e.kind, e.status === 'waiting')} size={isSceneMood(eventMood(e.kind, false)) ? 84 : 64} />
              </div>
            </Link>
            <EventMenu event={e} onDeleted={reload} />
          </div>
        ))}
      </div>
      </div>

      {!loading && !error && <MonthCalendar events={events} />}
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
