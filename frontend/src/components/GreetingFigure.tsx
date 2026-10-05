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

/** 지우개: 종이에 닿는 아랫면 가운데가 (0,0). 분홍 몸통에 흰 종이 띠(파란 줄)를 두른 모난 지우개 */
function Eraser() {
  return (
    <g transform="rotate(-12)" strokeLinejoin="round" strokeLinecap="round">
      <path d="M-14 0 L-14 -11 Q-14 -14 -11 -14 L11 -14 Q14 -14 14 -11 L14 0Z" fill="#f2a7b0" stroke="#222" strokeWidth="1.8" />
      <path d="M-2 0 L-2 -14 L11 -14 Q14 -14 14 -11 L14 0Z" fill="#fcfcfa" stroke="#222" strokeWidth="1.8" />
      <path d="M2 -14 V0 M7 -14 V0" stroke="#4a7fc1" strokeWidth="1.6" />
      <path d="M-11 -9.5 Q-8.5 -11.5 -5.5 -10.5" stroke="#fff" strokeWidth="1.6" opacity="0.75" />
    </g>
  )
}

// 터치로 펜을 건드렸을 때: 선이 삐져나가고(STRAY) 잠깐 멈췄다가(PAUSE) 지우개로 지운 뒤(ERASE) 그 획을 처음부터 다시 그린다
const STRAY = 0.22
const PAUSE = 0.5
const ERASE = 0.7
const MAX_OOPS = 3

