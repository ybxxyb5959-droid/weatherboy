import { useNavigate } from 'react-router-dom'

/** 뒤로가기: 박스 없이 화살표 아이콘만. to 가 있으면 그 경로로, 없으면 이전 화면으로. */
export default function BackButton({ to, label = '뒤로 가기' }: { to?: string; label?: string }) {
  const nav = useNavigate()
  return (
    <button type="button" className="back-btn" aria-label={label} onClick={() => (to ? nav(to) : nav(-1))}>
      <svg width="14" height="22" viewBox="0 0 14 22" fill="none" stroke="#222" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 2.5 C8 6 5.5 9 3 11 C5.5 13.5 8 16 11 19.5" />
      </svg>
    </button>
  )
}
