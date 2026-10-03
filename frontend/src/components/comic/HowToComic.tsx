import { memo, type ReactNode } from 'react'
import { ClothingArt } from '../ClothingDoodle'
import FeedbackFace from '../FeedbackFace'
import FigureArt from '../FigureArt'
import HandText from '../HandText'
import { buildPose, type Pose } from '../greetingPose'

// "이렇게 사용해보세요" 4컷 만화. 움직임 없이 처음부터 완성된 그림으로 보여준다.

type Pt = readonly [number, number]
const INK = '#222'
const PAPER = '#fcfcfa'

/** 자로 댄 듯한 직사각형 대신, 모서리마다 조금씩 어긋나고 변이 살짝 휜 손그림 사각형 */
function Rough({ x, y, width, height, fill, stroke, strokeWidth }: { x: number; y: number; width: number; height: number; fill?: string; stroke?: string; strokeWidth?: number }) {
  const j = (n: number, amp = 2.4) => Math.sin(x * 12.9898 + y * 78.233 + n * 37.719) * amp
  const f = (v: number) => v.toFixed(1)
  const x2 = x + width
  const y2 = y + height
  const mx = x + width / 2
  const my = y + height / 2
  const d =
    `M${f(x + j(1))} ${f(y + j(2))} Q${f(mx)} ${f(y + j(3, 3.5))} ${f(x2 + j(4))} ${f(y + j(5))} ` +
    `Q${f(x2 + j(6, 3.5))} ${f(my)} ${f(x2 + j(7))} ${f(y2 + j(8))} ` +
    `Q${f(mx)} ${f(y2 + j(9, 3.5))} ${f(x + j(10))} ${f(y2 + j(11))} ` +
    `Q${f(x + j(12, 3.5))} ${f(my)} ${f(x + j(1) + 2.5)} ${f(y + j(2) - 3)}`
  return <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
}

/** 졸라맨 한 명을 (tx,ty)에 s 배로 놓는다 */
function Fig({ pose, id, tx, ty, s, face }: { pose: Pose; id: string; tx: number; ty: number; s: number; face?: 'smile' | 'flat' | 'cry' }) {
  return (
    <g transform={`translate(${tx} ${ty}) scale(${s})`}>
      <FigureArt pose={pose} id={id} face={face} />
    </g>
  )
}
/** 졸라맨의 손 위치(장면 좌표) */
const handAt = (pose: Pose, side: 'L' | 'R', tx: number, ty: number, s: number): Pt => {
  const h = side === 'L' ? pose.handL : pose.handR
  return [tx + (h[0] + 10) * s, ty + h[1] * s]
}

