// 일정 쪽지 카드의 연출 도구: 테두리를 그리는 펜 선, 글씨를 따라가는 펜, 글씨를 지우는 지우개.
// 움직임은 motion.css 의 .fx-* 가 맡는다("움직임 줄이기"에서는 연출 없이 바로 보인다).

/** 새 일정 카드에 한 장 더 붙는 테이프(기본 테이프는 카드 ::before) */
export function FxTape() {
  return <span className="fx-tape2" aria-hidden="true" />
}

/** 삭제할 때 종이에 생기는 구김살(공 안쪽에 보인다) */
export function FxWrinkle() {
  return (
    <svg className="fx-wrinkle" viewBox="0 0 100 100" fill="none" stroke="var(--ink)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 30 L34 40 L26 62 L52 66 L46 90" opacity="0.55" />
      <path d="M92 24 L66 38 L74 58 L50 52 L56 10" opacity="0.5" />
      <path d="M14 78 L40 58 L62 74 L88 62" opacity="0.45" />
      <path d="M30 12 L44 34 L68 28 L78 46 L94 44" opacity="0.4" />
    </svg>
  )
}

/** 글씨를 쓰며 지나가는 펜 */
export function PenTool() {
  return (
    <svg className="fx-tool fx-pen" width="22" height="26" viewBox="0 0 22 26" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 24 L5 17 L16 3 L20 6 L9 20Z" fill="var(--paper)" />
      <path d="M5 17 L9 20 M14 6 L18 9" />
    </svg>
  )
}

/** 글씨를 쓸어 지우는 지우개 */
export function EraserTool() {
  return (
    <svg className="fx-tool fx-eraser" width="26" height="22" viewBox="0 0 26 22" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 14 L12 4 L23 9 L17 19 L8 19Z" fill="var(--paper)" />
      <path d="M13 6 L9 19" />
      <path d="M12 4 L23 9 L19 14 L9 11Z" fill="#f2e8c8" />
    </svg>
  )
}
