export type FeelKind = 'cold' | 'good' | 'hot'

const ink = 'var(--ink)'

/** 졸라맨 얼굴 + 몸통. 추웠어요/딱 좋아요/더웠어요 표정만 다르다. */
export default function FeedbackFace({ kind, size = 64 }: { kind: FeelKind; size?: number }) {
  return (
    <svg
      className="doodle"
      width={size}
      height={size * 1.15}
      viewBox="0 0 70 80"
      fill="none"
      stroke={ink}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 몸 + 팔 + 다리 */}
      <path d="M35 40 L35 62" />
      {kind === 'cold' && <path d="M35 46 L22 52 M35 46 L48 52 M35 62 L28 76 M35 62 L42 76" />}
      {kind === 'good' && <path d="M35 46 L20 38 M35 46 L50 38 M35 62 L28 76 M35 62 L42 76" />}
      {kind === 'hot' && <path d="M35 46 L19 42 M35 46 L51 42 M35 62 L26 74 M35 62 L44 74" />}
      {/* 머리 */}
      <path
        d="M35 6 C48 5 52 20 48 28 C44 38 26 38 22 28 C18 19 23 7 35 6Z"
        fill={kind === 'hot' ? '#f6c9b8' : kind === 'cold' ? '#d6e8f5' : 'var(--paper)'}
      />
      {kind === 'cold' && (
        <g>
          {/* 동그란 눈(눈썹은 팔자), 덜덜 떠는 입, 콧물, 떨림 선 */}
          <circle cx="29.5" cy="22" r="2.2" fill={ink} stroke="none" />
          <circle cx="40.5" cy="22" r="2.2" fill={ink} stroke="none" />
          <path d="M26 16.5 L32 18 M44 16.5 L38 18" strokeWidth="1.6" />
          <path d="M29 30 L31.5 27.5 L34 30 L36.5 27.5 L39 30" strokeWidth="1.8" />
          <path d="M37 23 C38 27 36 28 36 28" stroke="#4aa6a0" strokeWidth="1.6" />
          <path d="M14 14 L11 17 L14 20 L11 23 M56 14 L59 17 L56 20 L59 23" stroke="#4aa6a0" strokeWidth="1.6" />
        </g>
      )}
      {kind === 'good' && (
        <g>
          {/* 동그란 눈, 활짝 웃는 입 */}
          <circle cx="29.5" cy="21" r="2.2" fill={ink} stroke="none" />
          <circle cx="40.5" cy="21" r="2.2" fill={ink} stroke="none" />
          <path d="M27 27 Q35 36 43 27 Z" fill="var(--paper)" strokeWidth="1.8" />
        </g>
      )}
      {kind === 'hot' && (
        <g>
          {/* 동그란 눈, 헥헥 혀, 땀방울 */}
          <circle cx="29.5" cy="21" r="2.2" fill={ink} stroke="none" />
          <circle cx="40.5" cy="21" r="2.2" fill={ink} stroke="none" />
          <path d="M29 29 Q35 27 41 29" strokeWidth="1.8" />
          <path d="M32 29 Q35 38 38 29 Z" fill="#e8838a" strokeWidth="1.4" />
          <path d="M54 8 C51 13 51 16 54 17 C57 16 57 13 54 8Z" fill="#9cd4e8" stroke="#4aa6a0" strokeWidth="1.4" />
          <path d="M15 12 C13 15 13 17 15 18 C17 17 17 15 15 12Z" fill="#9cd4e8" stroke="#4aa6a0" strokeWidth="1.2" />
        </g>
      )}
    </svg>
  )
}
