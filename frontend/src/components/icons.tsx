/** 내 위치: 손으로 그린 핀(물방울) 모양 */
export function Pin() {
  return (
    <svg className="doodle" width="18" height="20" viewBox="0 0 24 26" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 24 C7 17 4 14 4 9.5 C4 5 8 2 12.5 2.5 C17 3 20.5 6 20 10.5 C19.6 14.5 16 17.5 12 24Z" fill="#e8896f" />
      <circle cx="12.3" cy="9.6" r="3" fill="var(--paper)" />
    </svg>
  )
}

/** 공유 아이콘 (상자에서 위로 나가는 화살표) */
export function ShareIcon() {
  return (
    <svg viewBox="0 0 28 28" width="26" height="26" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 18 V4 M9 9 L14 4 L19 9 M6 13 V23 H22 V13" />
    </svg>
  )
}
