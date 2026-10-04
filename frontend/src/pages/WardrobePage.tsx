import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import HandText from '../components/HandText'
import ClothingDoodle from '../components/ClothingDoodle'
import ConfirmDialog from '../components/ConfirmDialog'
import { Clothespin, ClosetScene } from '../components/Clothesline'
import LineScroller from '../components/LineScroller'
import { categories } from '../mocks/clothes'
import type { Clothing } from '../mocks/clothes'
import { api, errorMessage } from '../api'
import { useAsync } from '../hooks'

// 빨래집게가 풀리고 옷이 떨어지는 애니메이션 길이(ms). global.css 의 wb-pin-*/wb-drop 과 맞춘다.
const LEAVE_MS = 1000

const nameOf = (c: Clothing) => `${c.color}${c.pattern && c.pattern !== '무지' ? ` ${c.pattern}` : ''} ${c.type}`

export default function WardrobePage() {
  const { data, error, loading, reload } = useAsync(() => api<Clothing[]>('GET', '/api/clothes'))
  const nav = useNavigate()
  const location = useLocation()
  // 방금 추가/수정한 옷: 빨랫줄에 새로 걸리는 모습을 보여준다. 새로고침 때 다시 재생되지 않게 기록은 바로 지운다.
  const [arriving] = useState<string[]>(() => ((location.state as { hung?: string[] } | null)?.hung ?? []))
  useEffect(() => {
    if (arriving.length > 0) nav(location.pathname, { replace: true, state: null })
  }, [arriving, nav, location.pathname])
  const [deleteMode, setDeleteMode] = useState(false)
  const [target, setTarget] = useState<Clothing | null>(null) // "삭제할게요" 확인 중인 옷
  const [leaving, setLeaving] = useState<string[]>([]) // 빨랫줄에서 떨어지는 중인 옷
  const [gone, setGone] = useState<string[]>([]) // 삭제가 끝난 옷 (목록에서 뺀다)
  const [notice, setNotice] = useState('')

  const clothes = (data ?? []).filter((c) => !gone.includes(c.id))
  const samples = clothes.filter((c) => c.isSample)
  const [confirming, setConfirming] = useState(false)
  // 새 옷이 걸린 줄: 줄을 끝까지 넘긴 뒤에야 걸리는 애니메이션을 시작한다(화면 밖에서 끝나 버리지 않게).
  // 넘기기가 끝난 줄 이름을 모아 둔다.
  const [shown, setShown] = useState<string[]>([])
  const groups = categories
    .map((cat) => ({ name: cat.name, items: clothes.filter((c) => cat.types.includes(c.type)) }))
    .filter((g) => g.items.length > 0)
  const lastArriving = (items: Clothing[]) => [...items].reverse().find((c) => arriving.includes(c.id))?.id ?? null
  const firstLine = groups.find((g) => lastArriving(g.items))?.name

  // 확인을 누르면 집게가 풀리고 옷이 떨어지는 동안 서버에서도 지운다. 실패하면 옷을 다시 줄에 건다.
  const removeCloth = async (c: Clothing) => {
    setTarget(null)
    setNotice('')
    setLeaving((l) => [...l, c.id])
    try {
      await Promise.all([api('DELETE', `/api/clothes/${c.id}`), new Promise((r) => setTimeout(r, LEAVE_MS))])
      setGone((g) => [...g, c.id])
    } catch (e) {
      setNotice(errorMessage(e))
    } finally {
      setLeaving((l) => l.filter((x) => x !== c.id))
    }
  }

  // 예시 옷을 한 번에 '내 옷'으로 확인한다. 실패하면 목록을 다시 불러와 실제 상태를 보여준다.
  const confirmSamples = async () => {
    setConfirming(true)
    setNotice('')
    try {
      await Promise.all(samples.map((c) => api('PATCH', `/api/clothes/${c.id}`, { confirmed: true })))
    } catch (e) {
      setNotice(errorMessage(e))
    } finally {
      setConfirming(false)
      reload()
    }
  }

  // 옷이 하나도 없으면 위쪽 버튼은 숨기고 가운데 '옷 추가하기' 버튼만 둔다
  const isEmpty = !loading && !error && groups.length === 0

  return (
    <main className={deleteMode ? 'deleting' : undefined}>
      <div className="page-head">
        <h1>내 옷장</h1>
        {!isEmpty && (
        <div className="row head-actions">
          <Link to="/wardrobe/add" className="dbtn w1 small">
            <HandText>+ 옷 추가</HandText>
          </Link>
          <button type="button" className={`dbtn w3 small${deleteMode ? ' on' : ''}`} aria-pressed={deleteMode} onClick={() => setDeleteMode((v) => !v)} disabled={clothes.length === 0}>
            <HandText>{deleteMode ? '완료' : '옷 삭제'}</HandText>
          </button>
        </div>
        )}
      </div>

      {groups.length > 0 && <ClosetScene />}
      {deleteMode && groups.length > 0 && <p className="tiny">지울 옷의 ✕ 표시를 눌러주세요.</p>}
      {notice && <p role="alert">{notice}</p>}
      {samples.length > 0 && (
        <div className="sample-note">
          <p className="tiny">예시 옷 {samples.length}벌이 있어요. 확인하기 전까지는 추천에서 내 옷으로 쓰지 않아요. 지울 옷은 지우고, 내 옷이 맞으면 확인해 주세요.</p>
          <button type="button" className="dbtn w2 small" onClick={() => void confirmSamples()} disabled={confirming}>
            <HandText>{confirming ? '확인 중…' : '남은 옷 전부 내 옷이에요'}</HandText>
          </button>
        </div>
      )}

      {loading ? (
        <p>불러오는 중…</p>
      ) : error ? (
        <div className="empty">
          <p role="alert">{error}</p>
          <button type="button" className="dbtn w1" onClick={reload}>
            다시 시도
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="empty">
          <ClosetScene empty />
          <p>옷장이 텅 비어있어</p>
          <div className="col" style={{ alignItems: 'center' }}>
            <Link to="/wardrobe/scan" className="dbtn w1">
              <HandText>옷장 사진으로 한꺼번에</HandText>
            </Link>
            <Link to="/wardrobe/add" className="dbtn w2 small">
              <HandText>한 벌씩 추가</HandText>
            </Link>
          </div>
        </div>
      ) : (
        <div className="lines">
          {groups.map((g, gi) => {
            const target = lastArriving(g.items)
            const play = shown.includes(g.name)
            // 이 줄에서 몇 번째로 걸리는 옷인지(차례로 하나씩 걸린다)
            const order = g.items.filter((c) => arriving.includes(c.id)).map((c) => c.id)
            return (
            <section key={g.name} className="cat">
              <LineScroller
                label={`${g.name} 빨랫줄`}
                className={`cline-track l${gi % 3}`}
                arriving={target}
                focus={g.name === firstLine}
                onReady={() => setShown((s) => (s.includes(g.name) ? s : [...s, g.name]))}
              >
                  {g.items.map((c, i) => (
                    <div key={c.id} data-hung-id={c.id} className={`hung h${(gi + i) % 3}${leaving.includes(c.id) ? ' leaving' : ''}${arriving.includes(c.id) ? (play ? ' arriving' : ' waiting') : ''}`} style={arriving.includes(c.id) ? ({ '--arrive-delay': `${order.indexOf(c.id) * 0.35}s` } as React.CSSProperties) : undefined}>
                      <div className="hang">
                        <Clothespin style={{ left: 20, top: -12 }} />
                        <Clothespin style={{ left: 50, top: -12 }} />
                        {deleteMode ? (
                          <ClothingDoodle type={c.type} color={c.color} pattern={c.pattern} size={86} />
                        ) : (
                          <button type="button" className="cloth-edit" aria-label={`${nameOf(c)} 고치기`} onClick={() => nav(`/wardrobe/${c.id}/edit`)}>
                            <ClothingDoodle type={c.type} color={c.color} pattern={c.pattern} size={86} />
                          </button>
                        )}
                        {deleteMode && !leaving.includes(c.id) && (
                          <button type="button" className="del-badge" aria-label={`${nameOf(c)} 삭제`} onClick={() => setTarget(c)}>
                            <svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true">
                              {/* 손으로 그린 동그라미 안에 쓱쓱 그은 X */}
                              <path className="del-ring" d="M15 3.2 C22 2.6 27 8 26.6 15.2 C26.2 22 21 26.9 14.6 26.6 C8 26.3 3.2 21.4 3.4 14.6 C3.6 8.2 8.4 3.5 15.6 3.4" />
                              <path className="del-x" d="M10 9.6 Q15.4 15 20.4 20.6 M20.2 9.4 Q14.6 15.2 9.6 20.2" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="label">{nameOf(c)}{c.isSample && <span className="sample-tag"> · 예시</span>}</div>
                    </div>
                  ))}
              </LineScroller>
            </section>
            )
          })}
        </div>
      )}

      {target && <ConfirmDialog title="옷을 삭제할게요" message={`${nameOf(target)}을(를) 옷장에서 지워요.`} onConfirm={() => void removeCloth(target)} onCancel={() => setTarget(null)} />}
    </main>
  )
}
