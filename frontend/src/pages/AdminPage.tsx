import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, errorMessage } from '../api'
import DoodleCheck from '../components/DoodleCheck'
import HandText from '../components/HandText'

// 관리자 페이지(/admin): 가입자 수, 접속, 사용 단계(퍼널), 후기. 비밀번호로 로그인하고 12시간 뒤에 풀린다.
// 보안은 서버가 지킨다(API 가 관리자 세션을 확인). 이 화면은 주소를 알아도 로그인 전에는 아무것도 못 본다.
interface Dashboard {
  users: { total: number; kakao: number; guest: number; active24h: number; active7d: number }
  daily: { d: string; c: number }[]
  funnel: { step: string; count: number }[]
  reviews: { total: number; average: number | null; unread: number }
  support: { total: number; unread: number }
}
interface AiUsage {
  days: { date: string; photo: number; text: number; other: number; total: number; failed: number }[]
  failureRate: number | null
  avgMs: { photo: number | null; text: number | null }
  topUsers: { code: string; photo: number; text: number; total: number }[]
  global: { used: number; cap: number; open: boolean }
  limits: { photoDaily: number; photoNewUser: number; textDaily: number; textNewUser: number; newUserHours: number; hourly: number }
}
interface ReviewRow {
  id: string
  rating: number
  message: string
  createdAt: string
  read: boolean
  code: string
  provider: 'KAKAO' | 'GUEST' | null
  activeDays: number
}

interface SupportRow {
  id: string
  kind: 'BUG' | 'IDEA' | 'OTHER'
  message: string
  createdAt: string
  read: boolean
  code: string
  provider: 'KAKAO' | 'GUEST' | null
}
const KIND_LABEL = { BUG: '불편·오류', IDEA: '제안', OTHER: '기타' } as const

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n)
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="box w1 admin-stat">
      <div className="tiny">{label}</div>
      <b>{value}</b>
      {sub && <div className="tiny">{sub}</div>}
    </div>
  )
}

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="char-bars">
      {rows.map((r) => (
        <div key={r.label} className="char-bar admin-bar">
          <span className="lbl">{r.label}</span>
          <span className="track">
            <i style={{ width: `${Math.max(r.value ? 3 : 0, (r.value / max) * 100)}%` }} />
          </span>
          <span className="val">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

/** 최근 7일(한국 날짜) 신규 가입: 가입이 없는 날은 0으로 채운 꺾은선 그래프 */
function LineChart({ rows }: { rows: { d: string; c: number }[] }) {
  const byDay = new Map(rows.map((r) => [r.d, r.c]))
  const [now] = useState(() => Date.now()) // 화면을 연 시점의 한국 날짜 기준
  const kstNow = now + 9 * 3600_000
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(kstNow - (6 - i) * 86400_000).toISOString().slice(0, 10)
    return { d, c: byDay.get(d) ?? 0 }
  })
  const W = 340
  const H = 160
  const L = 26
  const R = 20 // 마지막 날짜 라벨이 잘리지 않을 여백
  const T = 22
  const B = 28
  const max = Math.max(4, ...days.map((x) => x.c))
  const x = (i: number) => L + ((W - L - R) * i) / (days.length - 1)
  const y = (c: number) => T + (H - T - B) * (1 - c / max)
  const pts = days.map((p, i) => `${x(i)},${y(p.c)}`).join(' ')
  const total = days.reduce((a, p) => a + p.c, 0)
  return (
    <figure className="admin-chart" aria-label={`최근 7일 신규 가입 ${total}명`}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
        {/* 가로 눈금 */}
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <path d={`M${L} ${y(max * f)} H${W - R}`} stroke="#222" strokeOpacity="0.18" strokeDasharray="4 4" />
            <text x={L - 5} y={y(max * f) + 4} textAnchor="end" fontSize="11" fill="#222" opacity="0.7">
              {Math.round(max * f)}
            </text>
          </g>
        ))}
        {/* 선과 점(살짝 흔들어 손으로 그은 느낌) */}
        <g className="doodle" fill="none" stroke="#222" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points={pts} />
          {days.map((p, i) => (
            <circle key={p.d} cx={x(i)} cy={y(p.c)} r="3.4" fill="#fcfcfa" />
          ))}
        </g>
        {/* 값(가입이 있는 날만) */}
        {days.map((p, i) =>
          p.c > 0 ? (
            <text key={p.d} x={x(i)} y={y(p.c) - 8} textAnchor="middle" fontSize="12" fontWeight="700" fill="#222">
              {p.c}
            </text>
          ) : null,
        )}
        {/* 날짜: 7일이라 매일 표시 */}
        {days.map((p, i) => (
          <text key={p.d} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#222" opacity="0.75">
            {p.d.slice(5).replace('-', '/')}
          </text>
        ))}
      </svg>
      <figcaption className="tiny">7일 합계 {total}명</figcaption>
    </figure>
  )
}

