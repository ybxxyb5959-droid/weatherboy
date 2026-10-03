import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, errorMessage } from '../api'
import HandText from '../components/HandText'

// 관리자 페이지(/admin): 가입자 수, 접속, 사용 단계(퍼널), 후기. 비밀번호로 로그인하고 12시간 뒤에 풀린다.
// 보안은 서버가 지킨다(API 가 관리자 세션을 확인). 이 화면은 주소를 알아도 로그인 전에는 아무것도 못 본다.
interface Dashboard {
  users: { total: number; kakao: number; guest: number; active24h: number; active7d: number }
  daily: { d: string; c: number }[]
  funnel: { step: string; count: number }[]
  reviews: { total: number; average: number | null; unread: number }
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
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [error, setError] = useState('')
  const [onlyUnread, setOnlyUnread] = useState(false)

  const load = useCallback(async () => {
    try {
      const [d, r] = await Promise.all([api<Dashboard>('GET', '/api/admin/dashboard'), api<ReviewRow[]>('GET', '/api/admin/reviews')])
      setError('')
      setDash(d)
      setReviews(r)
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
  const logout = async () => {
    await api('POST', '/api/admin/logout').catch(() => undefined)
    setDash(null)
    setReviews([])
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
              <HandText>최근 14일 신규 가입</HandText>
            </h2>
            {dash.daily.length === 0 ? <p className="tiny">없어요.</p> : <Bars rows={dash.daily.map((x) => ({ label: x.d.slice(5), value: x.c }))} />}
          </section>
        </>
      )}

      <hr className="scribble" />
      <section>
        <div className="row between">
          <h2>
            <HandText>후기</HandText>
          </h2>
          <label className="tiny admin-filter">
            <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} /> 안 읽은 것만
          </label>
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
    </main>
  )
}
