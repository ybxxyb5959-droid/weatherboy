import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import EventMenu from '../components/EventMenu'
import EventStylist from '../components/EventStylist'
import { feel } from '../lib/styleText'
import HandText from '../components/HandText'
import ClothingDoodle from '../components/ClothingDoodle'
import { eventMood } from '../lib/eventMood'
import StickPerson from '../components/StickPerson'
import { WeatherDoodle } from '../components/DoodleWeather'
import UmbrellaDoodle from '../components/UmbrellaDoodle'
import { dDay, formatRange, statusLabel } from '../mocks/events'
import type { PlanEvent } from '../mocks/events'
import { useState } from 'react'
import DoodleButton from '../components/DoodleButton'
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
            <div className="ev-wday-head">
              <div className="ev-wday-main">
                <b>{dayLabel(d.date)}</b>
                <span className="ev-temps">
                  <span className="t-min">최저 {d.tempMin}°</span>
                  <span className="t-max">최고 {d.tempMax}°</span>
                </span>
              </div>
              <div className="ev-wday-icon">
                <WeatherDoodle kind={d.condition ?? (d.rain ? 'rain' : 'partly')} size={40} />
                {(d.pop >= 30 || d.rain) && <span className="tiny wpop">{d.pop}%</span>}
              </div>
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
              <p className="tiny">변동될 수 있어요.</p>
            )}
          </div>
        ))}
      </div>
      {approx && <p className="tiny ev-note">대략적인 예보예요. 가까워지면 아침·낮·저녁 기온으로 다시 알려줄게요.</p>}
    </section>
  )
}

