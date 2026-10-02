import type { ReactNode } from 'react'

// 캐릭터 장식 그림: 꾸미기 아이템(모자·헤어핀·안경·목·얼굴·기타)과 칭호별 상징 소품.
// StickPerson 의 'stand' 와 같은 좌표계(머리 중심 60.5,30 / 반지름 약 17.5, 눈 53.5·66.5, 입 56~64 x 35.5~41.5)에 그린다.
export type Slot = 'hat' | 'hairpin' | 'glasses' | 'neck' | 'face' | 'extra'
export type Accessories = Partial<Record<Slot, string>>

const ink = '#222'
const PAPER = '#fcfcfa'

// ───── 작은 도형 ─────
const Star = ({ x, y, s = 1, fill = '#f6d44c' }: { x: number; y: number; s?: number; fill?: string }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -5 L1.6 -1.6 L5 -1.2 L2.4 1.2 L3.2 4.8 L0 2.9 L-3.2 4.8 L-2.4 1.2 L-5 -1.2 L-1.6 -1.6Z" fill={fill} strokeWidth="1.3" />
)
const Sparkle = ({ x, y, s = 1, fill = '#fff3b8' }: { x: number; y: number; s?: number; fill?: string }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -5 Q0.8 -0.8 5 0 Q0.8 0.8 0 5 Q-0.8 0.8 -5 0 Q-0.8 -0.8 0 -5Z" fill={fill} strokeWidth="1" />
)
const Heart = ({ x, y, s = 1, fill = '#ef6f86' }: { x: number; y: number; s?: number; fill?: string }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 5 C-8 -1 -4 -6 0 -2 C4 -6 8 -1 0 5Z" fill={fill} strokeWidth="1.3" />
)
const Crescent = ({ x, y }: { x: number; y: number }) => <path transform={`translate(${x} ${y})`} d="M0 0 A9 9 0 1 0 8 14 A7 7 0 1 1 0 0Z" fill="#f6d44c" strokeWidth="1.8" />
const Dot = ({ x, y, r = 1.4, o = 0.7 }: { x: number; y: number; r?: number; o?: number }) => <circle cx={x} cy={y} r={r} fill={ink} stroke="none" opacity={o} />
const Flower = ({ x, y, s = 1, petal = '#f9b7d2', center = '#f6d44c' }: { x: number; y: number; s?: number; petal?: string; center?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} strokeWidth="1.2">
    {[0, 72, 144, 216, 288].map((a) => (
      <ellipse key={a} cx="0" cy="-3.6" rx="2.4" ry="3.4" fill={petal} transform={`rotate(${a})`} />
    ))}
    <circle r="2" fill={center} />
  </g>
)

