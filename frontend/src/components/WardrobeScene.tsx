import ClothingDoodle from './ClothingDoodle'
import type { StagePhase } from './EventStylist'

// 졸라맨이 달려가 뒤적이는 옷장. 뒤적이는 동안 옷이 튀어나온다. 문은 뒤적일 때만 열린다.
const FLY: { type: string; color: string }[] = [
  { type: '셔츠', color: '하늘색' },
  { type: '반팔', color: '주황' },
  { type: '바지', color: '검정' },
  { type: '가디건', color: '베이지' },
  { type: '맨투맨', color: '회색' },
]

export default function WardrobeScene({ phase }: { phase: StagePhase }) {
  const open = phase === 'dig' || phase === 'change'
  return (
    <div className={`stage-scene${open ? ' open' : ''}`} data-phase={phase} aria-hidden="true">
      <div className="stage-caption tiny">{phase === 'run' ? '옷장으로 달려가요!' : phase === 'dig' ? '뒤적뒤적…' : phase === 'change' ? '갈아입는 중…' : '짠!'}</div>
      <svg className="doodle stage-wardrobe" width="76" height="116" viewBox="0 0 76 116" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="6" width="68" height="104" rx="3" fill="#e7dcc4" />
        {/* 안쪽: 옷걸이 봉과 걸린 옷 */}
        <rect x="8" y="10" width="60" height="96" fill="#cdbf9f" strokeWidth="1.4" />
        <path d="M10 26 H66" strokeWidth="2" />
        <path d="M18 26 V40 M30 26 V44 M44 26 V38 M56 26 V42" strokeWidth="1.6" />
        <path d="M13 40 H23 L25 66 H11Z M25 44 H35 L37 74 H23Z M39 38 H49 L51 62 H37Z" fill="#a9b7c9" strokeWidth="1.4" />
        {/* 문 두 짝: 열리면 옆으로 접힌다 */}
        <g className="door door-l">
          <rect x="4" y="6" width="34" height="104" rx="2" fill="#e7dcc4" />
          <path d="M33 56 v10" strokeWidth="3" />
        </g>
        <g className="door door-r">
          <rect x="38" y="6" width="34" height="104" rx="2" fill="#e7dcc4" />
          <path d="M43 56 v10" strokeWidth="3" />
        </g>
        <path d="M10 110 v5 M66 110 v5" />
      </svg>
      {FLY.map((f, i) => (
        <span key={f.type} className="stage-fly" style={{ ['--k' as string]: i }}>
          <ClothingDoodle type={f.type} color={f.color} size={30} />
        </span>
      ))}
      <span className="stage-poof">✦</span>
    </div>
  )
}