/** 며칠짜리 일정: 날마다 그날 날씨에 맞춰 다른 옷으로 고른 코디 */
function DayOutfits({ days, reuse, onReuse, examples, onExamples, busy }: { days: EventDayOutfit[]; reuse: { top: boolean; bottom: boolean }; onReuse: (r: { top: boolean; bottom: boolean }) => void; examples: boolean; onExamples: (on: boolean) => void; busy: boolean }) {
  const needExamples = days.some((d) => d.canViewExamples)
  // 실제로 겹친 날이 있으면 "다르게 골랐어요"라고만 말하지 않는다
  const overlapped = days.some((d) => (d.overlapSlots?.length ?? 0) > 0)
  const reusing = reuse.top || reuse.bottom
  return (
    <section className="section">
      <h2>날짜별 코디</h2>
      <p className="tiny">
        {overlapped ? '옷장에 옷이 적어서 겹치는 옷이 있어요. 아래 날짜별 안내를 확인해 보세요.' : reusing ? '고른 자리는 같은 옷을 다시 입을 수 있게 골랐어요.' : '날마다 다른 옷으로 골랐어요.'}
      </p>
      <div className="row wrap" style={{ marginTop: 6 }}>
        <span className="tiny">옷 돌려입기</span>
        <DoodleButton seed={0} className="small" selected={reuse.top} disabled={busy} onClick={() => onReuse({ ...reuse, top: !reuse.top })}>
          상의
        </DoodleButton>
        <DoodleButton seed={1} className="small" selected={reuse.bottom} disabled={busy} onClick={() => onReuse({ ...reuse, bottom: !reuse.bottom })}>
          하의
        </DoodleButton>
      </div>
      {(needExamples || examples) && (
        <div className="row wrap" style={{ marginTop: 6 }}>
          <span className="tiny">{examples ? '예시 옷으로 입어본 모습이에요.' : '내 옷만으로는 날씨에 모자란 날이 있어요.'}</span>
          <DoodleButton seed={2} className="small" selected={examples} disabled={busy} onClick={() => onExamples(!examples)}>
            {examples ? '내 옷으로 돌아가기' : '예시로 보기'}
          </DoodleButton>
        </div>
      )}
      <div className="day-outfits">
        {days.map((d, i) => (
          <div key={d.date} className={`box w${(i % 3) + 1} day-outfit`} style={{ ['--i' as string]: i }}>
            <div className="ev-day-head">
              <b>{i + 1}일차 · {dayLabel(d.date)}</b>
              <span className="tiny">{d.headline}</span>
            </div>
            {d.requestLabel && <p className="tiny">적용 조건: {d.requestLabel}</p>}
            <div className="day-pieces">
              {d.items.map((it) => (
                <div key={`${it.type}-${it.clothingId ?? it.label}`} className="piece">
                  <ClothingDoodle type={it.type} color={it.owned || it.example ? it.color : genericColor(it.type, d.date)} pattern={it.pattern} size={58} />
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
            </p>
            {d.notes.map((n) => (
              <p key={n} className="tiny">
                {n}
              </p>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

const Umbrella = UmbrellaDoodle

export default function EventDetailPage() {
  const { id } = useParams()
  return <EventDetail key={id} id={id ?? ''} />
}

function EventDetail({ id }: { id: string }) {
  const nav = useNavigate()
  const justSaved = (useLocation().state as { saved?: 'created' | 'edited' } | null)?.saved
  const ev = useAsync(() => api<PlanEvent>('GET', `/api/events/${id}`))
  // 연박: 눌렀을 때만 그 자리의 옷을 날짜 사이에 다시 입을 수 있게 한다(겉옷은 항상 겹침을 피한다)
  const [reuse, setReuse] = useState({ top: false, bottom: false })
  const [examples, setExamples] = useState(false) // [예시로 보기]: 내 옷이 날씨에 부족할 때만 보인다
  const outfit = useAsync(() => api<EventOutfit>('GET', `/api/events/${id}/outfit?reuseTop=${reuse.top ? 1 : 0}&reuseBottom=${reuse.bottom ? 1 : 0}&examples=${examples ? 1 : 0}`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }), `${reuse.top}${reuse.bottom}${examples}`)
  const e = ev.data
  const [stylistOn, setStylistOn] = useState<boolean | null>(null) // 코디 도우미가 이 일정에 나오는가(모르면 null)
  const [stylistBase, setStylistBase] = useState(false) // 코디 도우미가 코디 카드를 직접 보여주는 중인가(느낌을 고른 뒤)

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
  // 요청이 실패한 것과 예보가 아직 없는 것은 다르다: 실패하면 재시도를 안내한다
  const failed = waiting && !!outfit.error && !outfit.data
  // 예보가 아직 없다고 확정된 상태(불러오는 중·실패는 아님): 코디 도우미(캐릭터·칩·입력창)는 숨기고 예보가 열린 뒤에 보여준다
  const forecastWaiting = waiting && !outfit.loading && !failed
  const left = dDay(e.startDate)
  const approx = outfit.data?.forecastStage === 'MIDTERM'
  const days = outfit.data?.days ?? []
  // 하루 일정은 추천 옷 목록을 항상 보여준다: 도우미가 없거나, 도우미가 아직 카드를 안 펼쳤을 때(느낌을 고르기 전)
  const showPlainOutfit = !waiting && days.length < 2 && (stylistOn === false || (stylistOn === true && !stylistBase))
  const styleLabel = outfit.data?.styleLabel ?? null
  // 코디 도우미의 캐릭터가 입는 옷: 지금 일정에 보이는 코디
  const stylistItems = rec ? rec.items.map((it) => (it.owned || it.example ? it : { ...it, color: genericColor(it.type, e.startDate) })) : []

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
            <h2>{failed ? '불러오지 못했어요' : statusLabel[waiting ? 'waiting' : 'ready']}</h2>
            {failed ? (
              <>
                <p>{outfit.error}</p>
                <p>예보가 없는 게 아니라 서버에서 못 받아왔어요.</p>
                <DoodleButton seed={1} className="small" onClick={outfit.reload}>
                  다시 시도
                </DoodleButton>
              </>
            ) : waiting ? (
              <>
                <p>{outfit.data?.message ?? '아직 정확한 예보가 없어요.'}</p>
                <p>예보가 열리면 옷을 골라드릴게요. 그때 다시 열어 보세요.</p>
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

      {(forecastWaiting || showPlainOutfit) && (
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

      {!waiting && <EventStylist eventId={e.id} rec={rec ? { ...rec, items: stylistItems } : null} style={outfit.data?.style ?? null} styleLabel={outfit.data?.styleLabel ?? null} notes={outfit.data?.situationNotes} onApplicable={setStylistOn} onBase={setStylistBase} topRule={!waiting && (outfit.data?.weather?.length ?? 0) > 0} multiDay={days.length >= 2} fillItems={(its) => its.map((it) => (it.owned || it.example ? it : { ...it, color: genericColor(it.type, e.startDate) }))} onChanged={outfit.reload} />}

      {!waiting && days.length >= 2 && <DayOutfits key={outfit.data?.style ?? 'none'} days={days} reuse={reuse} onReuse={setReuse} examples={examples} onExamples={setExamples} busy={outfit.loading} />}
    </main>
  )
}
