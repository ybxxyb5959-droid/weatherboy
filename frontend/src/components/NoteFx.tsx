// 일정 쪽지 카드의 연출 도구: 테두리를 그리는 펜 선, 글씨를 따라가는 펜, 글씨를 지우는 지우개.
// 움직임은 motion.css 의 .fx-* 가 맡는다("움직임 줄이기"에서는 연출 없이 바로 보인다).

/** 카드 테두리가 펜으로 그려지는 선(카드 크기에 맞춰 늘어난다) */
export function FxBorder() {
  return (
    <svg className="fx-border" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M2 6 Q50 1 98 5 Q99.5 50 97 95 Q50 99.5 3 96 Q0.5 50 2 6Z" pathLength="1" fill="none" stroke="#222" strokeWidth="2.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** 글씨를 쓰며 지나가는 펜 */
export function PenTool() {
  return (
    <svg className="fx-tool fx-pen" width="22" height="26" viewBox="0 0 22 26" fill="none" stroke="#222" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 24 L5 17 L16 3 L20 6 L9 20Z" fill="#fcfcfa" />
      <path d="M5 17 L9 20 M14 6 L18 9" />
    </svg>
  )
}

/** 글씨를 쓸어 지우는 지우개 */
export function EraserTool() {
  return (
    <svg className="fx-tool fx-eraser" width="26" height="22" viewBox="0 0 26 22" fill="none" stroke="#222" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 14 L12 4 L23 9 L17 19 L8 19Z" fill="#fcfcfa" />
      <path d="M13 6 L9 19" />
      <path d="M12 4 L23 9 L19 14 L9 11Z" fill="#f2e8c8" />
    </svg>
  )
}