const Phone = ({ x, y, r = 0 }: { x: number; y: number; r?: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${r})`}>
    <rect x="-8" y="-13" width="16" height="26" rx="3.5" fill={PAPER} strokeWidth="2" />
    <rect x="-5" y="-9" width="10" height="15" rx="1.2" fill="#dcebf5" strokeWidth="1" />
  </g>
)
const Cloth = ({ type, color, x, y, s, w = 5.5 }: { type: string; color: string; x: number; y: number; s: number; w?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} strokeWidth={w}>
    <ClothingArt type={type} color={color} />
  </g>
)
const Sparkle = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -5 Q0.8 -0.8 5 0 Q0.8 0.8 0 5 Q-0.8 0.8 -5 0 Q-0.8 -0.8 0 -5Z" fill="#f6d44c" strokeWidth="1.2" />
)
const Heart = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 5 C-8 -1 -4 -6 0 -2 C4 -6 8 -1 0 5Z" fill="#ef6f86" strokeWidth="1.4" />
)
const Arrow = ({ d, head }: { d: string; head: string }) => (
  <g strokeWidth="2.2">
    <path d={d} />
    <path d={head} />
  </g>
)

// ───── 1컷: 옷장 사진을 찰칵 -> 내 옷으로 ─────
const P1 = buildPose(88, 28)
const Scene1 = memo(function Scene1() {
  const [hx, hy] = handAt(P1, 'L', 112, 20, 0.9)
  return (
    <>
      {/* 옷장 */}
      <Rough x={6} y={16} width={86} height={158} />
      <path d="M49 16 V174 M6 100 H92" />
      <path d="M12 36 H44 M54 36 H86" />
      <Cloth type="반팔" color="주황" x={11} y={40} s={0.34} />
      <Cloth type="셔츠" color="하늘색" x={53} y={40} s={0.34} />
      <Cloth type="바지" color="파랑" x={11} y={108} s={0.34} />
      <Cloth type="맨투맨" color="회색" x={53} y={108} s={0.34} />
      {/* 사진 찍는 졸라맨 */}
      <Fig pose={P1} id="c1" tx={112} ty={20} s={0.9} />
      <Phone x={hx - 9} y={hy - 2} r={-6} />
      <g stroke="#e0a81e" strokeWidth="2.4">
        <path d={`M${hx - 24} ${hy - 12} l-8 -6 M${hx - 27} ${hy} h-10 M${hx - 24} ${hy + 12} l-8 6`} />
      </g>
      {/* 앱에 등록된 옷 */}
      <Arrow d={`M${hx - 6} ${hy - 22} Q150 -2 224 34`} head="M213 28 L225 35 L211 40" />
      <Rough x={226} y={40} width={68} height={104} fill={PAPER} />
      <Cloth type="반팔" color="주황" x={235} y={48} s={0.5} w={4} />
      <path d="M247 116 l8 9 l16 -18" stroke="#3f9a52" strokeWidth="3.4" />
    </>
  )
})

// ───── 2컷: 아침에 확인하고, 애인/친구에게 공유 ─────
const P2A = buildPose(28, 82)
const P2B = buildPose(82, 28)
const Scene2 = memo(function Scene2() {
  const [ax, ay] = handAt(P2A, 'R', 2, 24, 0.82)
  const [bx, by] = handAt(P2B, 'L', 190, 30, 0.8)
  const mx = (ax + bx) / 2
  return (
    <>
      <g stroke="#6fa8d6" strokeWidth="1.8">
        {[[16, 20], [44, 10], [70, 26]].map(([x, y]) => (
          <path key={`${x}-${y}`} transform={`translate(${x} ${y})`} d="M0 -4 V4 M-3.5 -2 L3.5 2 M-3.5 2 L3.5 -2" />
        ))}
      </g>
      <Fig pose={P2A} id="c2a" tx={2} ty={24} s={0.82} />
      <Phone x={ax + 8} y={ay - 2} r={10} />
      <Fig pose={P2B} id="c2b" tx={190} ty={30} s={0.8} />
      <Phone x={bx - 8} y={by - 2} r={-10} />
      <Heart x={246} y={26} s={1.5} />
      {/* 날아가는 코디 카드 */}
      <Arrow d={`M${ax + 12} ${ay - 18} Q${mx} -6 ${bx - 12} ${by - 18}`} head={`M${bx - 22} ${by - 28} L${bx - 11} ${by - 18} L${bx - 24} ${by - 14}`} />
      <g>
        <Rough x={mx - 26} y={44} width={52} height={44} fill={PAPER} />
        <Cloth type="코트" color="베이지" x={mx - 23} y={46} s={0.22} w={7} />
        <Cloth type="바지" color="검정" x={mx + 1} y={48} s={0.22} w={7} />
      </g>
    </>
  )
})

// ───── 3컷: 일정을 넣고 "뭐 입지?" -> 어울리는 코디 ─────
const P3 = buildPose(30, 118)
const Scene3 = memo(function Scene3() {
  return (
    <>
      {/* 달력 */}
      <Rough x={6} y={30} width={80} height={86} fill={PAPER} />
      <path d="M6 50 H86 M24 24 V36 M68 24 V36" />
      <path d="M18 62 h.1 M34 62 h.1 M50 62 h.1 M66 62 h.1 M18 76 h.1 M34 76 h.1 M66 76 h.1 M18 90 h.1 M34 90 h.1 M50 90 h.1 M66 90 h.1" strokeWidth="3.4" />
      <circle cx="50" cy="76" r="9" stroke="#d9503f" strokeWidth="2.6" />
      {/* 고민하는 졸라맨 */}
      <Fig pose={P3} id="c3" tx={96} ty={24} s={0.9} face="flat" />
      <g stroke="#222" strokeWidth="2.4">
        <path transform="translate(152 16)" d="M0 8 C0 -4 16 -4 16 6 C16 14 8 14 8 22 M8 29 h.1" />
        <path transform="translate(176 30) scale(.7)" d="M0 8 C0 -4 16 -4 16 6 C16 14 8 14 8 22 M8 29 h.1" />
      </g>
      {/* 어울리는 코디 */}
      <Arrow d="M190 100 Q206 92 220 96" head="M211 88 L221 96 L209 101" />
      <Rough x={224} y={30} width={70} height={124} fill={PAPER} />
      <Cloth type="셔츠" color="흰색" x={231} y={38} s={0.56} w={4} />
      <Cloth type="바지" color="검정" x={231} y={92} s={0.56} w={4} />
      <g>
        <Sparkle x={222} y={26} s={1.3} />
        <Sparkle x={296} y={50} s={1} />
        <Sparkle x={292} y={150} s={1.2} />
      </g>
    </>
  )
})

// ───── 4컷: 저녁에 후기 "딱 좋아요" ─────
const P4 = buildPose(28, 86)
const Scene4 = memo(function Scene4() {
  return (
    <>
      <path transform="translate(252 8) scale(1.2)" d="M0 0 A9 9 0 1 0 8 14 A7 7 0 1 1 0 0Z" fill="#f6d44c" strokeWidth="1.8" />
      <g>
        <Sparkle x={228} y={18} s={1.1} />
        <Sparkle x={284} y={44} s={0.9} />
      </g>
      <Fig pose={P4} id="c4" tx={4} ty={30} s={0.9} />
      <g>
        <Heart x={66} y={18} s={1.7} />
        <Heart x={92} y={30} s={1} />
      </g>
      {/* 후기 카드 */}
      <Rough x={108} y={64} width={186} height={104} fill={PAPER} />
      <g transform="translate(118 74)"><FeedbackFace kind="cold" size={48} /></g>
      <g transform="translate(174 74)"><FeedbackFace kind="good" size={48} /></g>
      <g transform="translate(232 74)"><FeedbackFace kind="hot" size={48} /></g>
      <Rough x={168} y={70} width={60} height={70} stroke="#3f9a52" strokeWidth={3.2} />
      <path d="M198 152 l6 7 l14 -15" stroke="#3f9a52" strokeWidth="3.4" />
    </>
  )
})
interface Bubble {
  text: string
  /** 컷 안에서의 위치(%) */
  x: number
  y: number
  tone?: 'w1' | 'w2' | 'w3'
}
interface PanelDef {
  scene: ReactNode
  caption: string
  bubbles: Bubble[]
}

const PANELS: PanelDef[] = [
  {
    scene: <Scene1 />,
    caption: '옷장 사진을 찰칵! 내 옷이 앱에 쏙 들어와요.',
    bubbles: [
      { text: '찰칵!', x: 36, y: 6, tone: 'w2' },
      { text: '내 옷 등록 완료', x: 71, y: 82, tone: 'w3' },
    ],
  },
  {
    scene: <Scene2 />,
    caption: '아침에 확인하고, 오늘 이렇게 입어! 하고 공유해요.',
    bubbles: [
      { text: '오늘 추워! 이렇게 입어~', x: 2, y: 2, tone: 'w1' },
      { text: '고마워 ♥', x: 68, y: 82, tone: 'w3' },
    ],
  },
  {
    scene: <Scene3 />,
    caption: '일정을 넣고 "뭐 입지?" 하면, 어울리게 골라줘요.',
    bubbles: [
      { text: '면접 일정', x: 3, y: 74, tone: 'w2' },
      { text: '뭐 입지…?', x: 35, y: 78, tone: 'w1' },
      { text: '단정하게!', x: 71, y: 83, tone: 'w3' },
    ],
  },
  {
    scene: <Scene4 />,
    caption: '귀가 후 평가를 남기면 취향을 배워가요.',
    bubbles: [{ text: '딱 좋아요!', x: 4, y: 82, tone: 'w2' }],
  },
]

function Panel({ n, def }: { n: number; def: PanelDef }) {
  return (
    <li className="comic-panel">
      <div className={`box w${(n % 3) + 1} comic-frame`}>
        <span className="comic-no">
          <HandText>{`${n}`}</HandText>
        </span>
        <div className="comic-scene">
          <svg className="doodle" viewBox="0 0 300 190" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" overflow="visible" aria-hidden="true">
            {def.scene}
          </svg>
          {def.bubbles.map((b) => (
            <span key={b.text} className={`box ${b.tone ?? 'w1'} comic-bubble`} style={{ left: `${b.x}%`, top: `${b.y}%` }}>
              <HandText>{b.text}</HandText>
            </span>
          ))}
        </div>
      </div>
      <p className="comic-cap">
        <HandText>{def.caption}</HandText>
      </p>
    </li>
  )
}

export default function HowToComic() {
  return (
    <section className="howto">
      <h2>
        <HandText>이렇게 사용해보세요</HandText>
      </h2>
      <ol className="comic">
        {PANELS.map((def, i) => (
          <Panel key={def.caption} n={i + 1} def={def} />
        ))}
      </ol>
    </section>
  )
}
