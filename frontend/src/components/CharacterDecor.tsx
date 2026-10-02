import type { ReactNode } from 'react'
// 캐릭터 장식 그림: 꾸미기 아이템(모자·헤어핀·안경·목·기타)과 칭호별 상징 소품.
// StickPerson 의 'stand' 와 같은 좌표계(머리 중심 60.5,30 / 반지름 약 17)에 그린다.
export type Accessories = Partial<Record<'hat' | 'hairpin' | 'glasses' | 'neck' | 'extra', string>>

const ink = '#222'

const Star = ({ x, y, s = 1, fill = '#f2cf4a' }: { x: number; y: number; s?: number; fill?: string }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -5 L1.6 -1.6 L5 -1.2 L2.4 1.2 L3.2 4.8 L0 2.9 L-3.2 4.8 L-2.4 1.2 L-5 -1.2 L-1.6 -1.6Z" fill={fill} strokeWidth="1.2" />
)
const Sparkle = ({ x, y, s = 1, fill = '#fff6c8' }: { x: number; y: number; s?: number; fill?: string }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -5 Q0.8 -0.8 5 0 Q0.8 0.8 0 5 Q-0.8 0.8 -5 0 Q-0.8 -0.8 0 -5Z" fill={fill} strokeWidth="1" />
)
const Crescent = ({ x, y }: { x: number; y: number }) => (
  <path transform={`translate(${x} ${y})`} d="M0 0 A9 9 0 1 0 8 14 A7 7 0 1 1 0 0Z" fill="#f2cf4a" strokeWidth="1.8" />
)

const HAT: Record<string, ReactNode> = {
  beanie: (
    <g>
      <path d="M43 25 C42 4 79 4 78 25 Z" fill="#d9644f" />
      <path d="M42 25 H79" strokeWidth="5" stroke="#b84b3a" />
      <circle cx="60.5" cy="6" r="3.6" fill="#f2cf4a" />
    </g>
  ),
  cap: (
    <g>
      <path d="M44 24 C44 7 77 7 77 24 Z" fill="#4a7bb5" />
      <path d="M66 24 H90 Q93 27 88 28.5 H66Z" fill="#3a6293" />
    </g>
  ),
  bucket: (
    <g>
      <path d="M46 22 C46 9 75 9 75 22 Z" fill="#c9b27c" />
      <path d="M35 23 Q60.5 31 86 23 Q60.5 17 35 23Z" fill="#b89f66" />
    </g>
  ),
  crown: (
    <g>
      <path d="M46 22 L46 8 L53 15 L60.5 5 L68 15 L75 8 L75 22 Z" fill="#f2cf4a" />
      <circle cx="60.5" cy="17" r="1.6" fill="#d9644f" stroke="none" />
    </g>
  ),
  witch: (
    <g>
      <path d="M34 22 Q60.5 31 87 22 Q60.5 15 34 22Z" fill="#3a3a44" />
      <path d="M48 21 L62 -8 L73 21Z" fill="#3a3a44" />
      <path d="M49 19 Q60 23 72 19" stroke="#b84bd0" strokeWidth="3" />
    </g>
  ),
  'bear-ears': (
    <g>
      <circle cx="47" cy="13" r="6.2" fill="#a9774d" />
      <circle cx="47" cy="13" r="3" fill="#e9c9a8" stroke="none" />
      <circle cx="74" cy="13" r="6.2" fill="#a9774d" />
      <circle cx="74" cy="13" r="3" fill="#e9c9a8" stroke="none" />
    </g>
  ),
  'cat-ears': (
    <g>
      <path d="M44 21 L46 3 L58 13Z" fill="#555" />
      <path d="M77 21 L75 3 L63 13Z" fill="#555" />
      <path d="M47 16 L48 8 L53 13Z M74 16 L73 8 L68 13Z" fill="#f4b9b2" stroke="none" />
    </g>
  ),
}

