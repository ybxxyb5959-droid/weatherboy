import ClothingDoodle from './ClothingDoodle'
import { Clothespin } from './Clothesline'

interface Piece {
  type: string
  color: string
  pattern?: string
}

interface Props {
  /** 위에 크게 보이는 한 줄 (예: "옷을 걸고 있어요") */
  label: string
  /** 그 아래 작은 글씨 */
  sub?: string
  /** 줄에 걸어 보일 옷. 없으면 기본 옷 세 벌이 걸린다. 최대 4벌만 그린다. */
  pieces?: Piece[]
}

const DEFAULT_PIECES: Piece[] = [
  { type: '긴팔', color: '하늘색' },
  { type: '바지', color: '베이지' },
  { type: '자켓', color: '초록' },
]

/** 오래 걸리는 저장·사진 인식 동안 보여주는 로딩: 빨랫줄에 옷이 하나씩 걸리고 살랑살랑 흔들린다. */
export default function HangLoader({ label, sub, pieces }: Props) {
  const shown = (pieces && pieces.length > 0 ? pieces : DEFAULT_PIECES).slice(-4)
  return (
    <div className="hang-loader" role="status" aria-live="polite">
      <div className="hl-line">
        {shown.map((p, i) => (
          <div key={`${i}-${p.type}-${p.color}`} className="hl-item" style={{ '--hl-delay': `${i * 0.25}s` } as React.CSSProperties}>
            <Clothespin style={{ left: 16, top: -12 }} />
            <Clothespin style={{ left: 40, top: -12 }} />
            <ClothingDoodle type={p.type} color={p.color} pattern={p.pattern ?? '무지'} size={64} />
          </div>
        ))}
      </div>
      <p className="hl-label">{label}</p>
      {sub && <p className="tiny hl-sub">{sub}</p>}
    </div>
  )
}
