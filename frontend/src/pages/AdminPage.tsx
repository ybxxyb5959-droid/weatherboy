import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, errorMessage } from '../api'
import '../styles/admin.css'
import AiTab from './admin/AiTab'
import InboxTab from './admin/InboxTab'
import InsightsTab from './admin/InsightsTab'
import OpsTab from './admin/OpsTab'
import OverviewTab from './admin/OverviewTab'
import UsersTab from './admin/UsersTab'
import type { AiUsage, Dashboard, Health, Insights, ReviewRow, SupportRow, Users } from './admin/types'

// 관리자 페이지(/admin): 가입·접속·사용 단계, 사용자, 인사이트, 시스템 점검, AI 사용, 후기·의견.
// 비밀번호로 로그인하고 12시간 뒤에 풀린다. 보안은 서버가 지킨다(API 가 관리자 세션을 확인). 이 화면은 주소를 알아도 로그인 전에는 아무것도 못 본다.
// PC 에서는 넓은 화면(body.admin-mode)으로 보여 주고, 폰에서는 한 줄 세로 배치로 접힌다.

type Tab = 'overview' | 'users' | 'insights' | 'ops' | 'ai' | 'inbox'

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
    <form className="col adm-login" onSubmit={(e) => void submit(e)}>
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
  const [tab, setTab] = useState<Tab>('overview')
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [ai, setAi] = useState<AiUsage | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [users, setUsers] = useState<Users | null>(null)
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [support, setSupport] = useState<SupportRow[]>([])
  const [error, setError] = useState('')
  const [partial, setPartial] = useState(false) // 일부 항목만 못 불러옴
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)
  const [auto, setAuto] = useState(false)
  const [busy, setBusy] = useState(false)

  // 넓은 화면(PC)에서는 폰 폭(460px) 제한을 풀어 준다
  useEffect(() => {
    document.body.classList.add('admin-mode')
    return () => document.body.classList.remove('admin-mode')
  }, [])

  const load = useCallback(async () => {
    setBusy(true)
    try {
      // 대시보드로 로그인 여부를 먼저 확인하고, 나머지는 따로 받는다: 하나가 실패해도 다른 항목은 그대로 보인다
      const d = await api<Dashboard>('GET', '/api/admin/dashboard')
      setDash(d)
      setError('')
      setState('ready') // 개요부터 바로 보여주고, 나머지는 도착하는 대로 채운다
      let failed = false
      const fill = <T,>(path: string, set: (v: T) => void) =>
        api<T>('GET', path)
          .then(set)
          .catch(() => {
            failed = true
          })
      await Promise.all([
        fill<ReviewRow[]>('/api/admin/reviews', setReviews),
        fill<SupportRow[]>('/api/admin/support', setSupport),
        fill<Health>('/api/admin/ops/health', setHealth),
        fill<Insights>('/api/admin/insights', setInsights),
        fill<Users>('/api/admin/users', setUsers),
        fill<AiUsage>('/api/admin/ai-usage', setAi),
      ])
      setPartial(failed)
      setLoadedAt(new Date())
    } catch (e) {
      // 로그인 전/만료: 로그인 화면으로
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setState('login')
      else {
        setError(errorMessage(e))
        setState('ready')
      }
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // 자동 새로고침(1분마다)
  useEffect(() => {
    if (!auto || state !== 'ready') return
    const t = window.setInterval(() => void load(), 60_000)
    return () => window.clearInterval(t)
  }, [auto, state, load])

  const markRead = (id: string) => {
    setReviews((rs) => rs.map((r) => (r.id === id ? { ...r, read: true } : r)))
    setDash((d) => (d ? { ...d, reviews: { ...d.reviews, unread: Math.max(0, d.reviews.unread - 1) } } : d))
    void api('POST', `/api/admin/reviews/${id}/read`).catch(() => undefined)
  }
  const markSupportRead = (id: string) => {
    setSupport((rs) => rs.map((r) => (r.id === id ? { ...r, read: true } : r)))
    setDash((d) => (d ? { ...d, support: { ...d.support, unread: Math.max(0, d.support.unread - 1) } } : d))
    void api('POST', `/api/admin/support/${id}/read`).catch(() => undefined)
  }
  const logout = async () => {
    await api('POST', '/api/admin/logout').catch(() => undefined)
    setDash(null)
    setAi(null)
    setHealth(null)
    setInsights(null)
    setUsers(null)
    setReviews([])
    setSupport([])
    setState('login')
  }

  const problems = health ? health.checks.filter((c) => !c.ok && !c.optional).length : 0
  const unread = reviews.filter((r) => !r.read).length + support.filter((r) => !r.read).length
  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'overview', label: '개요' },
    { id: 'users', label: '사용자' },
    { id: 'insights', label: '인사이트' },
    { id: 'ops', label: '시스템', badge: problems },
    { id: 'ai', label: 'AI' },
    { id: 'inbox', label: '후기·의견', badge: unread },
  ]

  if (state === 'checking') return <main className="admin">{<h1>관리자</h1>}<p>확인하는 중…</p></main>
  if (state === 'login')
    return (
      <main className="admin">
        <h1>관리자</h1>
        <Login onDone={() => void load()} />
      </main>
    )

  const missing = busy ? <p className="tiny">불러오는 중…</p> : <p className="tiny adm-missing">이 항목을 불러오지 못했어요. 새로고침을 눌러 다시 시도해 주세요.</p>
  return (
    <main className="admin adm-shell">
      <header className="adm-top">
        <h1>관리자</h1>
        <nav className="adm-tabs" aria-label="관리자 메뉴">
          {tabs.map((t) => (
            <button key={t.id} type="button" className={`adm-tab${tab === t.id ? ' on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              {t.label}
              {t.badge ? <i className="adm-badge">{t.badge}</i> : null}
            </button>
          ))}
        </nav>
        <div className="adm-actions">
          <span className="tiny">{loadedAt ? `${loadedAt.getHours()}:${String(loadedAt.getMinutes()).padStart(2, '0')} 기준` : ''}</span>
          <label className="adm-auto tiny">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> 1분마다 새로고침
          </label>
          <button type="button" className="dbtn small" disabled={busy} onClick={() => void load()}>
            {busy ? '불러오는 중…' : '새로고침'}
          </button>
          <button type="button" className="dbtn small" onClick={() => void logout()}>
            로그아웃
          </button>
        </div>
      </header>

      {error && <p role="alert">{error}</p>}
      {partial && <p className="tiny adm-missing">일부 항목을 불러오지 못했어요. 해당 탭에서 안내가 보일 수 있어요.</p>}

      <div className="adm-body">
        {tab === 'overview' && dash && <OverviewTab dash={dash} health={health} insights={insights} reviews={reviews} support={support} go={setTab} />}
        {tab === 'users' && (users ? <UsersTab data={users} /> : missing)}
        {tab === 'insights' && (insights ? <InsightsTab data={insights} /> : missing)}
        {tab === 'ops' && (health ? <OpsTab data={health} /> : missing)}
        {tab === 'ai' && (ai ? <AiTab ai={ai} /> : missing)}
        {tab === 'inbox' && <InboxTab reviews={reviews} support={support} markRead={markRead} markSupportRead={markSupportRead} />}
      </div>
    </main>
  )
}