// ───── 모자 ─────
const HAT: Record<string, ReactNode> = {
  beanie: (
    <g>
      <path d="M43 25 C41 3 80 3 78 25 Z" fill="#f08a7a" />
      <rect x="41" y="21" width="39" height="7" rx="3.5" fill="#e0675a" />
      <circle cx="60.5" cy="5" r="4.4" fill="#fff" />
    </g>
  ),
  cap: (
    <g>
      <path d="M44 24 C43 5 78 5 77 24 Z" fill="#6fa8dc" />
      <path d="M64 24 H91 Q94 28 88 29.5 H64Z" fill="#5a92c7" />
      <circle cx="60.5" cy="7" r="1.8" fill="#5a92c7" />
    </g>
  ),
  bucket: (
    <g>
      <path d="M46 22 C45 7 76 7 75 22 Z" fill="#ead6a6" />
      <path d="M34 23 Q60.5 32 87 23 Q60.5 16 34 23Z" fill="#dcc48c" />
    </g>
  ),
  beret: (
    <g>
      <path d="M43 20 C40 4 80 1 80 14 C80 22 58 24 43 20Z" fill="#d86a68" />
      <circle cx="68" cy="3.5" r="2.4" fill="#b9504e" />
    </g>
  ),
  straw: (
    <g>
      <path d="M46 21 C45 7 76 7 75 21 Z" fill="#f4e2a8" />
      <path d="M31 23 Q60.5 33 90 23 Q60.5 15 31 23Z" fill="#ecd290" />
      <path d="M46 19 Q60.5 24 75 19" stroke="#e0675a" strokeWidth="4" fill="none" />
    </g>
  ),
  crown: (
    <g>
      <path d="M45 22 L44 7 L52 14 L60.5 3 L69 14 L77 7 L76 22 Z" fill="#f6d44c" />
      <circle cx="52" cy="18" r="1.6" fill="#ef6f86" stroke="none" />
      <circle cx="60.5" cy="18" r="1.6" fill="#6fa8dc" stroke="none" />
      <circle cx="69" cy="18" r="1.6" fill="#ef6f86" stroke="none" />
    </g>
  ),
  'flower-crown': (
    <g>
      <path d="M44 20 Q60.5 6 77 20" stroke="#7fb27a" strokeWidth="3" fill="none" />
      <Flower x={49} y={15} s={1.1} petal="#f9b7d2" />
      <Flower x={60.5} y={10.5} s={1.2} petal="#fff" />
      <Flower x={72} y={15} s={1.1} petal="#c9b3f0" />
    </g>
  ),
  witch: (
    <g>
      <path d="M33 23 Q60.5 32 88 23 Q60.5 15 33 23Z" fill="#43404f" />
      <path d="M48 21 Q56 4 64 -8 Q68 6 73 21Z" fill="#43404f" />
      <path d="M49.5 18 Q60.5 23 72 18" stroke="#b66be0" strokeWidth="3.4" fill="none" />
      <Star x={61} y={13} s={0.7} />
    </g>
  ),
  santa: (
    <g>
      <path d="M43 24 C42 6 70 0 84 12 C74 12 70 14 78 24Z" fill="#e5484d" />
      <rect x="41" y="21" width="39" height="7" rx="3.5" fill="#fff" />
      <circle cx="84" cy="13" r="4.2" fill="#fff" />
    </g>
  ),
  'bear-ears': (
    <g>
      <circle cx="46.5" cy="13.5" r="6.6" fill="#b88457" />
      <circle cx="46.5" cy="13.5" r="3.2" fill="#f0d3b4" stroke="none" />
      <circle cx="74.5" cy="13.5" r="6.6" fill="#b88457" />
      <circle cx="74.5" cy="13.5" r="3.2" fill="#f0d3b4" stroke="none" />
    </g>
  ),
  'cat-ears': (
    <g>
      <path d="M43 22 Q42 8 47 2 Q54 6 59 13Z" fill="#5b5864" />
      <path d="M78 22 Q79 8 74 2 Q67 6 62 13Z" fill="#5b5864" />
      <path d="M47 15 Q47 10 49 7 Q52 9 54 12Z M74 15 Q74 10 72 7 Q69 9 67 12Z" fill="#f4b9c2" stroke="none" />
    </g>
  ),
  'bunny-ears': (
    <g>
      <ellipse cx="51" cy="0" rx="4.6" ry="13" fill="#fff" transform="rotate(-10 51 8)" />
      <ellipse cx="51" cy="0" rx="2" ry="9" fill="#f9b7c6" stroke="none" transform="rotate(-10 51 8)" />
      <ellipse cx="70" cy="0" rx="4.6" ry="13" fill="#fff" transform="rotate(10 70 8)" />
      <ellipse cx="70" cy="0" rx="2" ry="9" fill="#f9b7c6" stroke="none" transform="rotate(10 70 8)" />
    </g>
  ),
}

// ───── 헤어핀 (왼쪽 앞머리 자리) ─────
const HAIRPIN: Record<string, ReactNode> = {
  star: <Star x={49} y={18} s={1.4} />,
  ribbon: (
    <g fill="#f4879f">
      <path d="M49 18 L40.5 12.5 Q39 18 40.5 23.5Z M49 18 L57.5 12.5 Q59 18 57.5 23.5Z" />
      <circle cx="49" cy="18" r="2.2" fill="#d96688" />
    </g>
  ),
  flower: <Flower x={49} y={18} s={1.3} />,
  heart: <Heart x={49} y={18} s={1.2} />,
  butterfly: (
    <g strokeWidth="1.3">
      <ellipse cx="45" cy="14.5" rx="4.2" ry="3.4" fill="#9fc9f3" />
      <ellipse cx="53" cy="14.5" rx="4.2" ry="3.4" fill="#9fc9f3" />
      <ellipse cx="45.5" cy="20.5" rx="3.2" ry="2.8" fill="#c9b3f0" />
      <ellipse cx="52.5" cy="20.5" rx="3.2" ry="2.8" fill="#c9b3f0" />
      <path d="M49 12 V23" strokeWidth="1.8" />
    </g>
  ),
  cloud: (
    <g fill="#e6f3ff" strokeWidth="1.3">
      <circle cx="45" cy="19" r="3.6" />
      <circle cx="50" cy="16.5" r="4.4" />
      <circle cx="55" cy="19" r="3.6" />
    </g>
  ),
  lightning: <path d="M51 10 L44 19.5 L49 19.5 L46 27 L55 17 L50 17Z" fill="#f6d44c" strokeWidth="1.4" />,
  cherry: (
    <g strokeWidth="1.3">
      <path d="M46 20 Q48 12 52 9 M54 20 Q53 13 52 9" fill="none" stroke="#5e8d4f" strokeWidth="1.6" />
      <circle cx="46" cy="22" r="3.6" fill="#e5484d" />
      <circle cx="54" cy="22" r="3.6" fill="#e5484d" />
    </g>
  ),
}