const secs = (ms: number | null) => (ms == null ? '-' : `${(ms / 1000).toFixed(1)}초`)

/** AI 사용 현황: 최근 7일 호출 수, 실패율, 평균 응답, 서버 전체 상한과 상위 사용자, 지금 한도 설정 */
function AiUsageSection({ ai }: { ai: AiUsage }) {
  const today = ai.days.at(-1)
  const week = ai.days.reduce((a, d) => a + d.total, 0)
  const pct = Math.min(100, Math.round((ai.global.used / ai.global.cap) * 100))
  return (
    <section>
      <h2>
        <HandText>AI 사용 현황</HandText>
      </h2>
      <div className="admin-stats">
        <Stat label="오늘 호출" value={today?.total ?? 0} sub={`사진 ${today?.photo ?? 0} · 말 ${today?.text ?? 0} · 그 밖 ${today?.other ?? 0}`} />
        <Stat label="7일 호출" value={week} sub={ai.failureRate == null ? '아직 없어요' : `실패 ${ai.failureRate}%`} />
        <Stat label="사진 평균 응답" value={secs(ai.avgMs.photo)} sub={`말 입력 ${secs(ai.avgMs.text)}`} />
        <Stat label="서버 전체 24시간" value={`${pct}%`} sub={`${ai.global.used} / ${ai.global.cap}${ai.global.open ? '' : ' · 지금 쉬는 중'}`} />
      </div>
      <p className="tiny" style={{ marginTop: 12 }}>하루 호출 수 (최근 7일)</p>
      <Bars rows={ai.days.map((d) => ({ label: d.date.slice(5).replace('-', '/'), value: d.total }))} />
      <p className="tiny" style={{ marginTop: 12 }}>
        지금 한도: 시간당 {ai.limits.hourly}회 · 사진 하루 {ai.limits.photoDaily}회(가입 {ai.limits.newUserHours}시간 동안 {ai.limits.photoNewUser}회) · 말 하루 {ai.limits.textDaily}회(가입 직후 {ai.limits.textNewUser}회)
      </p>
      <p className="tiny" style={{ marginTop: 12 }}>최근 24시간 많이 쓴 사용자</p>
      {ai.topUsers.length === 0 ? (
        <p className="tiny">아직 사용자별 기록이 없어요. (사용자 기록은 이번 업데이트 이후 호출부터 쌓여요)</p>
      ) : (
        <ul className="admin-reviews">
          {ai.topUsers.map((u) => (
            <li key={u.code} className="box w1">
              <div className="row between">
                <b>사용자 {u.code}</b>
                <span className="tiny">
                  사진 {u.photo} · 말 {u.text} · 합계 {u.total}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Login({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pw || busy) return
    setBusy(true)
    setErr('')
    try {
      await api('POST', '/api/admin/login', { password: pw })
      onDone()
    } catch (e2) {
      // 404: 서버에 관리자 비밀번호가 설정되지 않음
      setErr(e2 instanceof ApiError && e2.status === 404 ? '관리자 비밀번호가 서버에 설정되지 않았어요.' : errorMessage(e2))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="col" onSubmit={(e) => void submit(e)}>
      <p className="tiny">관리자 비밀번호를 입력해주세요.</p>
      <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} className="admin-input" aria-label="관리자 비밀번호" />
      {err && <p role="alert">{err}</p>}
      <button type="submit" className="dbtn block w1" disabled={!pw || busy}>
        {busy ? '확인 중…' : '들어가기'}
      </button>
    </form>
  )
}

export default function AdminPage() {
  const [state, setState] = useState<'checking' | 'login' | 'ready'>('checking')
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [ai, setAi] = useState<AiUsage | null>(null)
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [support, setSupport] = useState<SupportRow[]>([])
  const [error, setError] = useState('')
  const [onlyUnread, setOnlyUnread] = useState(false)

  const load = useCallback(async () => {
    try {
      const [d, r, sp] = await Promise.all([api<Dashboard>('GET', '/api/admin/dashboard'), api<ReviewRow[]>('GET', '/api/admin/reviews'), api<SupportRow[]>('GET', '/api/admin/support')])
      setError('')
      setDash(d)
      setReviews(r)
      setSupport(sp)
      // AI 사용 현황은 따로 받는다: 실패해도 나머지 화면은 그대로 보인다
      setAi(await api<AiUsage>('GET', '/api/admin/ai-usage').catch(() => null))
      setState('ready')
    } catch (e) {
      // 로그인 전/만료: 로그인 화면으로
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setState('login')
      else {
        setError(errorMessage(e))
        setState('ready')
      }
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const markRead = async (id: string) => {
    setReviews((rs) => rs.map((r) => (r.id === id ? { ...r, read: true } : r)))
    setDash((d) => (d ? { ...d, reviews: { ...d.reviews, unread: Math.max(0, d.reviews.unread - 1) } } : d))
    await api('POST', `/api/admin/reviews/${id}/read`).catch(() => undefined)
  }
  const markSupportRead = async (id: string) => {
    setSupport((rs) => rs.map((r) => (r.id === id ? { ...r, read: true } : r)))
    setDash((d) => (d ? { ...d, support: { ...d.support, unread: Math.max(0, d.support.unread - 1) } } : d))
    await api('POST', `/api/admin/support/${id}/read`).catch(() => undefined)
  }
  const logout = async () => {
    await api('POST', '/api/admin/logout').catch(() => undefined)
    setDash(null)
    setAi(null)
    setReviews([])
    setSupport([])
    setState('login')
  }

  const head = (
    <div className="page-head">
      <h1>관리자</h1>
      {state === 'ready' && (
        <div className="row">
          <button type="button" className="dbtn small" onClick={() => void load()}>
            새로고침
          </button>
          <button type="button" className="dbtn small" onClick={() => void logout()}>
            로그아웃
          </button>
        </div>
      )}
    </div>
  )

  if (state === 'checking') return <main>{head}<p>확인하는 중…</p></main>
  if (state === 'login') return <main className="admin">{head}<Login onDone={() => void load()} /></main>

  const shown = onlyUnread ? reviews.filter((r) => !r.read) : reviews
  return (
    <main className="admin">
      {head}
      {error && <p role="alert">{error}</p>}
      {dash && (
        <>
          <div className="admin-stats">
            <Stat label="전체 가입자" value={dash.users.total} sub={`카카오 ${dash.users.kakao} · 게스트 ${dash.users.guest}`} />
            <Stat label="최근 24시간 접속" value={dash.users.active24h} sub={`7일 ${dash.users.active7d}명`} />
            <Stat label="후기" value={dash.reviews.total} sub={dash.reviews.average ? `평균 ★${dash.reviews.average} · 안 읽음 ${dash.reviews.unread}` : '아직 없어요'} />
            <Stat label="의견·제보" value={dash.support.total} sub={dash.support.total ? `안 읽음 ${dash.support.unread}` : '아직 없어요'} />
          </div>

          <hr className="scribble" />
          <section>
            <h2>
              <HandText>사용 단계 (어디서 떠나요?)</HandText>
            </h2>
            <Bars rows={dash.funnel.map((f) => ({ label: f.step, value: f.count }))} />
          </section>

          <hr className="scribble" />
          <section>
            <h2>
              <HandText>최근 7일 신규 가입</HandText>
            </h2>
            <LineChart rows={dash.daily} />
          </section>
        </>
      )}

      {ai && (
        <>
          <hr className="scribble" />
          <AiUsageSection ai={ai} />
        </>
      )}

      <hr className="scribble" />
      <section>
        <div className="row between">
          <h2>
            <HandText>후기</HandText>
          </h2>
          <DoodleCheck checked={onlyUnread} onChange={setOnlyUnread}>
            안 읽은 것만
          </DoodleCheck>
        </div>
        {shown.length === 0 && <p className="tiny">{reviews.length === 0 ? '아직 후기가 없어요.' : '안 읽은 후기가 없어요.'}</p>}
        <ul className="admin-reviews">
          {shown.map((r) => (
            <li key={r.id} className={`box w${r.rating % 3 + 1}${r.read ? ' read' : ''}`}>
              <div className="row between">
                <b className="admin-stars">{stars(r.rating)}</b>
                <span className="tiny">{fmtDate(r.createdAt)}</span>
              </div>
              <p className="admin-msg">{r.message || '(별점만 남겼어요)'}</p>
              <div className="row between">
                <span className="tiny">
                  사용자 {r.code} · {r.provider === 'KAKAO' ? '카카오' : '게스트'} · 접속 {r.activeDays}일
                </span>
                {!r.read && (
                  <button type="button" className="dbtn small" onClick={() => void markRead(r.id)}>
                    읽음
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <hr className="scribble" />
      <section>
        <h2>
          <HandText>의견·제보</HandText>
        </h2>
        {support.length === 0 && <p className="tiny">아직 의견이 없어요.</p>}
        <ul className="admin-reviews">
          {support.map((r) => (
            <li key={r.id} className={`box w${(r.message.length % 3) + 1}${r.read ? ' read' : ''}`}>
              <div className="row between">
                <span className="admin-kind">{KIND_LABEL[r.kind]}</span>
                <span className="tiny">{fmtDate(r.createdAt)}</span>
              </div>
              <p className="admin-msg">{r.message}</p>
              <div className="row between">
                <span className="tiny">
                  사용자 {r.code} · {r.provider === 'KAKAO' ? '카카오' : '게스트'}
                </span>
                {!r.read && (
                  <button type="button" className="dbtn small" onClick={() => void markSupportRead(r.id)}>
                    읽음
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
