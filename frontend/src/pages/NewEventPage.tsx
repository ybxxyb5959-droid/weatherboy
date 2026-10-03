import { useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import DoodleButton, { ChoiceRow } from '../components/DoodleButton'
import DatePicker from '../components/DatePicker'
import TimePicker from '../components/TimePicker'
import SayBox from '../components/SayBox'
import { eventKinds } from '../mocks/events'
import type { EventKind, PlanEvent } from '../mocks/events'
import { api, errorMessage } from '../api'
import type { EventSuggestion } from '../lib/ai'

// 여행·캠핑은 며칠씩 가니까 시간 대신 날짜(몇 박 며칠)를 고른다
const MULTI_DAY: EventKind[] = ['여행', '캠핑']
const NIGHT_CHOICES = [0, 1, 2, 3, 4]

const nightsLabel = (n: number) => (n === 0 ? '당일' : `${n}박 ${n + 1}일`)

const dayNumber = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!) / 86400_000
}
const addDays = (ymd: string, n: number) => new Date((dayNumber(ymd) + n) * 86400_000).toISOString().slice(0, 10)
const short = (ymd: string) => `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8))}일`

/** 수정할 일정이 있으면 지금 값에서 "몇 박 며칠"을 되짚는다 */
function initialSpan(ev?: PlanEvent): { nights: number | null; customEnd: string } {
  if (!ev) return { nights: 1, customEnd: '' }
  if (!ev.endDate) return { nights: 0, customEnd: '' }
  const n = dayNumber(ev.endDate) - dayNumber(ev.startDate)
  return NIGHT_CHOICES.includes(n) ? { nights: n, customEnd: '' } : { nights: null, customEnd: ev.endDate }
}

export default function NewEventPage() {
  return <EventForm />
}

