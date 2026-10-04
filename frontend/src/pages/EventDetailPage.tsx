import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import EventMenu from '../components/EventMenu'
import EventStylist from '../components/EventStylist'
import { feel } from '../lib/styleText'
import HandText from '../components/HandText'
import ClothingDoodle from '../components/ClothingDoodle'
import { eventMood } from '../lib/eventMood'
import StickPerson from '../components/StickPerson'
import { dDay, formatRange, statusLabel } from '../mocks/events'
import type { PlanEvent } from '../mocks/events'
import { api, ApiError } from '../api'
import { useAsync } from '../hooks'
import { genericColor } from '../lib/genericColor'
import type { EventDayOutfit, EventDayWeather, EventOutfit } from '../types'

const steps = [
  { d: 'D-10', t: '예보 시작' },
  { d: 'D-3', t: '상세 예보' },
  { d: 'D-1', t: '최종 확인' },
]

// 예보가 열리기 전에 보여주는 예시 (실제 추천이 아니다)
const sample = [
  { type: '긴팔', color: '베이지', pattern: '무지', label: '긴팔' },
  { type: '바람막이', color: '초록', pattern: '무지', label: '바람막이' },
  { type: null, color: '', pattern: '무지', label: '우산' },
]

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
const dayLabel = (date: string) => {
  const [, m, d] = date.split('-').map(Number)
  return `${m}/${d} (${WEEKDAY[new Date(`${date}T00:00:00`).getDay()]})`
}

