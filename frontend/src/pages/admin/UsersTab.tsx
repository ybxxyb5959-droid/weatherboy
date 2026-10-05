import { useMemo, useState } from 'react'
import { Card } from './common'
import { fmtDay, ago } from './format'
import type { UserRow, Users } from './types'

type SortKey = 'createdAt' | 'lastSeenAt' | 'activeDays' | 'clothes' | 'events' | 'feedbacks'
type Filter = 'all' | 'kakao' | 'guest' | 'push' | 'closet10' | 'idle3'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'kakao', label: '카카오' },
  { id: 'guest', label: '게스트' },
  { id: 'push', label: '알림 켬' },
  { id: 'closet10', label: '옷 10벌+' },
  { id: 'idle3', label: '3일 넘게 안 옴' },
]

const COLS: { key: SortKey | null; label: string; num?: boolean }[] = [
  { key: null, label: '고객번호' },
  { key: null, label: '가입 방식' },
  { key: 'createdAt', label: '가입일' },
  { key: 'lastSeenAt', label: '마지막 접속' },
  { key: 'activeDays', label: '접속일수', num: true },
  { key: null, label: '지역' },
  { key: 'clothes', label: '옷', num: true },
  { key: 'events', label: '일정', num: true },
  { key: 'feedbacks', label: '체감 후기', num: true },
  { key: null, label: '알림' },
  { key: null, label: '앱 후기' },
]

const time = (s: string | null) => (s ? new Date(s).getTime() : 0)

/** 사용자 목록: 닉네임·이메일 없이 고객번호와 활동 수치만. 검색·필터·정렬은 화면에서 한다(최근 가입 500명). */
export default function UsersTab({ data }: { data: Users }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'createdAt', dir: -1 })
  const [now] = useState(() => Date.now())
  const [limit, setLimit] = useState(100) // 한 번에 그리는 줄 수(500줄을 한꺼번에 그리면 느려진다)

  const rows = useMemo(() => {
    const term = q.trim().toUpperCase()
    const pass = (u: UserRow) => {
      if (term && !u.code.includes(term)) return false
      if (filter === 'kakao') return u.provider === 'KAKAO'
      if (filter === 'guest') return u.provider === 'GUEST'
      if (filter === 'push') return u.push
      if (filter === 'closet10') return u.clothes >= 10
      if (filter === 'idle3') return !u.lastSeenAt || now - time(u.lastSeenAt) > 3 * 86400_000
      return true
    }
    const val = (u: UserRow) => (sort.key === 'createdAt' ? time(u.createdAt) : sort.key === 'lastSeenAt' ? time(u.lastSeenAt) : u[sort.key])
    return data.users.filter(pass).sort((a, b) => (val(a) - val(b)) * sort.dir)
  }, [data.users, q, filter, sort, now])

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }))

  return (
    <Card title={`사용자 (${rows.length}명 표시 / 전체 ${data.total}명)`} right={<span className="tiny">최근 가입 {data.shown}명까지 불러와요</span>}>
      <div className="adm-toolbar">
        <input className="admin-input adm-search" placeholder="고객번호 검색 (예: 3F9A)" value={q} onChange={(e) => {
            setQ(e.target.value)
            setLimit(100)
          }} aria-label="고객번호 검색" />
        <div className="adm-chips" role="group" aria-label="필터">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={`adm-chip${filter === f.id ? ' on' : ''}`} aria-pressed={filter === f.id} onClick={() => {
                setFilter(f.id)
                setLimit(100)
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.label} className={c.num ? 'num' : undefined} aria-sort={c.key && sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                  {c.key ? (
                    <button type="button" className="adm-sort" onClick={() => toggle(c.key!)}>
                      {c.label}
                      {sort.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="empty">
                  조건에 맞는 사용자가 없어요.
                </td>
              </tr>
            )}
            {rows.slice(0, limit).map((u) => (
              <tr key={u.code}>
                <td>
                  <code>{u.code}</code>
                </td>
                <td>{u.provider === 'KAKAO' ? '카카오' : u.provider === 'GUEST' ? '게스트' : '-'}</td>
                <td>{fmtDay(u.createdAt)}</td>
                <td title={u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString('ko-KR') : ''}>{ago(u.lastSeenAt, now)}</td>
                <td className="num">{u.activeDays}</td>
                <td>{u.region ?? '-'}</td>
                <td className="num">{u.clothes}</td>
                <td className="num">{u.events}</td>
                <td className="num">{u.feedbacks}</td>
                <td>{u.push ? <span className="adm-tag good">켬</span> : <span className="adm-tag">꺼짐</span>}</td>
                <td>{u.reviewed ? '✓' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div className="adm-more">
          <button type="button" className="dbtn small" onClick={() => setLimit((l) => l + 100)}>
            더 보기 ({limit} / {rows.length})
          </button>
        </div>
      )}
      <p className="tiny adm-note">개인정보 보호를 위해 닉네임·이메일은 보여주지 않아요. 고객번호는 후기·의견의 사용자 번호와 같아서 서로 연결해서 볼 수 있어요.</p>
    </Card>
  )
}
