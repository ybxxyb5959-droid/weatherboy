import { useId, useState } from 'react'
import { FigureBody } from './IntroFigure'
import { figureSvgProps } from './figureProps'

// 졸라맨(옷 입은 그대로)을 '누군가의 손'이 펜으로 그리고, 다 그리면 한 손을 흔들며 인사한다.
// 그림은 마스크로 숨겨 두고, 펜이 지나가는 길(stroke)마다 마스크를 따라 그려서 드러낸다.
// 펜 손은 같은 길을 같은 시간에 따라가서(SMIL) 그리는 것처럼 보인다.

const WAVE_A = 125 // 오른팔(그림 기준) 올린 각도 두 가지를 번갈아 보여 손 흔드는 느낌을 낸다
const WAVE_B = 152
const ARM_LEFT = 30 // 왼팔은 편하게 내린다

interface Stroke {
  d: string
  w: number // 마스크 붓 굵기: 선은 가늘게, 옷은 넓게 문질러 칠한다
  dur: number
}

// 좌표는 졸라맨 그림(IntroFigure) 안쪽 좌표
const STROKES: Stroke[] = [
  { d: 'M60.5 12.5 C71 11.5 78.5 20 77.5 30.5 C76.5 40 70 48 60 48 C50 48 42.5 40.5 42.5 30 C42.5 20.5 49.5 13 60.5 12.5', w: 7, dur: 0.9 }, // 머리
  { d: 'M52 30 L68 30 M55 36 Q60.5 41 66 35', w: 8, dur: 0.5 }, // 눈과 입
  { d: 'M60 47 L61 100', w: 7, dur: 0.4 }, // 몸통
  { d: 'M47 52 L71 56 L47 62 L71 66 L47 72 L71 76 L47 82 L71 86 L47 92 L71 96', w: 9, dur: 1.0 }, // 티셔츠 칠하기
  { d: 'M50 50 L36 62 L27.6 83', w: 9, dur: 0.4 }, // 왼팔
  { d: 'M70 50 L86 40 L95.7 23', w: 9, dur: 0.45 }, // 인사하는 오른팔
  { d: 'M48 99 L72 99 L48 106 L72 106 L48 112 L72 112', w: 9, dur: 0.5 }, // 바지 칠하기
  { d: 'M54 100 L40 128 L37 137', w: 12, dur: 0.4 }, // 왼다리
  { d: 'M66 100 L78 128 L79 137', w: 12, dur: 0.4 }, // 오른다리
]

const START = 0.4 // 펜 손이 등장하기까지
const LIFT = 0.14 // 펜을 들어 다음 획으로 옮기는 시간
const LEAVE = 0.6 // 다 그리고 손이 빠지는 시간

const nums = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
const startOf = (d: string) => {
  const n = nums(d)
  return [n[0]!, n[1]!] as const
}
const endOf = (d: string) => {
  const n = nums(d)
  return [n[n.length - 2]!, n[n.length - 1]!] as const
}

interface Step {
  kind: 'draw' | 'lift'
  d: string
  begin: number
  dur: number
  stroke?: Stroke
}

// 획을 순서대로 이어 붙여 각 동작의 시작 시각을 계산한다
function buildTimeline() {
  const steps: Step[] = []
  let t = START
  STROKES.forEach((s, i) => {
    if (i > 0) {
      const [px, py] = endOf(STROKES[i - 1]!.d)
      const [nx, ny] = startOf(s.d)
      steps.push({ kind: 'lift', d: `M${px} ${py} L${nx} ${ny}`, begin: t, dur: LIFT })
      t += LIFT
    }
    steps.push({ kind: 'draw', d: s.d, begin: t, dur: s.dur, stroke: s })
    t += s.dur
  })
  const [ex, ey] = endOf(STROKES[STROKES.length - 1]!.d)
  return { steps, end: t, leave: `M${ex} ${ey} L${ex + 70} ${ey - 50}` }
}
const TIMELINE = buildTimeline()