/** 일정 기간의 날씨: 하루씩, 아침/낮/저녁 기온과 비 소식. 먼 날짜는 최저/최고만 보여준다. */
function EventWeather({ days, approx }: { days: EventDayWeather[]; approx: boolean }) {
  return (
    <section className="section">
      <h2>일정 날씨</h2>
      <div className="ev-weather">
        {days.map((d) => (
          <div key={d.date} className="box w2 ev-day">
            <div className="ev-day-head">
              <b>{dayLabel(d.date)}</b>
              <span className="tiny">
                최저 {d.tempMin}° · 최고 {d.tempMax}°{d.pop >= 30 || d.rain ? ` · 비 ${d.pop}%` : ''}
              </span>
            </div>
            {d.slots ? (
              <div className="ev-slots">
                {(
                  [
                    ['아침', d.slots.morning],
                    ['낮', d.slots.afternoon],
                    ['저녁', d.slots.evening],
                  ] as const
                ).map(([label, slot]) => (
                  <div key={label} className="ev-slot">
                    <span className="tiny">{label}</span>
                    <b>{slot ? `${slot.temp}°` : '-'}</b>
                    {slot && slot.feels !== slot.temp && <span className="tiny">체감 {slot.feels}°</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="tiny">아직 먼 날짜라 하루 최저·최고만 알 수 있어요.</p>
            )}
          </div>
        ))}
      </div>
      {approx && <p className="tiny">대략적인 예보예요. 가까워지면 아침·낮·저녁 기온으로 다시 알려줄게요.</p>}
    </section>
  )
}

/** 며칠짜리 일정: 날마다 그날 날씨에 맞춰 다른 옷으로 고른 코디 */
function DayOutfits({ days }: { days: EventDayOutfit[] }) {
  return (
    <section className="section">
      <h2>날짜별 코디</h2>
      <p className="tiny">같은 옷을 며칠 내내 입지 않도록 날마다 다르게 골랐어요. 옷장에 옷이 적으면 겹칠 수 있어요.</p>
      <div className="day-outfits">
        {days.map((d, i) => (
          <div key={d.date} className={`box w${(i % 3) + 1} day-outfit`}>
            <div className="ev-day-head">
              <b>{i + 1}일차 · {dayLabel(d.date)}</b>
              <span className="tiny">{d.headline}</span>
            </div>
            <div className="day-pieces">
              {d.items.map((it) => (
                <div key={`${it.type}-${it.clothingId ?? it.label}`} className="piece">
                  <ClothingDoodle type={it.type} color={it.owned ? it.color : genericColor(it.type, d.date)} pattern={it.pattern} size={58} />
                  <div className="tiny">{it.label}</div>
                </div>
              ))}
              {d.needUmbrella && (
                <div className="piece">
                  <Umbrella size={58} />
                  <div className="tiny">우산</div>
                </div>
              )}
            </div>
            <p className="tiny">
              {d.sub}
              {d.needMask ? ' · 마스크도 챙겨요' : ''}
              {d.notes[0] ? ` · ${d.notes[0]}` : ''}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Umbrella({ size = 86 }: { size?: number }) {
  return (
    <svg className="doodle" width={size} height={size} viewBox="0 0 100 100" fill="none" stroke="#222" strokeWidth="2.4" strokeLinecap="round" aria-label="우산" role="img">
      <path d="M10 52 Q50 -10 90 52 Q80 45 70 52 Q60 45 50 52 Q40 45 30 52 Q20 45 10 52Z" fill="#cfe6e2" />
      <path d="M50 52 V84 Q50 92 42 90" />
    </svg>
  )
}

export default function EventDetailPage() {
  const { id } = useParams()
  return <EventDetail key={id} id={id ?? ''} />
}

function EventDetail({ id }: { id: string }) {
  const nav = useNavigate()
  const justSaved = (useLocation().state as { saved?: 'created' | 'edited' } | null)?.saved
  const ev = useAsync(() => api<PlanEvent>('GET', `/api/events/${id}`))
  const outfit = useAsync(() => api<EventOutfit>('GET', `/api/events/${id}/outfit`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }))
  const e = ev.data

  if (ev.loading) return <main><p>불러오는 중…</p></main>
  if (!e) {
    return (
      <main className="empty">
        <StickPerson mood="empty" size={140} />
        <p>{ev.error && !ev.error.includes('찾을 수') ? ev.error : '그런 일정은 없어요'}</p>
        <Link to="/events" className="dbtn w1" style={{ marginTop: 12 }}>
          <HandText>일정으로</HandText>
        </Link>
      </main>
    )
  }

  const rec = outfit.data?.status === 'ready' ? outfit.data.recommendation : null
  const waiting = !rec
  const left = dDay(e.startDate)
  const approx = outfit.data?.forecastStage === 'MIDTERM'
  const days = outfit.data?.days ?? []
  const styleLabel = outfit.data?.styleLabel ?? null
  // 코디 도우미의 캐릭터가 입는 옷: 지금 일정에 보이는 코디
  const stylistItems = rec ? rec.items.map((it) => (it.owned ? it : { ...it, color: genericColor(it.type, e.startDate) })) : []

  return (
    <main>
      <BackButton to="/events" label="일정 목록으로" />
      {justSaved && (
        <div className="box w3 saved-note" role="status">
          <b>{justSaved === 'created' ? '✓ 일정을 등록했어요' : '✓ 일정을 고쳤어요'}</b>
          <Link to="/events" className="dbtn w1 small">
            <HandText>내 일정 보기</HandText>
          </Link>
        </div>
      )}
      <div className="page-head detail-head">
        <div>
          <h1>{e.title}</h1>
          <p style={{ marginTop: 6 }}>
            {formatRange(e)}
            {e.place && <> · {e.place}</>}
          </p>
          <p className="tiny">
            {e.startTime} ~ {e.endTime} · {e.kind} {left >= 0 ? `· D-${left}` : ''}
          </p>
        </div>
        <EventMenu event={e} onDeleted={() => nav('/events', { replace: true })} />
      </div>

      <div className="box w1">
        <div className="row between">
          <div>
            <h2>{statusLabel[waiting ? 'waiting' : 'ready']}</h2>
            {waiting ? (
              <>
                <p>{outfit.data?.message ?? '아직 정확한 예보가 없어요.'}</p>
                <p>예보가 열리면 알려드릴게요.</p>
              </>
            ) : (
              <>
                <p>예보가 확인되어 옷차림을 만들었어요.</p>
                {approx && <p className="tiny">아직 먼 날짜라 대략적인 예보예요. 가까워지면 다시 맞춰줄게요.</p>}
              </>
            )}
          </div>
          <StickPerson mood={eventMood(e.kind, waiting, e.title, e.place)} size={96} />
        </div>
      </div>

      <section className="section">
        <div className="timeline">
          {steps.map((s, i) => (
            <div key={s.d} className="contents-wrap" style={{ display: 'contents' }}>
              <div className="step">
                <b>{s.d}</b>
                <span>{s.t}</span>
              </div>
              {i < steps.length - 1 && (
                <svg className="doodle arrow" width="34" height="20" viewBox="0 0 34 20" fill="none" stroke="#222" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M2 11 Q16 6 30 10 M24 4 L31 10 L23 16" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </section>

      <hr className="scribble" />

      {!waiting && outfit.data?.weather && outfit.data.weather.length > 0 && <EventWeather days={outfit.data.weather} approx={approx} />}

      {!waiting && days.length >= 2 && <DayOutfits days={days} />}

      {(waiting || days.length < 2) && (
      <section className="section">
        <h2>{waiting ? '예보가 열리면 이렇게 보여드려요' : '이렇게 입어요'}</h2>
        <div className="box w3 outfit">
          {waiting
            ? sample.map((s, i) => (
                <div key={s.label} className="row">
                  {i > 0 && <span className="plus">+</span>}
                  <div className="piece">
                    {s.type ? <ClothingDoodle type={s.type} color={s.color} pattern={s.pattern} size={78} /> : <Umbrella />}
                    <div>{s.label}</div>
                  </div>
                </div>
              ))
            : [
                ...rec.items.map((it) => ({ key: `${it.type}-${it.clothingId ?? it.label}`, type: it.type as string | null, color: it.owned ? it.color : genericColor(it.type, e.startDate), pattern: it.pattern, label: it.label })),
                ...(rec.needUmbrella ? [{ key: 'umbrella', type: null, color: '', pattern: '무지', label: '우산' }] : []),
              ].map((s, i) => (
                <div key={s.key} className="row">
                  {i > 0 && <span className="plus">+</span>}
                  <div className="piece">
                    {s.type ? <ClothingDoodle type={s.type} color={s.color} pattern={s.pattern} size={78} /> : <Umbrella />}
                    <div>{s.label}</div>
                  </div>
                </div>
              ))}
        </div>
        {!waiting && (
          <p className="tiny" style={{ marginTop: 8 }}>
            {styleLabel ? `${feel(styleLabel)} · ` : ''}
            {rec.headline} · {rec.sub}
            {rec.needMask ? ' · 마스크도 챙겨요' : ''}
          </p>
        )}
        {!waiting && (outfit.data?.situationNotes ?? []).map((n) => (
          <p key={n} className="tiny">
            {n}
          </p>
        ))}
        {outfit.error && <p className="tiny" role="alert">{outfit.error}</p>}
        <div className="row between" style={{ marginTop: 6 }}>
          <p className="tiny">{waiting ? (styleLabel ? `(예시예요. 예보가 열리면 ${feel(styleLabel)}으로 골라드려요)` : '(예시예요)') : ''}</p>
          <StickPerson mood="trip" size={70} />
        </div>
      </section>
      )}

      <EventStylist eventId={e.id} items={stylistItems} style={outfit.data?.style ?? null} styleLabel={outfit.data?.styleLabel ?? null} fillItems={(its) => its.map((it) => (it.owned ? it : { ...it, color: genericColor(it.type, e.startDate) }))} onChanged={outfit.reload} />
    </main>
  )
}
