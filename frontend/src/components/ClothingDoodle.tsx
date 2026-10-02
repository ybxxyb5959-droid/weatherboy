import { colorHex } from '../mocks/clothes'

interface Props {
  type: string
  color: string
  /** 무지/체크/줄무늬/도트/프린트 (없으면 무지) */
  pattern?: string
  size?: number
}

const SHORT = 'M32 16 L10 30 L19 44 L29 39 L29 86 L71 86 L71 39 L81 44 L90 30 L68 16 Q50 28 32 16Z'
const LONG = 'M32 16 L8 66 L21 72 L31 46 L31 86 L69 86 L69 46 L79 72 L92 66 L68 16 Q50 28 32 16Z'

const SHAPES: Record<string, string> = {
  반팔: SHORT,
  셔츠: LONG,
  바지: 'M30 12 L70 12 L75 92 L56 92 L50 38 L44 92 L25 92Z',
  반바지: 'M30 12 L70 12 L77 58 L56 58 L50 34 L44 58 L23 58Z',
  치마: 'M33 12 L67 12 L86 82 Q50 94 14 82Z',
  코트: 'M32 12 L8 64 L21 70 L31 44 L28 94 L72 94 L69 44 L79 70 L92 64 L68 12 Q50 24 32 12Z',
}

// 색이 어두우면 밝은 선으로, 밝으면 어두운 선으로 무늬를 그린다
const isDark = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16)
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 110
}

const patId = (pattern: string, dark: boolean) => `wb-pat-${pattern}-${dark ? 'l' : 'd'}`

/** 체크/줄무늬/도트 타일. 같은 id 는 항상 같은 모양이라 그림이 여러 개여도 서로 겹쳐 문제되지 않는다. */
function PatternDefs({ pattern, dark }: { pattern: string; dark: boolean }) {
  const ink = dark ? '#f2f2f2' : '#222'
  const id = patId(pattern, dark)
  if (pattern === '체크')
    return (
      <defs>
        <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse">
          <rect x="0" y="5" width="14" height="3.4" fill={ink} opacity="0.36" />
          <rect x="5" y="0" width="3.4" height="14" fill={ink} opacity="0.36" />
        </pattern>
      </defs>
    )
  if (pattern === '줄무늬')
    return (
      <defs>
        <pattern id={id} width="9" height="9" patternUnits="userSpaceOnUse">
          <rect x="2" y="0" width="3" height="9" fill={ink} opacity="0.42" />
        </pattern>
      </defs>
    )
  if (pattern === '도트')
    return (
      <defs>
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="6" cy="6" r="1.9" fill={ink} opacity="0.55" />
        </pattern>
      </defs>
    )
  return null
}

/** 100x100 좌표계의 옷 그림(선/색/무늬). svg 안에서 transform 으로 크기/위치를 조절해 쓴다. */
export function ClothingArt({ type, color, pattern = '무지' }: { type: string; color: string; pattern?: string }) {
  const fill = colorHex[color] ?? color
  const shape = SHAPES[type] ?? LONG
  const dark = isDark(fill)
  const line = dark ? '#d6d6d6' : '#222'
  const tiled = pattern === '체크' || pattern === '줄무늬' || pattern === '도트'
  const bottom = type === '바지' || type === '반바지' || type === '치마'
  return (
    <>
      {tiled && <PatternDefs pattern={pattern} dark={dark} />}
      {type === '후드티' && <path d="M34 17 Q50 -4 66 17 Q50 32 34 17Z" fill={fill} stroke="#222" />}
      <path d={shape} fill={fill} stroke="#222" />
      {tiled && <path d={shape} fill={`url(#${patId(pattern, dark)})`} stroke="none" />}
      {type === '셔츠' && (
        // 깃(칼라): 목 양쪽에 접힌 삼각형. 몸판 위에 같은 색으로 덮어 그린다
        <>
          <path d="M38 15 L50 31 L43 40 L32 23Z" fill={fill} stroke="#222" />
          <path d="M62 15 L50 31 L57 40 L68 23Z" fill={fill} stroke="#222" />
        </>
      )}
      {pattern === '프린트' && (
        // 큰 그림/로고 느낌: 가슴(하의는 허리 아래)에 작은 별
        <path
          d="M50 38 L53 46 L61 46 L55 51 L57 59 L50 54 L43 59 L45 51 L39 46 L47 46Z"
          fill={dark ? '#f2f2f2' : '#fcfcfa'}
          stroke={dark ? '#d6d6d6' : '#222'}
          strokeWidth="1.8"
          transform={bottom ? 'translate(0 18)' : undefined}
        />
      )}
      <g fill="none" stroke={line} strokeWidth="1.8">
        {type === '셔츠' && <path d="M50 31 V86 M50 46 h.1 M50 58 h.1 M50 70 h.1 M50 82 h.1 M10 63 L22 69 M90 63 L78 69" strokeWidth="2.4" />}
        {type === '가디건' && <path d="M40 17 L50 44 L60 17 M50 44 V86 M45 56 h.1 M45 68 h.1 M45 80 h.1 M31 80 L69 80" strokeWidth="2.4" />}
        {type === '맨투맨' && <path d="M38 18 Q50 30 62 18 M31 80 L69 80 M10 63 L22 69 M90 63 L78 69" />}
        {type === '니트' && (
          <path d="M31 80 L69 80 M40 48 v28 M50 48 v28 M60 48 v28 M38 18 Q50 30 62 18" strokeDasharray="3 3" />
        )}
        {type === '후드티' && <path d="M46 30 v14 M54 30 v14 M38 64 L62 64 L66 80 L34 80Z" />}
        {type === '바람막이' && <path d="M50 28 V86 M40 17 L50 28 L60 17 M36 66 h9 M55 66 h9" />}
        {type === '자켓' && <path d="M42 17 L50 52 L58 17 M50 52 V86 M45 64 h.1 M45 74 h.1" strokeWidth="3" />}
        {type === '바지' && <path d="M30 20 L70 20 M50 38 V50" />}
        {type === '반바지' && <path d="M30 20 L70 20 M50 34 V44" />}
        {type === '치마' && <path d="M33 20 L67 20 M42 24 L32 84 M58 24 L68 84 M50 24 V88" />}
        {type === '코트' && <path d="M42 14 L50 50 L58 14 M50 50 V94 M44 62 h.1 M44 74 h.1 M44 86 h.1" strokeWidth="3" />}
        {type === '패딩' && <path d="M31 38 H69 M31 54 H69 M31 70 H69 M50 26 V86 M13 52 L24 56 M87 52 L76 56" />}
        {(type === '긴팔' || type === '반팔') && <path d="M40 18 Q50 27 60 18" />}
      </g>
    </>
  )
}

export default function ClothingDoodle({ type, color, pattern = '무지', size = 86 }: Props) {
  return (
    <svg
      className="doodle"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={`${color}${pattern !== '무지' ? ` ${pattern}` : ''} ${type}`}
      role="img"
    >
      <ClothingArt type={type} color={color} pattern={pattern} />
    </svg>
  )
}