// ───── 안경 (눈 53.5, 66.5 @ y 30) ─────
const GLASSES: Record<string, ReactNode> = {
  round: (
    <g fill="rgba(255,255,255,0.4)" strokeWidth="1.8">
      <circle cx="53.5" cy="30" r="5.6" />
      <circle cx="67" cy="30" r="5.6" />
      <path d="M59 29.5 H61.5" fill="none" />
    </g>
  ),
  square: (
    <g fill="rgba(255,255,255,0.4)" strokeWidth="1.8">
      <rect x="48" y="25.5" width="11" height="9" rx="2.4" />
      <rect x="62" y="25.5" width="11" height="9" rx="2.4" />
      <path d="M59 29 H62" fill="none" />
    </g>
  ),
  sun: (
    <g>
      <rect x="47.5" y="25.5" width="12" height="9" rx="3.6" fill="#2b2b33" />
      <rect x="61.5" y="25.5" width="12" height="9" rx="3.6" fill="#2b2b33" />
      <path d="M59.5 28 H61.5 M47.5 28 L42.5 26 M73.5 28 L78.5 26" strokeWidth="2" />
      <path d="M50 28.5 h3 M64 28.5 h3" stroke="#9aa" strokeWidth="1.2" />
    </g>
  ),
  heart: (
    <g strokeWidth="1.6">
      <Heart x={53.5} y={30.5} s={1.4} fill="#f4a3b8" />
      <Heart x={67} y={30.5} s={1.4} fill="#f4a3b8" />
      <path d="M59.5 28.5 H61" fill="none" />
    </g>
  ),
  star: (
    <g strokeWidth="1.5">
      <Star x={53.5} y={30} s={1.5} fill="#ffe88a" />
      <Star x={67} y={30} s={1.5} fill="#ffe88a" />
      <path d="M59 29 H61.5" fill="none" />
    </g>
  ),
  'cat-eye': (
    <g fill="rgba(255,255,255,0.4)" strokeWidth="1.8">
      <path d="M48 28 Q53 24 59 28 Q58 35 53 35 Q48 35 48 28Z M47 26 L48.5 28" />
      <path d="M74 28 Q69 24 62 28 Q63 35 68 35 Q74 35 74 28Z M75 26 L73.5 28" />
      <path d="M59 28 H62" fill="none" />
    </g>
  ),
}

// ───── 목 (목 y≈48) ─────
const NECK: Record<string, ReactNode> = {
  scarf: (
    <g fill="#ef7a6a">
      <path d="M45 49 Q60.5 57 76 49 L76 56 Q60.5 64 45 56Z" />
      <path d="M66 58 L71 77 L62 74 L63.5 59Z" />
    </g>
  ),
  'striped-scarf': (
    <g>
      <path d="M45 49 Q60.5 57 76 49 L76 56 Q60.5 64 45 56Z" fill="#fff" />
      <path d="M52 52.5 L51 60 M60.5 54.5 V62 M69 52.5 L70 60" stroke="#e5484d" strokeWidth="3" />
      <path d="M45 49 Q60.5 57 76 49 L76 56 Q60.5 64 45 56Z" fill="none" />
      <path d="M66 58 L71 77 L62 74 L63.5 59Z" fill="#fff" />
      <path d="M65 64 L69 65 M64 69 L70 70.5" stroke="#e5484d" strokeWidth="3" />
    </g>
  ),
  bowtie: (
    <g fill="#e5484d">
      <path d="M60.5 53 L48.5 47.5 Q47 53 48.5 58.5Z M60.5 53 L72.5 47.5 Q74 53 72.5 58.5Z" />
      <circle cx="60.5" cy="53" r="2.6" fill="#b5353a" />
    </g>
  ),
  tie: (
    <g fill="#e5484d">
      <path d="M57 50 H64 L62.5 54 L66 70 L60.5 75 L55 70 L58.5 54Z" />
      <path d="M56 48.5 H65 L63 52 H58Z" fill="#b5353a" />
    </g>
  ),
  necklace: (
    <g>
      <path d="M48 49 Q60.5 63 73 49" stroke="#d9ac3c" strokeWidth="2" fill="none" />
      <Heart x={60.5} y={59.5} s={0.9} fill="#f6d44c" />
    </g>
  ),
  bell: (
    <g>
      <path d="M46 50 Q60.5 58 75 50" stroke="#e5484d" strokeWidth="4" fill="none" />
      <circle cx="60.5" cy="59" r="3.8" fill="#f6d44c" />
      <path d="M57.5 59 H63.5 M60.5 62.5 v1.5" strokeWidth="1.2" />
    </g>
  ),
}

