import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { buildPose } from './greetingPose'
import FigureArt, { type Reg } from './FigureArt'
import { figureSvgProps } from './figureProps'

// 졸라맨(흰 반팔, 네이비 바지)을 펜으로 한 획씩 그리고, 다 그리면 한 손을 흔들며 인사한다.
// 각 획은 stroke-dashoffset 으로 실제 선이 이어져 그려지고(마스크로 가리지 않아 잘리지 않음), 펜은 그 선 끝을 따라간다.

const ARM_LEFT = 30
const WAVE_A = 125 // 오른팔을 든 두 가지 각도를 번갈아 보여 손을 흔든다
const WAVE_B = 152
const POSE_A = buildPose(ARM_LEFT, WAVE_A)
const POSE_B = buildPose(ARM_LEFT, WAVE_B)

type Kind = 'stroke' | 'dot' | 'fill'
interface StepDef {
  key: string
  kind: Kind
  speed?: number // 초당 그리는 길이(클수록 빨리)
  fillAfter?: boolean // 선을 다 그린 뒤 안쪽을 채운다
}

// 사람이 그리는 순서: 머리 -> 얼굴 -> 몸통 -> 팔 -> 다리 -> 바지(색칠) -> 티셔츠
const STEPS: StepDef[] = [
  { key: 'head', kind: 'stroke', speed: 190 },
  { key: 'eyeL', kind: 'dot' },
  { key: 'eyeR', kind: 'dot' },
  { key: 'smile', kind: 'stroke', speed: 120 },
  { key: 'body', kind: 'stroke', speed: 170 },
  { key: 'armL', kind: 'stroke', speed: 170 },
  { key: 'handL', kind: 'stroke', speed: 110, fillAfter: true },
  { key: 'armR', kind: 'stroke', speed: 170 },
  { key: 'handR', kind: 'stroke', speed: 110, fillAfter: true },
  { key: 'legL', kind: 'stroke', speed: 190 },
  { key: 'legR', kind: 'stroke', speed: 190 },
  { key: 'pants', kind: 'stroke', speed: 260 },
  { key: 'hatch', kind: 'stroke', speed: 560 },
  { key: 'pants', kind: 'fill' },
  { key: 'waist', kind: 'stroke', speed: 120 },
  { key: 'tee', kind: 'stroke', speed: 280 },
  { key: 'tee', kind: 'fill' },
  { key: 'neck', kind: 'stroke', speed: 120 },
]

const START = 0.45 // 펜이 들어오는 시간
const LIFT = 0.09 // 펜을 들어 다음 획으로 옮기는 시간
const HOLD = 0.2 // 다 그리고 잠깐 멈춤
const LEAVE = 0.55 // 펜이 빠지는 시간
const DOT_DUR = 0.12
const FILL_DUR = 0.26

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const easeSine = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u) // 선을 그을 때 처음과 끝이 살짝 느리다
const easeOut = (u: number) => 1 - (1 - u) * (1 - u)
const lerp = (a: number, b: number, u: number) => a + (b - a) * u

/** 펜: 끝이 (0,0), 오른손잡이처럼 오른쪽으로 기울어 있다 */
function Pen() {
  return (
    <g transform="rotate(30)" strokeLinejoin="round" strokeLinecap="round">
      <path d="M0 0 L-2 -7 L2 -7Z" fill="#222" stroke="#222" strokeWidth="1" />
      <rect x="-2.7" y="-36" width="5.4" height="29" rx="1.7" fill="#fcfcfa" stroke="#222" strokeWidth="1.6" />
      <rect x="-2.7" y="-36" width="5.4" height="9" rx="1.7" fill="#4a7fc1" stroke="#222" strokeWidth="1.6" />
      <path d="M2.7 -25 L2.7 -14" stroke="#222" strokeWidth="1.3" />
    </g>
  )
}

interface PlanStep {
  def: StepDef
  el: SVGGeometryElement
  len: number
  begin: number
  dur: number
  a: [number, number] // 펜 시작 위치
  b: [number, number] // 펜 끝 위치
}