const HAIRPIN: Record<string, ReactNode> = {
  star: <Star x={49} y={17} s={1.3} />,
  ribbon: (
    <g fill="#f08fa8">
      <path d="M49 17 L41 12 L41 22Z M49 17 L57 12 L57 22Z" />
      <circle cx="49" cy="17" r="2" fill="#d96688" />
    </g>
  ),
  flower: (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="49" cy="12.5" rx="2.6" ry="3.6" fill="#f7b6cf" transform={`rotate(${a} 49 17)`} strokeWidth="1.2" />
      ))}
      <circle cx="49" cy="17" r="2" fill="#f2cf4a" strokeWidth="1" />
    </g>
  ),
  heart: <path d="M49 21 C40 15 44 10 49 14.5 C54 10 58 15 49 21Z" fill="#e0556b" strokeWidth="1.4" />,
}

const GLASSES: Record<string, ReactNode> = {
  round: (
    <g fill="rgba(255,255,255,0.35)" strokeWidth="1.8">
      <circle cx="53" cy="30" r="5.4" />
      <circle cx="68" cy="30" r="5.4" />
      <path d="M58.4 29.5 H62.6" fill="none" />
    </g>
  ),
  square: (
    <g fill="rgba(255,255,255,0.35)" strokeWidth="1.8">
      <rect x="47.5" y="25.5" width="11" height="9" rx="1.8" />
      <rect x="62.5" y="25.5" width="11" height="9" rx="1.8" />
      <path d="M58.5 29 H62.5" fill="none" />
    </g>
  ),
  sun: (
    <g>
      <rect x="47" y="25.5" width="12" height="9" rx="3" fill="#222" />
      <rect x="62" y="25.5" width="12" height="9" rx="3" fill="#222" />
      <path d="M59 28 H62 M47 28 L42 26 M74 28 L79 26" strokeWidth="2" />
      <path d="M50 28 l3 0 M65 28 l3 0" stroke="#aaa" strokeWidth="1.2" />
    </g>
  ),
  heart: (
    <g fill="#f4a3b8" strokeWidth="1.6">
      <path d="M53 35 C45 30 48 24.5 53 28.2 C58 24.5 61 30 53 35Z" />
      <path d="M68 35 C60 30 63 24.5 68 28.2 C73 24.5 76 30 68 35Z" />
      <path d="M58.6 28.5 H62.4" fill="none" />
    </g>
  ),
}

const NECK: Record<string, ReactNode> = {
  scarf: (
    <g fill="#d9644f">
      <path d="M45 49 Q60.5 57 76 49 L76 55.5 Q60.5 63 45 55.5Z" />
      <path d="M66 58 L71 76 L62.5 73 L63.5 59Z" />
    </g>
  ),
  bowtie: (
    <g fill="#c0392b">
      <path d="M60.5 53 L49 47.5 L49 58.5Z M60.5 53 L72 47.5 L72 58.5Z" />
      <circle cx="60.5" cy="53" r="2.4" fill="#8e2a20" />
    </g>
  ),
  necklace: (
    <g>
      <path d="M48 49 Q60.5 63 73 49" stroke="#d6a93a" strokeWidth="2" fill="none" />
      <circle cx="60.5" cy="59" r="3" fill="#f2cf4a" strokeWidth="1.4" />
    </g>
  ),
}

/** 'wings' 는 몸 뒤에 그린다(BackDecor) */
const EXTRA: Record<string, ReactNode> = {
  headphones: (
    <g>
      <path d="M42 30 C39 2 82 2 79 30" fill="none" stroke="#333" strokeWidth="3" />
      <ellipse cx="42" cy="31" rx="4" ry="6.5" fill="#e05a5a" />
      <ellipse cx="79" cy="31" rx="4" ry="6.5" fill="#e05a5a" />
    </g>
  ),
  sparkle: (
    <g>
      <Sparkle x={32} y={18} s={1.3} />
      <Sparkle x={90} y={14} s={1.1} />
      <Sparkle x={86} y={52} s={1.2} />
      <Sparkle x={30} y={56} s={0.9} />
    </g>
  ),
  moon: <Crescent x={86} y={6} />,
  wings: <g />,
}