/** 일정 등록(event 없음) / 일정 수정(event 있음) 공용 입력 화면 */
export function EventForm({ event }: { event?: PlanEvent }) {
  const nav = useNavigate()
  const [kind, setKind] = useState<EventKind>(event?.kind ?? '여행')
  const [title, setTitle] = useState(event?.title ?? '')
  // 달력에서 날짜를 눌러 들어오면 그 날짜로 미리 채운다 (?date=YYYY-MM-DD)
  const [date, setDate] = useState(() => {
    if (event) return event.startDate
    const q = new URLSearchParams(location.search).get('date') ?? ''
    return /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : ''
  })
  const [nights, setNights] = useState<number | null>(() => initialSpan(event).nights) // null = 돌아오는 날을 직접 고름
  const [customEnd, setCustomEnd] = useState(() => initialSpan(event).customEnd)
  const [place, setPlace] = useState(event?.place ?? '')
  const [startTime, setStartTime] = useState(event?.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(event?.endTime ?? '18:00')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [say, setSay] = useState('')
  const [thinking, setThinking] = useState(false)
  const [aiNote, setAiNote] = useState('')

  const multi = MULTI_DAY.includes(kind)
  const endDate = !multi || !date ? '' : nights === null ? customEnd : addDays(date, nights)
  const span = multi && date && endDate ? dayNumber(endDate) - dayNumber(date) : null

  // 한 문장을 일정 칸으로 바꿔서 채운다. 제안일 뿐이라 사용자가 확인하고 저장한다.
  const fillFromText = async (spoken?: string) => {
    const text = (spoken ?? say).trim()
    if (thinking || text.length < 2) return
    setThinking(true)
    setError('')
    setAiNote('')
    try {
      const s = await api<EventSuggestion>('POST', '/api/ai/parse-event', { text })
      const k = (eventKinds as string[]).includes(s.kind) ? (s.kind as EventKind) : '기타'
      setKind(k)
      setTitle(s.title)
      setDate(s.startDate)
      setPlace(s.place)
      if (MULTI_DAY.includes(k)) {
        const n = s.endDate ? dayNumber(s.endDate) - dayNumber(s.startDate) : 0
        if (NIGHT_CHOICES.includes(n)) setNights(n)
        else {
          setNights(null)
          setCustomEnd(s.endDate ?? '')
        }
      } else {
        if (s.startTime) setStartTime(s.startTime)
        if (s.endTime) setEndTime(s.endTime)
      }
      setAiNote('AI가 채웠어요. 맞는지 확인하고 저장해주세요.')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setThinking(false)
    }
  }

  const save = async () => {
    if (saving) return
    if (!title.trim() || !date) {
      setError('제목이랑 날짜는 꼭 적어줘')
      return
    }
    if (multi && (!endDate || endDate < date)) {
      setError('돌아오는 날을 시작일 이후로 골라줘')
      return
    }
    setSaving(true)
    setError('')
    try {
      const body = {
        title: title.trim(),
        startDate: date,
        place: place.trim(),
        kind,
        // 며칠 가는 일정은 첫날 아침부터 마지막 날 저녁까지로 본다
        ...(multi ? { startTime: '09:00', endTime: '18:00', ...(endDate > date ? { endDate } : {}) } : { startTime, endTime }),
      }
      if (event) {
        // 수정할 때는 끝나는 날을 항상 보낸다 (며칠짜리를 당일로 줄이는 경우도 반영되도록)
        const saved = await api<PlanEvent>('PATCH', `/api/events/${event.id}`, { ...body, endDate: multi && endDate > date ? endDate : date })
        nav(`/events/${saved.id}`, { replace: true, state: { saved: 'edited' } })
        return
      }
      const created = await api<PlanEvent>('POST', '/api/events', body)
      // replace: 뒤로 가기를 눌렀을 때 방금 작성한 등록 화면이 아니라 일정 목록으로 가게 한다
      nav(`/events/${created.id}`, { replace: true, state: { saved: 'created' } })
    } catch (e) {
      setError(errorMessage(e))
      setSaving(false)
    }
  }

  return (
    <main>
      <div className="page-head">
        <div className="row"><BackButton /><h1>{event ? '일정 수정' : '일정 등록'}</h1></div>
      </div>
      {!event && (
      <SayBox
        id="say"
        label="말로 적기"
        placeholder="예: 다음주 금요일부터 2박 3일 제주 여행"
        value={say}
        onChange={setSay}
        onSubmit={(t) => void fillFromText(t)}
        busy={thinking}
        busyLabel="읽는 중…"
        submitLabel="채워줘"
        submitOnVoice
        note={aiNote}
      />
      )}
      <div className="field" style={event ? { marginTop: 0 } : undefined}>
        <div className="name">일정 유형</div>
        <ChoiceRow options={eventKinds} value={kind} onChange={setKind} />
      </div>
      <div className="field">
        <label className="name" htmlFor="title">제목</label>
        <input id="title" type="text" value={title} placeholder={kind === '캠핑' ? '예: 가평 캠핑' : kind === '등산' ? '예: 북한산 등산' : '예: 제주 여행'} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label className="name" htmlFor="date">{multi ? '출발 날짜' : '날짜'}</label>
        <DatePicker id="date" label={multi ? '출발 날짜' : '날짜'} value={date} onChange={setDate} />
      </div>

      {multi && (
        <div className="field">
          <div className="name">일정</div>
          <div className="row wrap">
            {NIGHT_CHOICES.map((n, i) => (
              <DoodleButton key={n} seed={i} className="small" selected={nights === n} onClick={() => setNights(n)}>
                {nightsLabel(n)}
              </DoodleButton>
            ))}
            <DoodleButton seed={3} className="small" selected={nights === null} onClick={() => setNights(null)}>
              직접
            </DoodleButton>
          </div>
          {nights === null && (
            <div style={{ marginTop: 8 }}>
              <label className="name" htmlFor="end">돌아오는 날짜</label>
              <DatePicker id="end" label="돌아오는 날짜" value={customEnd} min={date || undefined} onChange={setCustomEnd} />
            </div>
          )}
          {span !== null && span >= 0 && (
            <p className="trip-sum">
              {short(date)} ~ {short(endDate)} · {nightsLabel(span)}
            </p>
          )}
        </div>
      )}

      <div className="field">
        <label className="name" htmlFor="place">장소</label>
        <input id="place" type="text" value={place} placeholder={kind === '등산' ? '예: 북한산' : '예: 제주도'} onChange={(e) => setPlace(e.target.value)} />
      </div>

      {!multi && (
        <div className="field">
          <div className="routine-row">
            <span className="routine-label">시작 시간</span>
            <TimePicker value={startTime} onChange={setStartTime} label="시작" />
          </div>
          <div className="routine-row" style={{ marginTop: 10 }}>
            <span className="routine-label">종료 시간</span>
            <TimePicker value={endTime} onChange={setEndTime} label="종료" />
          </div>
        </div>
      )}

      {error && <p style={{ marginTop: 12 }}>{error}</p>}
      <div className="field">
        <DoodleButton seed={1} className="block" onClick={() => void save()}>
          {saving ? '저장 중…' : event ? '수정 저장' : '일정 저장'}
        </DoodleButton>
      </div>
    </main>
  )
}
