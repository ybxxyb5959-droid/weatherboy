import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmDialog from './ConfirmDialog'
import HandText from './HandText'
import { api, errorMessage } from '../api'
import type { PlanEvent } from '../mocks/events'

/**
 * 일정 카드 오른쪽 위의 회색 "⋯" 버튼. 누르면 [일정 편집하기] [일정 삭제하기]가 나오고, 삭제는 한 번 더 확인한다.
 * 캘린더에서 가져온 일정은 원본이 캘린더에 있어서, 여기서 바꾸거나 지워도 다음 동기화 때 되돌아온다. 그래서 안내만 한다.
 */
export default function EventMenu({ event, onDeleted }: { event: PlanEvent; onDeleted: () => void }) {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  // 스크롤되는 목록 안에서 메뉴가 잘리지 않게, 버튼 위치를 기준으로 화면에 고정해서 띄운다
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const hide = () => setOpen(false)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [open])

  const remove = async () => {
    setBusy(true)
    setError('')
    try {
      await api('DELETE', `/api/events/${event.id}`)
      setConfirming(false)
      setOpen(false)
      onDeleted()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card-menu" ref={box}>
      <button
        ref={btn}
        type="button"
        className="card-menu-btn"
        aria-label={`${event.title} 일정 메뉴`}
        aria-expanded={open}
        onClick={() => {
          const r = btn.current?.getBoundingClientRect()
          if (r) setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) })
          setOpen((o) => !o)
        }}
      >
        ⋯
      </button>
      {open && pos && (
        <div className="card-menu-pop box w3" role="menu" style={{ top: pos.top, right: pos.right }}>
          {event.imported ? (
            <p className="tiny">캘린더에서 가져온 일정이에요. 바꾸거나 지우려면 연동한 캘린더에서 고쳐주세요.</p>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={() => nav(`/events/${event.id}/edit`)}>
                <HandText>일정 편집하기</HandText>
              </button>
              <button type="button" role="menuitem" className="danger" onClick={() => {
                  setOpen(false)
                  setConfirming(true)
                }}>
                <HandText>일정 삭제하기</HandText>
              </button>
            </>
          )}
        </div>
      )}
      {confirming && (
        <ConfirmDialog
          title="일정을 삭제할게요"
          message={error || `"${event.title}" 일정과 이 일정의 옷차림 추천이 함께 지워져요.`}
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => {
            setConfirming(false)
            setError('')
          }}
        />
      )}
    </div>
  )
}