const Wing = ({ side }: { side: 'l' | 'r' }) => (
  <path d={side === 'l' ? 'M54 58 C32 34 20 58 40 76 C44 69 49 65 54 65Z' : 'M67 58 C89 34 101 58 81 76 C77 69 72 65 67 65Z'} fill="#eaf4ff" strokeWidth="2" />
)

/** 몸 뒤에 깔리는 것: 날개(꾸미기 '작은 날개' 또는 파스텔 요정의 기본), 후드티 중독자의 후드 */
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
      {hood && <path d="M39 36 C33 4 88 4 82 36" fill="none" stroke="#8fb996" strokeWidth="6" />}
    </g>
  )
}

/** 머리·목 위에 얹는 것: 칭호 상징 소품 + 꾸미기 아이템 (사용자가 고른 칸은 칭호 기본 소품보다 우선) */
export function FrontDecor({ persona, acc }: { persona?: string | null; acc: Accessories }) {
  return (
    <g>
      {/* 칭호 상징 소품: 같은 칸을 사용자가 꾸몄으면 그린 것을 양보한다 */}
      {persona === 'DARK_CHILD' && !acc.extra && (
        <g>
          <Crescent x={86} y={6} />
          <circle cx="30" cy="22" r="1.6" fill={ink} stroke="none" opacity="0.7" />
          <circle cx="26" cy="40" r="1.2" fill={ink} stroke="none" opacity="0.6" />
          <circle cx="94" cy="44" r="1.5" fill={ink} stroke="none" opacity="0.7" />
        </g>
      )}
      {persona === 'PASTEL_FAIRY' && !acc.extra && (
        <g>
          <Sparkle x={34} y={16} s={1.2} fill="#ffe3f1" />
          <Sparkle x={88} y={12} s={1} fill="#e3f3ff" />
          <Sparkle x={90} y={56} s={0.9} fill="#fff6c8" />
        </g>
      )}
      {persona === 'WARM_BEAR' && !acc.hat && HAT['bear-ears']}
      {persona === 'WARM_BEAR' && !acc.neck && NECK.scarf}
      {persona === 'HOODIE_ADDICT' && <path d="M56 49 v9 M65 49 v9" strokeWidth="2" />}
      {persona === 'PATTERN_MASTER' && !acc.neck && (
        <g>
          <path d="M46 50 Q60.5 58 75 50" stroke="#f2cf4a" strokeWidth="5" fill="none" />
          <path d="M51 53 v3 M56 55 v3 M61 56 v3 M66 55 v3 M71 53 v3" strokeWidth="1.2" />
        </g>
      )}
      {persona === 'MINIMALIST' && !acc.extra && !acc.hat && <ellipse cx="60.5" cy="6" rx="12" ry="3" fill="none" strokeWidth="1.6" />}
      {persona === 'TEE_ONLY' && !acc.extra && (
        <g>
          <circle cx="95" cy="14" r="7" fill="#f2cf4a" />
          <path d="M95 2 V5 M95 23 V26 M83 14 H86 M104 14 H107 M86.5 5.5 L88.5 7.5 M103.5 5.5 L101.5 7.5" strokeWidth="1.8" />
          <path d="M80 22 C78 26 78 28 80 29 C82 28 82 26 80 22Z" fill="#9cd4e8" stroke="#4aa6a0" strokeWidth="1.2" />
        </g>
      )}
      {persona === 'BALANCED' && !acc.hat && !acc.extra && <Star x={60.5} y={4} s={1.2} />}

      {/* 꾸미기 아이템 */}
      {acc.neck && NECK[acc.neck]}
      {acc.extra && EXTRA[acc.extra]}
      {acc.glasses && GLASSES[acc.glasses]}
      {acc.hat && HAT[acc.hat]}
      {acc.hairpin && HAIRPIN[acc.hairpin]}
    </g>
  )
}
