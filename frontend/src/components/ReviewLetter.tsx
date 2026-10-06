import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../hooks'
import { dismissReview, getReviewStatus, snoozeReview } from '../lib/reviews'
import HandText from './HandText'

/** 편지 아이콘(볼펜 낙서 스타일). 닫혀 있으면 봉투, 열리면 뚜껑이 올라가고 편지지가 살짝 보인다. */
function LetterIcon({ open }: { open: boolean }) {
  return (
    <svg className="doodle" width="40" height="34" viewBox="0 0 40 34" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {open && <path d="M9 14 L9 5 Q20 3 31 5 L31 14" fill="var(--paper)" strokeWidth="2" />}
      <path d="M4 12 L36 12 L35 30 L5 30Z" fill="#fff6d8" />
      {open ? <path d="M4 12 L20 2 L36 12" fill="#fff6d8" /> : <path d="M4 12 L20 23 L36 12" />}
      <path d="M5 30 L16 20 M35 30 L24 20" strokeWidth="1.8" />
      {open && <path d="M15 8 H25 M15 11 H22" strokeWidth="1.6" />}
    </svg>
  )
}

/**
 * 홈 오른쪽 위의 "후기 요청 도착" 편지. 서버가 지금 보여줄 때라고 할 때만 나온다
 * (가입 후 반나절이 지났거나 주요 기능을 다 써본 사람, 아직 후기를 안 쓴 사람).
 * 누르면 펼쳐져서 후기를 부탁한다. 나중에: 며칠 뒤 다시 / 다시 안 볼래요: 영영 안 뜬다. 후기를 남기면 다시 뜨지 않는다.
 */
export default function ReviewLetter() {
  const status = useAsync(getReviewStatus)
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  // 바깥을 누르거나 Esc 를 누르면 접는다
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (hidden || !status.data?.show) return null

  // 서버 기록은 조용히 하고, 화면에서는 바로 닫는다
  const later = () => {
    setHidden(true)
    void snoozeReview().catch(() => undefined)
  }
  const never = () => {
    setHidden(true)
    void dismissReview().catch(() => undefined)
  }

  return (
    <div className="letter" ref={box}>
      <button type="button" className={`letter-btn${open ? ' open' : ''}`} aria-expanded={open} aria-label="후기 요청이 도착했어요" onClick={() => setOpen((v) => !v)}>
        <LetterIcon open={open} />
        <span className="letter-label">후기 요청</span>
        {!open && <i className="letter-dot" aria-hidden="true" />}
      </button>
      {open && (
        <section className="letter-paper" role="dialog" aria-label="후기 요청">
          <h2>
            <HandText>뭐입을옷?, 써보니 어때요?</HandText>
          </h2>
          <p className="tiny">후기를 남겨주시면 더 나은 앱으로 보답할게요 ^_^</p>
          <div className="row">
            <Link to="/review" className="dbtn w1">
              후기 남기기
            </Link>
            <button type="button" className="dbtn small" onClick={later}>
              나중에
            </button>
          </div>
          <button type="button" className="skip-link" onClick={never}>
            다시 안 볼래요
          </button>
        </section>
      )}
    </div>
  )
}
