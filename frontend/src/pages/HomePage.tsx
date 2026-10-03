import { useEffect, useState, type ReactNode } from 'react'
import StickPerson from '../components/StickPerson'
import ClothingDoodle from '../components/ClothingDoodle'
import DoodleButton from '../components/DoodleButton'
import { blockLabels, useHomeLayout, type BlockId } from '../lib/homeLayout'
import CommuteLine from '../components/CommuteLine'
import GearDoodles, { type GearKind } from '../components/GearDoodles'
import FeedbackCard from '../components/FeedbackCard'
import ReviewLetter from '../components/ReviewLetter'
import { feedbackDueAt, firstSeenToday, getFeedbackDone, setFeedbackDone } from '../lib/feedbackTiming'
import { Link } from 'react-router-dom'
import { ShareIcon } from '../components/icons'
import LocationBar from '../components/LocationBar'
import HourlyChart from '../components/HourlyChart'
import DailyForecast from '../components/DailyForecast'
import { WeatherDoodle } from '../components/DoodleWeather'
import { categories } from '../mocks/clothes'
import { api, ApiError, errorMessage } from '../api'
import { useAsync } from '../hooks'
import { useCharacter } from '../lib/character'
import { genericColor } from '../lib/genericColor'
import { buildOutfitCard, shareImage } from '../lib/shareCard'
import { useAuth } from '../auth'
import type { Routine } from '../store'
import type { ApiRecommendation, ApiWeather, Favorite, Target } from '../types'

function dustGrade(v: number, [good, normal, bad]: [number, number, number]) {
  return v <= good ? '좋음' : v <= normal ? '보통' : v <= bad ? '나쁨' : '매우 나쁨'
}