interface Oops {
  t0: number // 실제 시각(초)
  frozen: number // 멈춘 그림 시각
  step: number
  u: number
  len: number // 삐져나온 선의 길이
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
export default function GreetingFigure({ size = 220, onProgress, oops = false }: { size?: number; onProgress?: (p: number) => void; oops?: boolean }) {
  const uid = useId().replace(/:/g, '')
  const [reduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [done, setDone] = useState(reduced)
  const els = useRef<Record<string, SVGGeometryElement | null>>({})
  const penRef = useRef<SVGGElement>(null)
  const strayRef = useRef<SVGPathElement>(null)
  const eraserRef = useRef<SVGGElement>(null)
  const crumbsRef = useRef<SVGGElement>(null)
  const skip = useRef<() => void>(() => undefined)
  const bump = useRef<() => void>(() => undefined)
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

    // 터치로 건드린 순간: 지금 긋는 획 끝에서 선이 삐져나가게 하고, 그림 시간은 멈춘다
    const stray = strayRef.current
    const eraser = eraserRef.current
    let shift = 0 // 실제 시간 - 그림 시간 (다시 그릴 때 그림 시간을 획 시작으로 되돌린다)
    let pending = false
    let count = 0
    let oopsState: Oops | null = null
    const crumbs = crumbsRef.current
    const setEraser = (x: number, y: number, opacity: number, rot = 0) => {
      eraser?.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(1)})`)
      eraser?.setAttribute('opacity', String(opacity))
    }
    // 지우개 가루: 지우는 곳에서 톡톡 떨어진다
    const setCrumbs = (x: number, y: number, t: number, on: boolean) => {
      if (!crumbs) return
      crumbs.setAttribute('opacity', on ? '1' : '0')
      if (!on) return
      Array.from(crumbs.children).forEach((c, i) => {
        const ph = (t * 2.6 + i / 6) % 1
        c.setAttribute('cx', (x + (i - 2.5) * 3.4 + Math.sin(i * 5) * 2).toFixed(1))
        c.setAttribute('cy', (y - 1 + ph * 15).toFixed(1))
        c.setAttribute('opacity', (1 - ph).toFixed(2))
      })
    }
    // 곡선의 그 지점에서 진행 방향(단위 벡터)
    const tangentAt = (el: SVGGeometryElement, at: number): [number, number] => {
      const a = el.getPointAtLength(Math.max(0, at - 3))
      const b = el.getPointAtLength(at + 3)
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1
      return [(b.x - a.x) / l, (b.y - a.y) / l]
    }
    const startOops = (real: number, time: number) => {
      if (!stray) return false
      let idx = 0
      for (let i = 0; i < plan.length; i++) if (plan[i]!.begin <= time) idx = i
      const s = plan[idx]!
      if (s.def.kind !== 'stroke') return false
      const u = clamp01((time - s.begin) / s.dur)
      if (u < 0.12 || u > 0.9) return false
      const at = s.len * easeSine(u)
      const p = s.el.getPointAtLength(at)
      const back = s.el.getPointAtLength(Math.max(0, at - 4))
      const ang = Math.atan2(p.y - back.y, p.x - back.x) + (count % 2 === 0 ? 1 : -1) * (0.9 + Math.random() * 0.5)
      const reach = 24 + Math.random() * 8
      const ex = p.x + Math.cos(ang) * reach
      const ey = p.y + Math.sin(ang) * reach
      const cx = p.x + Math.cos(ang - 0.5) * reach * 0.55
      const cy = p.y + Math.sin(ang - 0.5) * reach * 0.55
      stray.setAttribute('d', `M${p.x.toFixed(2)} ${p.y.toFixed(2)} Q${cx.toFixed(2)} ${cy.toFixed(2)} ${ex.toFixed(2)} ${ey.toFixed(2)}`)
      const len = stray.getTotalLength()
      stray.style.strokeDasharray = `${len} ${len * 3}`
      stray.style.strokeDashoffset = `${len}`
      stray.setAttribute('opacity', '1')
      oopsState = { t0: real, frozen: time, step: idx, u, len }
      count++
      return true
    }
    const runOops = (real: number, o: Oops) => {
      const s = plan[o.step]!
      const mt = real - o.t0
      apply(o.frozen)
      if (mt < STRAY + PAUSE) {
        const k = easeOut(clamp01(mt / STRAY))
        stray!.style.strokeDashoffset = `${o.len * (1 - k)}`
        const p = stray!.getPointAtLength(o.len * k)
        const shake = mt > STRAY ? Math.sin(mt * 55) * 0.7 : 0
        setPen(p.x + shake, p.y, 1)
        return
      }
      const e = clamp01((mt - STRAY - PAUSE) / ERASE)
      const e1 = clamp01(e / 0.4) // 삐져나온 선을 먼저 지우고
      const e2 = clamp01((e - 0.4) / 0.6) // 그리던 획을 처음까지 지운다
      pen?.setAttribute('opacity', '0')
      let pos: { x: number; y: number }
      let tg: [number, number]
      if (e2 <= 0) {
        stray!.style.strokeDashoffset = `${o.len * easeSine(e1)}`
        const at = o.len * (1 - easeSine(e1))
        pos = stray!.getPointAtLength(at)
        tg = tangentAt(stray!, at)
      } else {
        stray!.setAttribute('opacity', '0')
        const keep = o.u * (1 - easeSine(e2))
        s.el.style.strokeDashoffset = `${s.len * (1 - easeSine(keep))}`
        const at = s.len * easeSine(keep)
        pos = s.el.getPointAtLength(at)
        tg = tangentAt(s.el, at)
      }
      // 선을 따라 앞뒤로 슥슥 문지르며 지운다(지워지는 끝 근처를 오간다)
      const rub = Math.sin(mt * 26) * 6
      const lift = Math.abs(Math.sin(mt * 26)) * 1.2
      const ex = pos.x + tg[0] * rub - tg[1] * lift
      const ey = pos.y + tg[1] * rub + tg[0] * lift
      setEraser(ex, ey, 1, Math.sin(mt * 26) * 7)
      setCrumbs(ex, ey, mt, true)
    }
    const tick = (now: number) => {
      if (stopped) return
      const real = (now - t0) / 1000
      if (oopsState) {
        if (real - oopsState.t0 >= STRAY + PAUSE + ERASE) {
          shift = real - plan[oopsState.step]!.begin // 그 획을 처음부터 다시 그린다
          oopsState = null
          stray?.setAttribute('opacity', '0')
          setEraser(0, 0, 0)
          setCrumbs(0, 0, 0, false)
        } else {
          runOops(real, oopsState)
          raf = requestAnimationFrame(tick)
          return
        }
      }
      const time = real - shift
      if (time >= total) {
        setDone(true)
        return
      }
      if (pending && startOops(real, time)) {
        pending = false
        runOops(real, oopsState!)
        raf = requestAnimationFrame(tick)
        return
      }
      apply(time)
      progressRef.current?.(clamp01((time - START) / (drawn - START)))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    skip.current = () => setDone(true)
    bump.current = () => {
      if (!oopsState && count < MAX_OOPS) pending = true
    }
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
    }
  }, [done])

  // 그리는 중에 누르면 바로 완성
  const finish = () => skip.current()
  // oops 모드: 누르면 펜을 건드려 선이 삐져나가고, 지우고 다시 그린다
  const touch = oops ? () => bump.current() : finish

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
    <svg className="doodle greeting-figure" width={size} height={size * 1.15} {...figureSvgProps} onPointerDown={touch}>
      <FigureArt pose={POSE_A} id={`${uid}a`} reg={reg} />
      <g transform="translate(10 0)">
        <path ref={strayRef} d="M0 0" opacity="0" />
        <g ref={penRef} opacity="0">
          <Pen />
        </g>
        <g ref={eraserRef} opacity="0">
          <Eraser />
        </g>
        <g ref={crumbsRef} opacity="0" fill="#c4c4be" stroke="none">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle key={i} r="1.3" />
          ))}
        </g>
      </g>
    </svg>
  )
}
