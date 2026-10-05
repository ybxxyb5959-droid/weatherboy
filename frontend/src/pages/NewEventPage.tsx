import { useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import DoodleButton, { ChoiceRow } from '../components/DoodleButton'
import DatePicker from '../components/DatePicker'
import TimePicker from '../components/TimePicker'
import SayBox from '../components/SayBox'
import { eventKinds, formatRange } from '../mocks/events'
import { markEventFx } from '../lib/eventFx'
import type { EventKind, PlanEvent } from '../mocks/events'
import { api, errorMessage } from '../api'
import type { EventSuggestion } from '../lib/ai'
import { parseEventText, type EventDraft } from '../lib/eventParse'

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

/** 말로 적기가 채우는 칸 */
type Field = 'kind' | 'title' | 'date' | 'span' | 'place' | 'start' | 'end'
/** 칸에 넣을 값. kind 가 null 이면 종류는 건드리지 않는다 */
type Filled = Omit<EventDraft, 'kind' | 'kindFound'> & { kind: EventKind | null }

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

  // 사용자가 직접 고친 칸. 말로 적기가 다시 채울 때 이 칸은 덮어쓰지 않는다.
  const [touched, setTouched] = useState<Set<Field>>(() => new Set())
  const touch = (f: Field) => setTouched((t) => (t.has(f) ? t : new Set(t).add(f)))

  const changeKind = (k: EventKind) => setKind(k)

  // 해석한 결과를 칸에 넣는다(직접 고친 칸은 그대로). 제안일 뿐이라 사용자가 확인하고 저장한다.
  const apply = (d: Filled) => {
    const k = d.kind ?? kind
    if (d.kind && !touched.has('kind')) changeKind(d.kind)
    if (d.title && !touched.has('title')) setTitle(d.title)
    if (d.startDate && !touched.has('date')) setDate(d.startDate)
    if (d.place && !touched.has('place')) setPlace(d.place)
    if (MULTI_DAY.includes(k) && d.startDate && !touched.has('span')) {
      const n = d.endDate ? dayNumber(d.endDate) - dayNumber(d.startDate) : (d.nights ?? null)
      if (n !== null && NIGHT_CHOICES.includes(n)) setNights(n)
      else if (n !== null && d.endDate) {
        setNights(null)
        setCustomEnd(d.endDate)
      }
    }
    if (!MULTI_DAY.includes(k)) {
      if (d.startTime && !touched.has('start')) setStartTime(d.startTime)
      if (d.endTime && !touched.has('end')) setEndTime(d.endTime)
    }
  }

  const today = new Date().toLocaleDateString('sv-SE')

  // 글로 적을 때는 '채워줘'를 눌렀을 때만, 말로 할 때는 말이 끝난 뒤(SayBox 가 끝난 글로 한 번만 부른다)에만 채운다.
  // 규칙으로 날짜까지 알아들었으면 그걸로 끝. 날짜를 못 찾았을 때만 AI(제미나이)에게 묻는다.
  const fillFromText = async (spoken?: string) => {
    const text = (spoken ?? say).trim()
    if (thinking || text.length < 2) return
    setError('')
    const d = parseEventText(text, today)
    if (d.startDate) {
      apply(d)
      setAiNote('말한 대로 채웠어요. 맞는지 확인하고 저장해주세요.')
      return
    }
    setThinking(true)
    setAiNote('')
    try {
      const s = await api<EventSuggestion>('POST', '/api/ai/parse-event', { text })
      const k = (eventKinds as string[]).includes(s.kind) ? (s.kind as EventKind) : '기타'
      apply({ kind: k, title: s.title, startDate: s.startDate, endDate: s.endDate ?? null, nights: null, place: s.place, startTime: s.startTime ?? null, endTime: s.endTime ?? null })
      setAiNote('AI가 채웠어요. 맞는지 확인하고 저장해주세요.')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setThinking(false)
    }
  }

  const save = async () => {
    if (saving) return
    if (!title.trim() || !date || !place.trim()) {
      setError('제목, 날짜, 장소를 꼭 넣어줘')
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
        markEventFx(saved.id, { kind: 'edited', oldTitle: event.title, oldRange: formatRange(event) }) // 일정 탭에서 지우개로 지우고 다시 쓰는 연출
        nav(`/events/${saved.id}`, { replace: true, state: { saved: 'edited' } })
        return
      }
      const created = await api<PlanEvent>('POST', '/api/events', body)
      markEventFx(created.id, { kind: 'created' }) // 일정 탭에서 쪽지에 펜으로 쓰는 연출
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
        placeholder="예: 토요일 저녁 7시 강남역에서 엄마 생일"
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
        <ChoiceRow options={eventKinds} value={kind} onChange={(k) => { touch('kind'); changeKind(k) }} />
      </div>
      <div className="field">
        <label className="name" htmlFor="title">제목 (필수)</label>
        <input id="title" type="text" value={title} placeholder={kind === '캠핑' ? '예: 가평 캠핑' : kind === '등산' ? '예: 북한산 등산' : '예: 제주 여행'} onChange={(e) => { touch('title'); setTitle(e.target.value) }} />
      </div>
      <div className="field">
        <label className="name" htmlFor="date">{multi ? '출발 날짜 (필수)' : '날짜 (필수)'}</label>
        <DatePicker id="date" label={multi ? '출발 날짜' : '날짜'} value={date} onChange={(v) => { touch('date'); setDate(v) }} />
      </div>

      {multi && (
        <div className="field">
          <div className="name">일정</div>
          <div className="row wrap">
            {NIGHT_CHOICES.map((n, i) => (
              <DoodleButton key={n} seed={i} className="small" selected={nights === n} onClick={() => { touch('span'); setNights(n) }}>
                {nightsLabel(n)}
              </DoodleButton>
            ))}
            <DoodleButton seed={3} className="small" selected={nights === null} onClick={() => { touch('span'); setNights(null) }}>
              직접
            </DoodleButton>
          </div>
          {nights === null && (
            <div style={{ marginTop: 8 }}>
              <label className="name" htmlFor="end">돌아오는 날짜</label>
              <DatePicker id="end" label="돌아오는 날짜" value={customEnd} min={date || undefined} onChange={(v) => { touch('span'); setCustomEnd(v) }} />
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
        <label className="name" htmlFor="place">장소 (필수)</label>
        <input id="place" type="text" value={place} placeholder={kind === '등산' ? '예: 북한산' : '예: 제주도'} onChange={(e) => { touch('place'); setPlace(e.target.value) }} />
      </div>

      {!multi && (
        <div className="field">
          <div className="routine-row">
            <span className="routine-label">시작 시간</span>
            <TimePicker value={startTime} onChange={(v) => { touch('start'); setStartTime(v) }} label="시작" />
          </div>
          <div className="routine-row" style={{ marginTop: 10 }}>
            <span className="routine-label">종료 시간</span>
            <TimePicker value={endTime} onChange={(v) => { touch('end'); setEndTime(v) }} label="종료" />
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