/** 값이 어느 정도인지 보여주는 가로 게이지 (회색 바탕 + 검정 채움) */
function Gauge({ label, ratio, text }: { label: string; ratio: number | null; text: string }) {
  const pct = ratio == null ? 0 : Math.round(Math.min(1, Math.max(0, ratio)) * 100)
  return (
    <div className="gauge">
      <div className="gauge-head">
        <span className="gauge-label">{label}</span>
        <span className="gauge-text">{text}</span>
      </div>
      <div className="gauge-track" role="img" aria-label={`${label} ${text}`}>
        <div className="gauge-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function HomePage() {
  const [target, setTarget] = useState<Target>({ kind: 'home' })
  const [notice, setNotice] = useState('')
  const [savingFav, setSavingFav] = useState(false)
  const [sharing, setSharing] = useState(false)
  const { me } = useAuth()

  // 보고 있는 지역에 따라 날씨/추천 요청의 쿼리가 달라진다 (기본 위치면 쿼리 없음)
  const qs = target.kind === 'fav' ? `?favoriteId=${target.id}` : target.kind === 'place' ? `?place=${encodeURIComponent(target.name)}` : ''
  const weather = useAsync(() => api<ApiWeather>('GET', `/api/weather/today${qs}`), qs)
  const recommendation = useAsync(() => api<ApiRecommendation>('GET', `/api/recommendations/today${qs}`), qs)
  const settings = useAsync(() => api<{ location: string; routine?: Routine }>('GET', '/api/settings'))
  const favorites = useAsync(() => api<Favorite[]>('GET', '/api/favorites'))
  const favList = favorites.data ?? []
  // 내 캐릭터(칭호 소품 + 꾸미기): 캐릭터 화면에서 꾸민 그대로 홈의 졸라맨에도 입힌다
  const character = useCharacter().data
  const clothes = useAsync(() => api<unknown[]>('GET', '/api/clothes'))
  const closetEmpty = !clothes.loading && clothes.data != null && clothes.data.length === 0

  // AI 설명은 추천과 따로 만들어져서, 아직 없으면 잠시 뒤 조용히(화면을 비우지 않고) 다시 불러온다.
  const aiPending = !recommendation.loading && recommendation.data?.aiPending === true
  const setRecData = recommendation.setData
  useEffect(() => {
    if (!aiPending) return
    let tries = 0
    const t = setInterval(() => {
      tries++
      api<ApiRecommendation>('GET', `/api/recommendations/today${qs}`)
        .then((r) => {
          setRecData(r)
          if (!r.aiPending) clearInterval(t)
        })
        .catch(() => clearInterval(t))
      if (tries >= 8) clearInterval(t)
    }, 3000)
    return () => clearInterval(t)
  }, [aiPending, qs, setRecData])

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
      <ReviewLetter />
    </div>
  )

  const w = weather.data
  // 지역을 바꾸는 중에 이전 지역의 추천이 남아 보이지 않게, 불러오는 동안은 비운다
  const rec = recommendation.loading ? null : recommendation.data

  // 날씨만 있으면 날씨부터 보여준다. 추천이 늦거나 실패해도 날씨 화면은 막히지 않는다.
  if (weather.loading) {
    return (
      <main className="home">
        {header}
        {notice && <p role="alert">{notice}</p>}
        <p>날씨 보는 중…</p>
      </main>
    )
  }

  if (!w) {
    return (
      <main className="home">
        {header}
        {notice && <p role="alert">{notice}</p>}
        <div className="empty">
          <StickPerson mood="empty" size={140} />
          <p role="alert">{weather.error ?? '정보를 불러오지 못했어요.'}</p>
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

  // 옷장에 없는 옷(일반 추천)은 색을 따로 뽑아 보여준다
  const today = new Date().toDateString()
  const items = (rec ? (altIdx < 0 ? rec.items : (rec.alternatives[altIdx] ?? rec.items)) : []).map((it) => (it.owned ? it : { ...it, color: genericColor(it.type, today) }))
  // 지금 보여주는 조합(기본/대안)을 캐릭터가 그대로 입는다
  const pick = (types: string[]) => items.find((it) => types.includes(it.type))
  const wear = {
    top: pick(categories[0]!.types),
    bottom: pick(categories[1]!.types),
    outer: pick(categories[2]!.types),
  }

  // 오늘의 코디 카드를 이미지로 만들어 카카오톡 등으로 보낸다 (지금 보고 있는 지역과 조합 그대로)
  const shareOutfit = async () => {
    if (!rec || sharing) return
    setSharing(true)
    setNotice('')
    try {
      const card = await buildOutfitCard({
        location: w.location,
        temp: w.temp,
        feels: w.feels,
        rainChance: w.rainChance,
        condition: w.condition,
        headline: rec.headline,
        sub: rec.sub,
        items,
        wear,
        umbrella: rec.needUmbrella,
        persona: null, // 칭호 소품은 홈/공유 카드에 넣지 않는다. 내가 꾸민 것만 보인다
        accessories: character?.unlocked ? character.config : {},
        code: (me?.id ?? '').slice(0, 8).toUpperCase(),
        origin: window.location.origin,
      })
      const r = await shareImage(card, `${w.location} 오늘 ${w.temp}°C, 이렇게 입어! ${window.location.origin}`)
      if (r === 'downloaded') setNotice('이미지로 저장했어요. 카카오톡에서 사진으로 보내 보세요.')
    } catch (e) {
      setNotice(errorMessage(e))
    } finally {
      setSharing(false)
    }
  }

  const recId = rec?.id ?? null
  // 준비물: 필요한 것만. 선크림은 해가 강한 날(맑음/폭염/자외선)에만.
  const gear: GearKind[] = []
  if (rec?.needUmbrella) gear.push('umbrella')
  // 비가 아직 멀면(3시간 넘게 뒤) 캐릭터는 우산 없이 서 있고, 우산에는 "N시쯤 비"만 붙인다
  const rainHour = rec?.rainAt ? new Date(rec.rainAt) : null
  const rainSoon = !!rec?.needUmbrella && (!rainHour || rainHour.getTime() - Date.now() <= 3 * 3600_000)
  const gearNotes = rainHour && !rainSoon ? { umbrella: `${rainHour.toLocaleTimeString('ko-KR', { hour: 'numeric', hour12: false, timeZone: 'Asia/Seoul' }).replace(/\D/g, '')}시쯤 비` } : undefined
  if (rec?.needMask) gear.push('mask')
  if (['clear', 'heat', 'uv'].includes(w.condition)) gear.push('sunscreen')
  // 저장되면(이미 저장돼 있어도) true. 실패하면 false 를 돌려줘 후기 카드가 원래대로 돌아가게 한다.
  const sendFeedback = async (f: '추웠어요' | '딱 좋아요' | '더웠어요', followed: boolean): Promise<boolean> => {
    if (!recId) return false
    setFeedbackMsg('')
    try {
      await api('POST', `/api/recommendations/${recId}/feedback`, { rating: f, followed })
      setFeedback(f)
      setFeedbackDone(recId, f)
      setFeedbackMsg('알려줘서 고마워요 :D. 다음엔 더 잘 고를게요.')
      return true
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setFeedback(f)
        setFeedbackDone(recId, f)
        setFeedbackMsg('오늘 추천은 이미 알려줬어요. 고마워요!')
        return true
      }
      setFeedbackMsg(errorMessage(e))
      return false
    }
  }

  // 후기는 저장되는 추천(내 위치)에만 붙는다. 첫 확인 후 시간이 지났고 아직 안 남겼을 때만 뜬다. 숨김과 상관없이 추천 카드 앞에 붙는다.
  const feedbackCard = (
    <>
      {recId && (feedback || now >= feedbackDueAt(firstSeen, settings.data?.routine)) && (!getFeedbackDone(recId) || feedback) && (
        <FeedbackCard selected={feedback} message={feedbackMsg} onPick={sendFeedback} />
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

  // 추천을 아직 못 받았을 때(계산 중이거나 실패) 추천 자리에 보여줄 안내
  const recWaiting = recommendation.error ? (
    <div className="empty">
      <p role="alert">{recommendation.error}</p>
      <button type="button" className="dbtn w1 small" onClick={recommendation.reload}>
        추천 다시 불러오기
      </button>
    </div>
  ) : (
    <p className="tiny" role="status">옷차림을 고르는 중이에요…</p>
  )

  // 첫 시작: 아직 등록한 옷이 하나도 없으면(어느 지역을 보든) 오늘 추천 자리에 옷 등록 안내를 보여준다
  const needCloset = closetEmpty

  const blocks: Record<BlockId, ReactNode> = {
    weather: (
      <>
      <section className="section weather">
        <div>
          <div className="tiny">
            {w.location}
            {w.observedAt && <span className="obs-at"> · {new Date(w.observedAt).getHours()}시 관측</span>}
          </div>
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
        <GearDoodles items={gear} notes={gearNotes} />
        <button type="button" className="detail-toggle" aria-expanded={showDetail} onClick={() => setShowDetail((v) => !v)}>
          {showDetail ? '접기 ▴' : '자세히 ▾'}
        </button>
      </div>
      {showDetail && (
        <div className="box w3 detail">
          <div className="gauges">
            <Gauge label="바람" ratio={w.wind.speed / 14} text={`${w.wind.speed} m/s · ${w.wind.label}`} />
            <Gauge
              label="미세먼지"
              ratio={w.dust?.pm10 != null ? w.dust.pm10 / 150 : null}
              text={w.dust?.pm10 != null ? `${w.dust.pm10} ㎍/㎥ · ${dustGrade(w.dust.pm10, [30, 80, 150])}` : '정보 없음'}
            />
            <Gauge
              label="초미세먼지"
              ratio={w.dust?.pm25 != null ? w.dust.pm25 / 75 : null}
              text={w.dust?.pm25 != null ? `${w.dust.pm25} ㎍/㎥ · ${dustGrade(w.dust.pm25, [15, 35, 75])}` : '정보 없음'}
            />
            <Gauge label="체감온도" ratio={(w.feels + 15) / 50} text={`${w.feels}°C`} />
            <Gauge label="비 올 확률" ratio={w.rainChance / 100} text={`${w.rainChance}%`} />
            {w.humidity != null && <Gauge label="습도" ratio={w.humidity / 100} text={`${w.humidity}%`} />}
          </div>
        </div>
      )}


      </>
    ),
    recommend: needCloset ? (
      <section className="section">
        <h2>오늘 추천</h2>
        <hr className="scribble under-title" />
        <div className="box w2 first-guide" role="note">
          <b>👋 먼저 내 옷을 등록해 볼까요?</b>
          <p className="tiny">지금은 옷장이 비어 있어서 추천을 드릴 수 없어요. 내 옷을 등록하면 진짜 내 옷으로 코디해 드려요. 5벌 이상 등록하면 내 캐릭터도 열려요!</p>
          <Link to="/wardrobe/add" className="dbtn w1 small">
            + 옷 등록하러 가기
          </Link>
        </div>
      </section>
    ) : !rec ? (
      <section className="section">
        <h2>{target.kind === 'home' ? '오늘 추천' : `${w.location} 추천`}</h2>
        <hr className="scribble under-title" />
        {recWaiting}
      </section>
    ) : (
      <section className="section">
        <div className="rec-head">
          <h2>{target.kind === 'home' ? '오늘 추천' : `${w.location} 추천`}</h2>
          <button type="button" className="share-btn" onClick={() => void shareOutfit()} disabled={sharing} aria-label="오늘 코디 공유하기">
            <ShareIcon />
          </button>
        </div>
        <hr className="scribble under-title" />
        {rec.basis?.reliability.level === 'CAUTION' && (
          <ul className="tiny caution" aria-label="예보 주의">
            {rec.basis.reliability.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        {/* 졸라맨이 추천 조합을 입고 서 있고, 그 옆에 입을 옷이 한 줄씩 놓인다 */}
        <div className="look">
          <StickPerson mood="stand" size={150} wear={wear} umbrella={rainSoon} persona={null} accessories={character?.unlocked ? character.config : undefined} />
          <ul className="look-items" aria-label="오늘 입을 옷">
            {items.map((it, i) => (
              <li key={`${it.type}-${it.clothingId ?? it.label}-${i}`}>
                <ClothingDoodle type={it.type} color={it.color} pattern={it.pattern} size={58} />
                <span>{it.label}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* 외출·귀가 날씨: 졸라맨이 입은 옷 바로 아래. 외출 시간은 내 위치 기준이라 다른 지역을 구경 중일 땐 숨긴다 */}
        {target.kind === 'home' && <CommuteLine hourly={w.hourly ?? []} routine={routine} />}
        {closetEmpty ? (
          <p className="tiny">
            아직 옷장이 비어 있어서 일반 추천이에요.{' '}
            <Link to="/wardrobe" className="guest-link">내 옷 등록하면 내 옷 기준으로 골라줘요 →</Link>
          </p>
        ) : null}
        {rec.insufficientWardrobe && !closetEmpty &&<p className="tiny">옷장에 딱 맞는 옷이 부족해서 가장 가까운 조합이에요</p>}
        {!closetEmpty && items.some((it) => !it.owned) &&<p className="tiny">옷장에 없는 옷이 섞여 있어요 (일반 추천)</p>}
        <div className="row stretch" style={{ marginTop: 14 }}>
          <DoodleButton seed={0} className="sketchy" selected={showWhy} onClick={() => setShowWhy((s) => !s)}>
            추천 이유
          </DoodleButton>
          <DoodleButton seed={2} className="sketchy" onClick={() => setAltIdx((i) => (i + 1 >= rec.alternatives.length ? -1 : i + 1))}>
            다른 조합 보기
          </DoodleButton>
        </div>
        {showWhy && (() => {
          // 지금 보고 있는 조합(기본/다른 조합)의 이유를 보여준다. AI 설명은 기본 추천을 두고 쓴 글이라 기본 추천일 때만.
          const why = rec.comboWhy?.[altIdx + 1]
          return (
          <div className="box w2 why">
            {altIdx >= 0 && <p className="tiny why-tag">다른 조합 {altIdx + 1}의 추천 이유</p>}
            <ul>
              <li>
                <b>{rec.headline}</b> {why?.sub ?? rec.sub}
              </li>
              {why?.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
              {rec.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
              {altIdx < 0 && (rec.aiExplanation ? <li>{rec.aiExplanation}</li> : rec.aiPending ? <li className="tiny">AI 설명을 쓰는 중이에요…</li> : null)}
            </ul>
          </div>
          )
        })()}
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