/** onProgress: 그리는 진행률(0~1). 펜이 들어와 마지막 획을 마칠 때까지 오르고, 건너뛰거나 다 그리면 1 (글을 그리는 속도에 맞춰 타이핑할 때 쓴다) */
export default function GreetingFigure({ size = 220, onProgress }: { size?: number; onProgress?: (p: number) => void }) {
  const uid = useId().replace(/:/g, '')
  const [reduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [done, setDone] = useState(reduced)
  const els = useRef<Record<string, SVGGeometryElement | null>>({})
  const penRef = useRef<SVGGElement>(null)
  const skip = useRef<() => void>(() => undefined)
  const progressRef = useRef(onProgress)
  useEffect(() => {
    progressRef.current = onProgress
  })
  // 다 그렸거나(건너뛰기 포함) 처음부터 완성 상태(움직임 줄이기)면 100%
  useEffect(() => {
    if (done) progressRef.current?.(1)
  }, [done])
  const reg: Reg = (key) => (el) => {
    els.current[key] = el
  }

  useLayoutEffect(() => {
    if (done) return
    // 1) 각 획의 길이를 재서 시간표를 만든다
    const plan: PlanStep[] = []
    let t = START
    let prev: [number, number] | null = null
    for (const def of STEPS) {
      const el = els.current[def.key]
      if (!el) continue
      let len = 0
      let a: [number, number]
      let b: [number, number]
      let dur: number
      if (def.kind === 'stroke') {
        len = el.getTotalLength()
        const p0 = el.getPointAtLength(0)
        const p1 = el.getPointAtLength(len)
        a = [p0.x, p0.y]
        b = [p1.x, p1.y]
        dur = Math.min(1.5, Math.max(0.16, len / (def.speed ?? 200)))
      } else if (def.kind === 'dot') {
        const c = el as unknown as SVGCircleElement
        a = b = [c.cx.baseVal.value, c.cy.baseVal.value]
        dur = DOT_DUR
      } else {
        a = b = prev ?? [0, 0]
        dur = FILL_DUR
      }
      const gap = plan.length > 0 && def.kind !== 'fill' ? LIFT : 0
      const begin = t + gap
      plan.push({ def, el, len, begin, dur, a, b })
      t = begin + dur
      prev = b
    }
    const drawEnd = t + HOLD
    const drawn = t // 마지막 획을 마치는 시각
    const total = drawEnd + LEAVE

    // 2) 처음에는 모두 숨긴다
    for (const s of plan) {
      if (s.def.kind === 'stroke') {
        s.el.style.strokeDasharray = `${s.len} ${s.len * 3}`
        s.el.style.strokeDashoffset = `${s.len}`
        if (s.def.fillAfter) s.el.style.fillOpacity = '0'
      } else if (s.def.kind === 'dot') {
        s.el.setAttribute('r', '0')
      } else {
        s.el.style.fillOpacity = '0'
      }
    }
    const pen = penRef.current
    const first = plan[0]!
    const setPen = (x: number, y: number, opacity: number) => {
      pen?.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`)
      pen?.setAttribute('opacity', String(opacity))
    }
    setPen(first.a[0] + 30, first.a[1] - 34, 0)

    // 3) 프레임마다 시간에 맞게 선을 그린다
    const apply = (time: number) => {
      for (const s of plan) {
        const u = clamp01((time - s.begin) / s.dur)
        if (s.def.kind === 'stroke') {
          s.el.style.strokeDashoffset = `${s.len * (1 - easeSine(u))}`
          if (s.def.fillAfter) s.el.style.fillOpacity = u >= 1 ? '1' : '0'
        } else if (s.def.kind === 'dot') {
          s.el.setAttribute('r', String(1.9 * easeOut(u)))
        } else {
          s.el.style.fillOpacity = String(easeOut(u))
        }
      }
      // 펜 위치: 지금 그리는 획의 끝 -> 다음 획 시작으로 들어 옮기기
      if (time < first.begin) {
        const u = easeOut(clamp01(time / first.begin))
        setPen(lerp(first.a[0] + 30, first.a[0], u), lerp(first.a[1] - 34, first.a[1], u), u)
        return
      }
      let idx = 0
      for (let i = 0; i < plan.length; i++) if (plan[i]!.begin <= time) idx = i
      const cur = plan[idx]!
      const endCur = cur.begin + cur.dur
      const next = plan[idx + 1]
      if (time < endCur) {
        if (cur.def.kind === 'stroke') {
          const p = cur.el.getPointAtLength(cur.len * easeSine(clamp01((time - cur.begin) / cur.dur)))
          setPen(p.x, p.y, 1)
        } else {
          setPen(cur.b[0], cur.b[1], 1)
        }
      } else if (next) {
        const u = easeSine(clamp01((time - endCur) / Math.max(0.001, next.begin - endCur)))
        setPen(lerp(cur.b[0], next.a[0], u), lerp(cur.b[1], next.a[1], u), 1)
      } else {
        const u = clamp01((time - drawEnd) / LEAVE)
        setPen(cur.b[0] + 40 * easeOut(u), cur.b[1] - 46 * easeOut(u), 1 - u)
      }
    }

    apply(0)
    let raf = 0
    let stopped = false
    const t0 = performance.now()
    const tick = (now: number) => {
      if (stopped) return
      const time = (now - t0) / 1000
      if (time >= total) {
        setDone(true)
        return
      }
      apply(time)
      progressRef.current?.(clamp01((time - START) / (drawn - START)))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    skip.current = () => setDone(true)
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
    }
  }, [done])

  // 그리는 중에 누르면 바로 완성
  const finish = () => skip.current()

  if (done) {
    return (
      <svg className="doodle greeting-figure" width={size} height={size * 1.15} {...figureSvgProps}>
        {reduced ? (
          <FigureArt pose={POSE_A} id={`${uid}a`} />
        ) : (
          <>
            <g className="gf-a">
              <FigureArt pose={POSE_A} id={`${uid}a`} />
            </g>
            <g className="gf-b">
              <FigureArt pose={POSE_B} id={`${uid}b`} />
            </g>
          </>
        )}
      </svg>
    )
  }

  return (
    <svg className="doodle greeting-figure" width={size} height={size * 1.15} {...figureSvgProps} onClick={finish}>
      <FigureArt pose={POSE_A} id={`${uid}a`} reg={reg} />
      <g transform="translate(10 0)">
        <g ref={penRef} opacity="0">
          <Pen />
        </g>
      </g>
    </svg>
  )
}