// ───── 얼굴 ─────
const FACE: Record<string, ReactNode> = {
  blush: (
    <g stroke="none" fill="#f7a3ae" opacity="0.85">
      <ellipse cx="47.5" cy="36" rx="3.8" ry="2.6" />
      <ellipse cx="73.5" cy="36" rx="3.8" ry="2.6" />
    </g>
  ),
  freckles: (
    <g stroke="none" fill="#b9774d">
      {[[47, 35], [50, 37.5], [51.5, 34.5], [70, 34.5], [71.5, 37.5], [74.5, 35.5]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" />
      ))}
    </g>
  ),
  mustache: <path d="M60.5 34.6 Q57 31 52.5 34 Q55 37.2 60.5 34.6 Q66 37.2 68.5 34 Q64 31 60.5 34.6Z" fill="#4a3a34" strokeWidth="1.2" />,
  bandaid: (
    <g fill="#f3c9a4" strokeWidth="1.4" transform="rotate(-25 72 35)">
      <rect x="66.5" y="32.5" width="11" height="5.4" rx="2.4" />
      <rect x="69.7" y="32.5" width="4.6" height="5.4" fill="#f7dcc0" stroke="none" />
    </g>
  ),
  'star-sticker': <Star x={73} y={35.5} s={1.2} fill="#ffd84d" />,
}

// ───── 기타 ('wings' 는 몸 뒤에 그린다: BackDecor) ─────
const EXTRA: Record<string, ReactNode> = {
  headphones: (
    <g>
      <path d="M42 30 C39 1 82 1 79 30" fill="none" stroke="#43404f" strokeWidth="3" />
      <ellipse cx="42" cy="31" rx="4.2" ry="6.6" fill="#ef6f86" />
      <ellipse cx="79" cy="31" rx="4.2" ry="6.6" fill="#ef6f86" />
    </g>
  ),
  sparkle: (
    <g>
      <Sparkle x={32} y={18} s={1.4} />
      <Sparkle x={90} y={14} s={1.2} />
      <Sparkle x={87} y={54} s={1.3} />
      <Sparkle x={31} y={58} s={1} />
    </g>
  ),
  moon: <Crescent x={86} y={6} />,
  wings: <g />,
  balloon: (
    <g>
      <path d="M92 20 Q90 40 88 58" fill="none" strokeWidth="1.4" />
      <ellipse cx="92" cy="12" rx="7" ry="8.4" fill="#ef6f86" />
      <path d="M90 20 l2 3 l2 -3Z" fill="#ef6f86" />
      <path d="M88 8 Q89 5 91.5 4.5" stroke="#fff" strokeWidth="1.6" fill="none" />
    </g>
  ),
  snow: (
    <g stroke="#9cc7ee" strokeWidth="1.6">
      {[[32, 16], [90, 22], [86, 52], [34, 50], [60, -2]].map(([x, y]) => (
        <path key={`${x}-${y}`} transform={`translate(${x} ${y})`} d="M0 -4 V4 M-3.5 -2 L3.5 2 M-3.5 2 L3.5 -2" />
      ))}
    </g>
  ),
  butterflies: (
    <g strokeWidth="1.1">
      {[[34, 20, '#9fc9f3'], [88, 46, '#f7b6d2']].map(([x, y, c]) => (
        <g key={String(x)} transform={`translate(${x} ${y})`}>
          <ellipse cx="-3" cy="-2" rx="3.4" ry="2.6" fill={c as string} />
          <ellipse cx="3" cy="-2" rx="3.4" ry="2.6" fill={c as string} />
          <ellipse cx="-2.4" cy="2.2" rx="2.4" ry="2" fill="#fff" />
          <ellipse cx="2.4" cy="2.2" rx="2.4" ry="2" fill="#fff" />
          <path d="M0 -4 V4" strokeWidth="1.4" />
        </g>
      ))}
    </g>
  ),
  rainbow: (
    <g fill="none" strokeWidth="3" strokeLinecap="round">
      <path d="M30 24 A31 26 0 0 1 91 24" stroke="#ef7a6a" />
      <path d="M34 24 A27 22 0 0 1 87 24" stroke="#f6d44c" />
      <path d="M38 24 A23 18 0 0 1 83 24" stroke="#7fb8ee" />
    </g>
  ),
}