// 펜을 든 손: 펜 끝이 (0,0)
function PenHand() {
  return (
    <g strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" stroke="#222">
      <path d="M0 0 L3 -7 L25 -38 L32 -33 L7 1Z" fill="#fff" />
      <path d="M0 0 L3 -7 L7 1Z" fill="#222" />
      <path d="M22 -34 L29 -29" stroke="#4a7fc1" strokeWidth="3" />
      {/* 손 */}
      <path d="M20 -27 C15 -37 24 -47 33 -45 C44 -43 47 -31 42 -23 C37 -15 25 -17 20 -27Z" fill="#fde0c4" />
      <path d="M25 -31 L34 -27 M27 -37 L37 -33 M31 -41 L40 -37" strokeWidth="1.4" />
      {/* 소매 */}
      <path d="M37 -40 L52 -58 L62 -48 L46 -30Z" fill="#fcfcfa" />
    </g>
  )
}

export default function GreetingFigure({ size = 220 }: { size?: number }) {
  const uid = useId().replace(/:/g, '')
  const maskId = `gf-mask-${uid}`
  const [reduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const tl = TIMELINE
  const total = tl.end + LEAVE

  // 움직임 줄이기 설정이면 그리는 과정 없이 인사하는 그림만 보여 준다
  if (reduced) {
    return (
      <svg className="doodle greeting-figure" width={size} height={size * 1.15} {...figureSvgProps}>
        <FigureBody armL={ARM_LEFT} armR={WAVE_A} idKey={`${uid}a`} />
      </svg>
    )
  }

  return (
    <svg
      className="doodle greeting-figure"
      width={size}
      height={size * 1.15}
      {...figureSvgProps}
      style={{ ['--gf-t' as string]: `${total}s` }}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="-40" y="-40" width="220" height="240">
          <g transform="translate(10 0)" stroke="#fff" fill="none" strokeLinecap="round" strokeLinejoin="round">
            {tl.steps
              .filter((s) => s.kind === 'draw')
              .map((s) => (
                <path key={s.begin} d={s.d} strokeWidth={s.stroke!.w} pathLength={1} strokeDasharray="1 2" strokeDashoffset={1}>
                  <animate attributeName="stroke-dashoffset" from="1" to="0" begin={`${s.begin}s`} dur={`${s.dur}s`} fill="freeze" />
                </path>
              ))}
          </g>
        </mask>
      </defs>

      {/* 그리는 중 + 인사 1: 마스크로 펜이 지나간 곳만 드러난다 */}
      <g className="gf-a">
        <g mask={`url(#${maskId})`}>
          <FigureBody armL={ARM_LEFT} armR={WAVE_A} idKey={`${uid}a`} />
        </g>
      </g>
      {/* 다 그린 뒤 인사 2: 손 든 각도만 다른 같은 그림과 번갈아 보여 손을 흔든다 */}
      <g className="gf-b">
        <FigureBody armL={ARM_LEFT} armR={WAVE_B} idKey={`${uid}b`} />
      </g>

      {/* 그리는 손 */}
      <g transform="translate(10 0)">
        <g opacity="0">
          <set attributeName="opacity" to="1" begin={`${START}s`} fill="freeze" />
          {tl.steps.map((s) => (
            <animateMotion key={s.begin} path={s.d} begin={`${s.begin}s`} dur={`${s.dur}s`} fill="freeze" />
          ))}
          <animateMotion path={tl.leave} begin={`${tl.end}s`} dur={`${LEAVE}s`} fill="freeze" />
          <animate attributeName="opacity" from="1" to="0" begin={`${tl.end}s`} dur={`${LEAVE}s`} fill="freeze" />
          <g transform="scale(0.72)">
            <PenHand />
          </g>
        </g>
      </g>
    </svg>
  )
}
