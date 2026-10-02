// 칭호마다 다른 테마 색으로, 졸라맨 뒤에 크레용으로 대충 쓱쓱 칠한 듯한 배경.
const THEME: Record<string, string | string[]> = {
  DARK_CHILD: '#8d82c4',
  MINIMALIST: '#d4d7db',
  PATTERN_MASTER: '#f6d44c',
  PASTEL_FAIRY: '#f7c3dc',
  HOODIE_ADDICT: '#97cba3',
  WARM_BEAR: '#dcae82',
  TEE_ONLY: '#ffb877',
  OUTER_FAN: '#b8b574',
  SHIRT_GENTLE: '#a6cbf2',
  SKIRT_LOVER: '#f7b6cd',
  EARTH_TONE: '#cfa982',
  BLUE_SEA: '#80bdf0',
  VITAMIN: '#ffd54f',
  RAINBOW: ['#f28b82', '#fbbc66', '#f6e27a', '#9ed89f', '#8ec3f0', '#b9a2e6'],
  BALANCED: '#a7dccb',
}
const NEUTRAL = '#e6e6df'

const jitter = (n: number) => Math.sin(n * 12.9898) * 43758.5453 - Math.floor(Math.sin(n * 12.9898) * 43758.5453) // 0~1, 항상 같은 값

/** 타원 안을 지그재그로 오가며 칠하는 선들 (행마다 살짝 삐뚤게) */
function rows(rx: number, ry: number, gap: number, seed: number): { d: string; row: number }[] {
  const out: { d: string; row: number }[] = []
  let row = 0
  for (let y = -ry + 6; y < ry - 4; y += gap, row++) {
    const k = Math.sqrt(Math.max(0, 1 - (y / ry) ** 2))
    const w = rx * k * (0.86 + jitter(seed + row) * 0.2)
    const dy = (jitter(seed + row * 3) - 0.5) * 7
    const fromLeft = row % 2 === 0
    const a = fromLeft ? -w : w
    const b = fromLeft ? w : -w
    out.push({ d: `M${a} ${y + dy} L${b} ${y + gap * 0.55 + dy}`, row })
  }
  return out
}

export default function ThemeScribble({ persona, size = 260 }: { persona: string | null | undefined; size?: number }) {
  const theme = (persona && THEME[persona]) || NEUTRAL
  const colorOf = (row: number) => (Array.isArray(theme) ? theme[row % theme.length]! : theme)
  const base = rows(104, 110, 15, 3)
  const over = rows(96, 100, 19, 11)
  return (
    <svg className="theme-scribble" width={size} height={size} viewBox="-130 -130 260 260" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g strokeWidth="15" opacity="0.5">
        {base.map((r) => (
          <path key={`a${r.row}`} d={r.d} stroke={colorOf(r.row)} />
        ))}
      </g>
      <g strokeWidth="9" opacity="0.35" transform="rotate(-7)">
        {over.map((r) => (
          <path key={`b${r.row}`} d={r.d} stroke={colorOf(r.row + 1)} />
        ))}
      </g>
    </svg>
  )
}
