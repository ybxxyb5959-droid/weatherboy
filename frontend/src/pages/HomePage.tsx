import { useEffect, useState, type ReactNode } from 'react'
import HandText from '../components/HandText'
import StickPerson from '../components/StickPerson'
import ClothingDoodle from '../components/ClothingDoodle'
import DoodleButton from '../components/DoodleButton'
import { blockLabels, useHomeLayout, type BlockId } from '../lib/homeLayout'
import CommuteLine from '../components/CommuteLine'
import GearDoodles, { type GearKind } from '../components/GearDoodles'
import FeedbackCard from '../components/FeedbackCard'
import { feedbackDueAt, firstSeenToday, getFeedbackDone, setFeedbackDone } from '../lib/feedbackTiming'
import LocationBar from '../components/LocationBar'
import HourlyChart from '../components/HourlyChart'
import DailyForecast from '../components/DailyForecast'
import { WeatherDoodle } from '../components/DoodleWeather'
import { categories } from '../mocks/clothes'
import { api, ApiError, errorMessage } from '../api'
import { useAsync } from '../hooks'
import type { Routine } from '../store'
import type { ApiRecommendation, ApiWeather, Favorite, Target } from '../types'

export default function HomePage() {
  const [target, setTarget] = useState<Target>({ kind: 'home' })
  const [notice, setNotice] = useState('')
  const [savingFav, setSavingFav] = useState(false)

  // 보고 있는 지역에 따라 날씨/추천 요청의 쿼리가 달라진다 (기본 위치면 쿼리 없음)
  const qs = target.kind === 'fav' ? `?favoriteId=${target.id}` : target.kind === 'place' ? `?place=${encodeURIComponent(target.name)}` : ''
  const weather = useAsync(() => api<ApiWeather>('GET', `/api/weather/today${qs}`), qs)
  const recommendation = useAsync(() => api<ApiRecommendation>('GET', `/api/recommendations/today${qs}`), qs)
  const settings = useAsync(() => api<{ location: string; routine?: Routine }>('GET', '/api/settings'))
  const favorites = useAsync(() => api<Favorite[]>('GET', '/api/favorites'))
  const favList = favorites.data ?? []

  const [showWhy, setShowWhy] = useState(false)
  const [editing, setEditing] = useState(false)
  const layout = useHomeLayout()
  const [showDetail, setShowDetail] = useState(false)
  const [altIdx, setAltIdx] = useState(-1) // -1 = 기본 추천
  const [feedback, setFeedback] = useState('')
  const [feedbackMsg, setFeedbackMsg] = useState('')
  // 오늘 처음 확인한 시각에서 일정 시간이 지나야 후기 카드가 뜬다
  const [firstSeen] = useState(firstSeenToday)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  // 지역을 바꾸면 이전 지역에서 하던 선택(대안/이유/그림 미리보기)은 초기화
  const go = (t: Target) => {
    setTarget(t)
    setNotice('')
    setAltIdx(-1)
    setShowWhy(false)
    setShowDetail(false)
  }

  const toggleSaved = async () => {
    if (target.kind === 'home') return
    setSavingFav(true)
    setNotice('')
    try {
      if (target.kind === 'fav') {
        await api('DELETE', `/api/favorites/${target.id}`)
        setTarget({ kind: 'place', name: target.name })
      } else {
        const existing = favList.find((f) => f.name === target.name)
        if (existing) {
          await api('DELETE', `/api/favorites/${existing.id}`)
        } else {
          const created = await api<Favorite>('POST', '/api/favorites', { name: target.name })
          setTarget({ kind: 'fav', id: created.id, name: created.name })
        }
      }
      favorites.reload()
    } catch (e) {
      setNotice(errorMessage(e))
    } finally {
      setSavingFav(false)
    }
  }

  const removeFavorite = async (f: Favorite) => {
    setNotice('')
    try {
      await api('DELETE', `/api/favorites/${f.id}`)
      if (target.kind === 'fav' && target.id === f.id) setTarget({ kind: 'place', name: f.name })
      favorites.reload()
    } catch (e) {
      setNotice(errorMessage(e))
    }
  }

  const header = (
    <div className="page-head">
      <LocationBar
        homeName={settings.data?.location ?? '내 위치'}
        target={target}
        favorites={favList}
        onHome={() => go({ kind: 'home' })}
        onFavorite={(f) => go({ kind: 'fav', id: f.id, name: f.name })}
        onPlace={(name) => go({ kind: 'place', name })}
        onToggleSaved={() => void toggleSaved()}
        onRemoveFavorite={(f) => void removeFavorite(f)}
        saving={savingFav}
      />
    </div>
  )

  const w = weather.data
  const rec = recommendation.data

  if (weather.loading || recommendation.loading) {
    return (
      <main className="home">
        {header}
        {notice && <p role="alert">{notice}</p>}
        <p>날씨 보는 중…</p>
      </main>
    )
  }

  if (!w || !rec) {
    return (
      <main className="home">
        {header}
        {notice && <p role="alert">{notice}</p>}
        <div className="empty">
          <StickPerson mood="empty" size={140} />
          <p role="alert">{weather.error ?? recommendation.error ?? '정보를 불러오지 못했어요.'}</p>
          <div className="row">
            <button
              type="button"
              className="dbtn w1"
              onClick={() => {
                weather.reload()
                recommendation.reload()
              }}
            >
              다시 시도
            </button>
            {target.kind !== 'home' && (
              <button type="button" className="dbtn w2" onClick={() => go({ kind: 'home' })}>
                내 위치로
              </button>
            )}
          </div>
        </div>
      </main>
    )
  }

  const items = altIdx < 0 ? rec.items : (rec.alternatives[altIdx] ?? rec.items)
  // 지금 보여주는 조합(기본/대안)을 캐릭터가 그대로 입는다
  const pick = (types: string[]) => items.find((it) => types.includes(it.type))
  const wear = {
    top: pick(categories[0]!.types),
    bottom: pick(categories[1]!.types),
    outer: pick([...categories[2]!.types, ...categories[3]!.types]),
  }

  const recId = rec.id
  // 준비물: 필요한 것만. 선크림은 해가 강한 날(맑음/폭염/자외선)에만.
  const gear: GearKind[] = []
  if (rec.needUmbrella) gear.push('umbrella')
  if (rec.needMask) gear.push('mask')
  if (['clear', 'heat', 'uv'].includes(w.condition)) gear.push('sunscreen')
  const sendFeedback = async (f: '추웠어요' | '딱 좋아요' | '더웠어요') => {
    if (!recId) return
    setFeedbackMsg('')
    try {
      await api('POST', `/api/recommendations/${recId}/feedback`, { rating: f })
      setFeedback(f)
      setFeedbackDone(recId, f)
      setFeedbackMsg('알려줘서 고마워요. 다음엔 더 잘 고를게요.')
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setFeedback(f)
        setFeedbackDone(recId, f)
        setFeedbackMsg('오늘 추천은 이미 알려줬어요. 고마워요!')
      } else {
        setFeedbackMsg(errorMessage(e))
      }
    }
  }

  // 후기는 저장되는 추천(내 위치)에만 붙는다. 첫 확인 후 시간이 지났고 아직 안 남겼을 때만 뜬다. 숨김과 상관없이 추천 카드 앞에 붙는다.
  const feedbackCard = (
    <>
      {recId && (feedback || now >= feedbackDueAt(firstSeen, settings.data?.routine)) && (!getFeedbackDone(recId) || feedback) && (
        <FeedbackCard selected={feedback} message={feedbackMsg} onPick={(f) => void sendFeedback(f)} />
      )}
    </>
  )

  // 하루 패턴이 있으면 외출/귀가 시간을 시간대별 그래프에 표시한다. 외출하지 않는 요일은 제외.
  const routine = settings.data?.routine
  const commuteMarks: { hour: number; label: string }[] = []
  if (routine && routine.days.includes(new Date().getDay())) {
    if (routine.outAt) commuteMarks.push({ hour: Number(routine.outAt.split(':')[0]), label: '외출' })
    if (routine.homeAt) commuteMarks.push({ hour: Number(routine.homeAt.split(':')[0]), label: '귀가' })
  }

  const blocks: Record<BlockId, ReactNode> = {
    weather: (
      <>
      <section className="section weather">
        <div>
          <div className="tiny">{w.location}</div>
          <div className="big">{w.temp}°C</div>
          <div>지금 체감 {w.feels}°C</div>
          <ul>
            <li>비 {w.rainChance}%</li>
            <li>바람 {w.wind.label}</li>
            <li>미세먼지 {w.dust?.grade ?? '정보 없음'}</li>
          </ul>
          {w.stale && <p className="tiny">최신 예보를 못 받아서 이전 예보를 보여줘요</p>}
        </div>
        <div className="weather-btn">
          <WeatherDoodle kind={w.condition} size={96} />
        </div>
      </section>

      <div className="weather-foot">
        <GearDoodles items={gear} />
        <button type="button" className="detail-toggle" aria-expanded={showDetail} onClick={() => setShowDetail((v) => !v)}>
          {showDetail ? '접기 ▴' : '자세히 ▾'}
        </button>
      </div>
      {showDetail && (
        <div className="box w3 detail">
          <dl>
            <dt>바람</dt>
            <dd>{w.wind.speed} m/s ({w.wind.label})</dd>
            <dt>미세먼지</dt>
            <dd>
              {w.dust
                ? `PM10 ${w.dust.pm10 ?? '-'} ㎍/㎥ · PM2.5 ${w.dust.pm25 ?? '-'} ㎍/㎥ (${w.dust.grade ?? '정보 없음'})`
                : '정보 없음'}
            </dd>
            <dt>오늘 기온</dt>
            <dd>{w.tempMin != null && w.tempMax != null ? `최저 ${w.tempMin}° / 최고 ${w.tempMax}°` : '정보 없음'}</dd>
            <dt>체감온도</dt>
            <dd>
              {w.feels}°C{w.feels < w.temp ? ' (바람·습도 때문에 더 쌀쌀해요)' : w.feels > w.temp ? ' (습해서 더 덥게 느껴져요)' : ''}
            </dd>
            <dt>비 올 확률</dt>
            <dd>{w.rainChance}%</dd>
            {w.humidity != null && (
              <>
                <dt>습도</dt>
                <dd>{w.humidity}%</dd>
              </>
            )}
          </dl>
        </div>
      )}

      <hr className="scribble" />

      </>
    ),
    character: (
      <section className="speech">
        <StickPerson mood="stand" size={165} wear={wear} umbrella={rec.needUmbrella} />
        <div className="say">
          <HandText>{rec.headline}</HandText>
          <br />
          <HandText>{rec.sub}</HandText>
        </div>
      </section>

    ),
    // 외출 시간은 내 위치 기준이라, 다른 지역을 구경 중일 땐 숨긴다
    commute: target.kind === 'home' ? <CommuteLine hourly={w.hourly ?? []} routine={routine} /> : null,
    recommend: (
      <section className="section">
        <h2>{target.kind === 'home' ? '오늘 추천' : `${w.location} 추천`}</h2>
        <hr className="scribble under-title" />
        <div className="outfit">
          {items.map((it, i) => (
            <div key={`${it.type}-${it.clothingId ?? it.label}-${i}`} className="row">
              {i > 0 && <span className="plus">+</span>}
              <div className="piece">
                <ClothingDoodle type={it.type} color={it.color} pattern={it.pattern} size={100} />
                <div>{it.label}</div>
              </div>
            </div>
          ))}
        </div>
        {rec.insufficientWardrobe && <p className="tiny">옷장에 딱 맞는 옷이 부족해서 가장 가까운 조합이에요</p>}
        {items.some((it) => !it.owned) && <p className="tiny">옷장에 없는 옷이 섞여 있어요 (일반 추천)</p>}
        <div className="row stretch" style={{ marginTop: 14 }}>
          <DoodleButton seed={0} className="sketchy" selected={showWhy} onClick={() => setShowWhy((s) => !s)}>
            추천 이유
          </DoodleButton>
          <DoodleButton seed={2} className="sketchy" onClick={() => setAltIdx((i) => (i + 1 >= rec.alternatives.length ? -1 : i + 1))}>
            다른 조합 보기
          </DoodleButton>
        </div>
        {showWhy && (
          <div className="box w2 why">
            <ul>
              {rec.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
              {rec.aiExplanation && <li>{rec.aiExplanation}</li>}
            </ul>
          </div>
        )}
      </section>

    ),
    hourly: w.hourly && w.hourly.length > 0 && (
        <section className="section">
          <h2>시간대별 날씨</h2>
          <HourlyChart data={w.hourly} marks={commuteMarks} />
        </section>
      ),
    daily: w.daily && w.daily.length > 0 && <DailyForecast data={w.daily} today={{ tempMin: w.tempMin, tempMax: w.tempMax, condition: w.condition, rainChance: w.rainChance }} />,
  }

  return (
    <main className="home">
      {header}
      {notice && <p role="alert">{notice}</p>}

      {layout.order.map((id, idx) => {
        const hidden = layout.hidden.includes(id)
        if (hidden && !editing) return id === 'recommend' ? <div key={id}>{feedbackCard}</div> : null
        return (
          <div key={id} className={editing ? `edit-block${hidden ? ' off' : ''}` : undefined}>
            {editing && (
              <div className="edit-bar">
                <span>{blockLabels[id]}</span>
                <span className="row">
                  <button type="button" className="mini" disabled={idx === 0} onClick={() => layout.move(id, -1)} aria-label={`${blockLabels[id]} 위로`}>▲</button>
                  <button type="button" className="mini" disabled={idx === layout.order.length - 1} onClick={() => layout.move(id, 1)} aria-label={`${blockLabels[id]} 아래로`}>▼</button>
                  <button type="button" className="mini" onClick={() => layout.toggleHidden(id)}>{hidden ? '보이기' : '숨기기'}</button>
                </span>
              </div>
            )}
            {id === 'recommend' && feedbackCard}
            {blocks[id]}
          </div>
        )
      })}

      <div className="edit-foot">
        {editing && (
          <button type="button" className="detail-toggle" onClick={layout.reset}>
            처음대로
          </button>
        )}
        <DoodleButton seed={3} className="sketchy small" onClick={() => setEditing((v) => !v)}>
          {editing ? '편집 완료' : '홈 카드 편집'}
        </DoodleButton>
      </div>
      {!recId && (
        <p className="tiny" style={{ marginTop: 18 }}>
          다른 지역을 구경하는 중이에요. 추천 후기는 내 위치에서 남길 수 있어요.
        </p>
      )}
    </main>
  )
}
