export function Clothespin({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      className="doodle pin"
      style={style}
      width="14"
      height="28"
      viewBox="0 0 14 28"
      fill="#fcfcfa"
      stroke="#222"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 2 L11 3 L10 26 L4 25Z" />
      <path d="M3 13 L11 14" />
      <path d="M7 3 L7 12" strokeWidth="1.2" />
    </svg>
  )
}

// 졸라맨이 옷장에서 옷을 꺼내는 낙서
export function ClosetScene() {
  return (
    <div className="closet-scene">
      <svg
        className="doodle"
        width="230"
        height="150"
        viewBox="0 0 230 150"
        fill="none"
        stroke="#222"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* 옷장 몸통 */}
        <path d="M128 18 L214 20 L212 142 L130 140Z" />
        <path d="M128 18 L214 20" strokeWidth="3" />
        {/* 열린 문 */}
        <path d="M128 20 L100 30 L100 132 L130 140" />
        <path d="M106 80 h.1" strokeWidth="4" />
        {/* 봉 + 옷걸이 */}
        <path d="M134 40 L208 41" />
        <path d="M150 41 l0 -4 M150 41 l-9 9 l18 0 Z" strokeWidth="1.8" />
        <path d="M176 41 l-9 9 l18 0 Z" strokeWidth="1.8" />
        <path d="M190 52 L192 100 L200 100 L198 52Z" fill="#79b87a" strokeWidth="1.8" />
        <path d="M144 118 h56" strokeWidth="1.6" />
        {/* 졸라맨 */}
        <path d="M44 22 C58 20 62 36 58 44 C53 56 34 54 30 43 C26 33 31 23 45 21 L50 24" />
        <circle cx="39" cy="35" r="1.6" fill="#222" stroke="none" />
        <circle cx="51" cy="35" r="1.6" fill="#222" stroke="none" />
        <path d="M41.5 41.5 Q45 44.5 48.5 41.5" />
        <path d="M45 55 L46 100" />
        <path d="M46 100 L30 140 M46 100 L62 138" />
        <path d="M45 66 L26 90" />
        <path d="M45 66 L90 62 L112 68" />
        {/* 꺼내는 옷 */}
        <path d="M104 60 L96 70 L102 76 L108 72 L108 96 L128 96 L128 72 L134 76 L140 70 L132 60 Q118 70 104 60Z" fill="#e8a24a" strokeWidth="2" />
      </svg>
    </div>
  )
}