/** 아이템 id -> 그림 (꾸미기 화면의 미리보기에서도 쓴다) */
export const ITEM_ART: Record<Slot, Record<string, ReactNode>> = { hat: HAT, hairpin: HAIRPIN, glasses: GLASSES, neck: NECK, face: FACE, extra: EXTRA }

const Wing = ({ side }: { side: 'l' | 'r' }) => (
  <path d={side === 'l' ? 'M54 58 C30 32 16 58 40 78 C44 70 49 66 54 66Z' : 'M67 58 C91 32 105 58 81 78 C77 70 72 66 67 66Z'} fill="#eef6ff" strokeWidth="2" />
)

/** 몸 뒤에 깔리는 것: 날개(꾸미기 '작은 날개' 또는 파스텔 요정 기본), 후드티 중독자의 후드 */
export function BackDecor({ persona, acc }: { persona?: string | null; acc: Accessories }) {
  const wings = acc.extra === 'wings' || (!acc.extra && persona === 'PASTEL_FAIRY')
  const hood = persona === 'HOODIE_ADDICT' && !acc.hat && acc.extra !== 'headphones'
  return (
    <g>
      {wings && (
        <g>
          <Wing side="l" />
          <Wing side="r" />
        </g>
      )}
      {hood && <path d="M39 36 C33 4 88 4 82 36" fill="none" stroke="#8fc29b" strokeWidth="6" />}
    </g>
  )
}

/** 칭호 상징 소품 (사용자가 같은 칸을 꾸몄으면 그 칸의 소품은 양보한다) */
function PersonaDecor({ persona, acc }: { persona: string; acc: Accessories }) {
  const free = !acc.extra
  switch (persona) {
    case 'DARK_CHILD':
      return free ? (
        <g>
          <Crescent x={86} y={6} />
          <Dot x={30} y={22} r={1.8} />
          <Dot x={26} y={42} r={1.3} o={0.55} />
          <Dot x={94} y={46} r={1.6} />
        </g>
      ) : null
    case 'PASTEL_FAIRY':
      return free ? (
        <g>
          <Sparkle x={34} y={16} s={1.3} fill="#ffe3f1" />
          <Sparkle x={89} y={12} s={1.1} fill="#e3f3ff" />
          <Sparkle x={91} y={56} s={1} fill="#fff3b8" />
        </g>
      ) : null
    case 'WARM_BEAR':
      return (
        <g>
          {!acc.hat && HAT['bear-ears']}
          {!acc.neck && NECK.scarf}
        </g>
      )
    case 'HOODIE_ADDICT':
      return <path d="M56 49 v9 M65 49 v9" strokeWidth="2" />
    case 'PATTERN_MASTER':
      return !acc.neck ? (
        <g>
          <path d="M46 50 Q60.5 58 75 50" stroke="#f6d44c" strokeWidth="5" fill="none" />
          <path d="M51 53 v3 M56 55 v3 M61 56 v3 M66 55 v3 M71 53 v3" strokeWidth="1.2" />
        </g>
      ) : null
    case 'MINIMALIST':
      return free && !acc.hat ? <ellipse cx="60.5" cy="6" rx="12" ry="3" fill="none" strokeWidth="1.6" /> : null
    case 'TEE_ONLY':
      return free ? (
        <g>
          <circle cx="95" cy="14" r="7" fill="#f6d44c" />
          <path d="M95 2 V5 M95 23 V26 M83 14 H86 M104 14 H107 M86.5 5.5 L88.5 7.5 M103.5 5.5 L101.5 7.5" strokeWidth="1.8" />
          <path d="M80 22 C78 26 78 28 80 29 C82 28 82 26 80 22Z" fill="#9cd4e8" stroke="#4aa6a0" strokeWidth="1.2" />
        </g>
      ) : null
    case 'OUTER_FAN':
      return free ? (
        <g>
          <path d="M86 6 Q86 1 91 1 Q96 1 96 6 Q96 9 91 11 L91 14 M76 22 L91 14 L106 22 Z" fill="none" strokeWidth="1.8" />
        </g>
      ) : null
    case 'SHIRT_GENTLE':
      return !acc.neck ? NECK.tie : null
    case 'SKIRT_LOVER':
      return free ? (
        <g>
          <Flower x={32} y={18} s={1} petal="#f9b7d2" />
          <Flower x={90} y={50} s={0.9} petal="#fff" />
          <Flower x={28} y={56} s={0.8} petal="#c9b3f0" />
        </g>
      ) : null
    case 'EARTH_TONE':
      return free ? (
        <g>
          <path d="M82 12 H98 V21 Q98 28 90 28 Q82 28 82 21Z" fill="#b88457" strokeWidth="1.8" />
          <path d="M98 14 Q104 14 104 19 Q104 23 98 23" fill="none" strokeWidth="1.8" />
          <path d="M86 9 Q84 6 86 3 M92 9 Q90 6 92 3" fill="none" strokeWidth="1.4" opacity="0.6" />
        </g>
      ) : null
    case 'BLUE_SEA':
      return free ? (
        <g fill="rgba(180,215,245,0.6)" strokeWidth="1.4">
          <circle cx="92" cy="14" r="5" />
          <circle cx="98" cy="28" r="3" />
          <circle cx="28" cy="20" r="4" />
          <circle cx="24" cy="36" r="2.4" />
        </g>
      ) : null
    case 'VITAMIN':
      return free ? (
        <g>
          <circle cx="94" cy="14" r="7.4" fill="#ffb347" strokeWidth="1.8" />
          <path d="M94 7 V21 M87 14 H101 M89 9 L99 19 M99 9 L89 19" strokeWidth="1" opacity="0.6" />
          <path d="M30 14 L33 21 M24 22 L31 24 M36 8 L37 14" strokeWidth="1.8" stroke="#f6a623" />
        </g>
      ) : null
    case 'RAINBOW':
      return free && !acc.hat ? EXTRA.rainbow : null
    case 'BALANCED':
      return free && !acc.hat ? <Star x={60.5} y={4} s={1.3} /> : null
    default:
      return null
  }
}

