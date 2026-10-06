import HandText from './HandText'

export type GearKind = 'umbrella' | 'mask' | 'sunscreen'

const common = {
  fill: 'none',
  stroke: 'var(--ink)',
  strokeWidth: 2.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: 'doodle',
  'aria-hidden': true,
  viewBox: '0 0 56 56',
}

function Art({ kind, size }: { kind: GearKind; size: number }) {
  if (kind === 'umbrella')
    return (
      <svg width={size} height={size} {...common}>
        <path d="M5 28 Q28 -4 51 28 Q45 24 40 28 Q34 23 28 28 Q22 23 16 28 Q11 24 5 28Z" fill="#cfe6e2" />
        <path d="M28 28 V46 C28 52 36 52 36 46" />
        <path d="M28 8 V4" strokeWidth="2" />
      </svg>
    )
  if (kind === 'mask')
    return (
      <svg width={size} height={size} {...common}>
        <path d="M10 20 Q28 14 46 20 L44 38 Q28 46 12 38Z" fill="var(--paper)" />
        <path d="M10 22 C2 22 2 32 10 32 M46 22 C54 22 54 32 46 32" strokeWidth="1.8" />
        <path d="M16 27 H40 M16 31 H40 M17 35 H39" strokeWidth="1.4" />
      </svg>
    )
  return (
    <svg width={size} height={size} {...common}>
      <path d="M20 22 H36 L38 48 Q28 52 18 48Z" fill="#f2cf4a" />
      <path d="M23 12 H33 V22 H23Z" fill="var(--paper)" />
      <path d="M26 7 H30 V12" />
      <path d="M24 33 Q28 29 32 33 M25 40 H31" strokeWidth="1.6" />
      <path d="M44 8 V13 M48 14 L44 17 M10 10 L14 14 M8 24 H12" stroke="#e8a24a" strokeWidth="2" />
    </svg>
  )
}

const label: Record<GearKind, string> = { umbrella: '우산', mask: '마스크', sunscreen: '선크림' }
// 살짝 삐뚤게 놓아서 손으로 끄적인 느낌을 낸다
const tilt = [-4, 3, -2]

/** 준비물을 그림 낙서 + 삐뚤빼뚤 글씨로 보여준다. 필요한 게 없으면 아무것도 그리지 않는다. */
export default function GearDoodles({ items, notes }: { items: GearKind[]; notes?: Partial<Record<GearKind, string>> }) {
  if (items.length === 0) return null
  return (
    <div className="gear-wrap">
      <p className="tiny gear-caption">오늘 준비물</p>
    <ul className="gear" aria-label="오늘 준비물">
      {items.map((k, i) => (
        <li key={k} style={{ transform: `rotate(${tilt[i % tilt.length]}deg)` }}>
          <Art kind={k} size={36} />
          <span className="gear-label">
            <HandText>{label[k]}</HandText>
          </span>
          {notes?.[k] && <span className="tiny">{notes[k]}</span>}
        </li>
      ))}
    </ul>
    </div>
  )
}