/** 머리·목 위에 얹는 것: 칭호 상징 소품 + 꾸미기 아이템 */
export function FrontDecor({ persona, acc }: { persona?: string | null; acc: Accessories }) {
  return (
    <g>
      {persona && <PersonaDecor persona={persona} acc={acc} />}
      {acc.neck && NECK[acc.neck]}
      {acc.extra && EXTRA[acc.extra]}
      {acc.face && FACE[acc.face]}
      {acc.glasses && GLASSES[acc.glasses]}
      {acc.hat && HAT[acc.hat]}
      {acc.hairpin && HAIRPIN[acc.hairpin]}
    </g>
  )
}

// 아이템 미리보기에서 보여줄 영역(그림 좌표)
const THUMB_BOX: Record<Slot, string> = {
  hat: '28 -14 66 48',
  hairpin: '34 2 32 32',
  glasses: '38 18 46 24',
  neck: '38 38 46 44',
  face: '38 22 46 28',
  extra: '14 -6 94 74',
}
const HEAD = 'M60.5 12.5 C71 11.5 78.5 20 77.5 30.5 C76.5 40 70 48 60 48 C50 48 42.5 40.5 42.5 30 C42.5 20.5 49.5 13 60.5 12.5Z'

/** 꾸미기 아이템 하나를 머리 위에 얹은 작은 그림 (꾸미기 화면의 고르는 칸) */
export function ItemThumb({ slot, id, size = 54 }: { slot: Slot; id: string; size?: number }) {
  const acc: Accessories = { [slot]: id }
  const [, , w, h] = THUMB_BOX[slot].split(' ').map(Number)
  return (
    <svg width={size} height={(size * h!) / w!} viewBox={THUMB_BOX[slot]} fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={HEAD} fill={PAPER} />
      <g transform="translate(0 0)">
        <g stroke="none">
          <circle cx="53.5" cy="30" r="1.9" fill={ink} />
          <circle cx="66.5" cy="29.5" r="1.9" fill={ink} />
        </g>
        <path d="M57 36 Q60.5 39.5 64 36" strokeWidth="1.8" />
      </g>
      <BackDecor acc={acc} />
      <FrontDecor acc={acc} />
    </svg>
  )
}
