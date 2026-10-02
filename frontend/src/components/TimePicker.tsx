import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import DoodleButton from './DoodleButton'

const p2 = (n: number) => String(n).padStart(2, '0')

/** 'HH:mm'(24시간) <-> 오전/오후 + 1~12시 */
function split(value: string) {
  const [h, m] = value.split(':').map(Number)
  return { pm: h! >= 12, hour12: h! % 12 === 0 ? 12 : h! % 12, minute: m! }
}
function join(pm: boolean, hour12: number, minute: number) {
  return `${p2((hour12 % 12) + (pm ? 12 : 0))}:${p2(minute)}`
}

// ---- 낙서 시계 그리기 (viewBox 240x240, 중심 120,120) ----
const C = 120
const polar = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) }
}

/** 손으로 그린 듯 삐뚤빼뚤한 닫힌 원. seed 가 같으면 항상 같은 모양이라 다시 그려도 흔들리지 않는다. */
function wobblyCircle(r: number, seed: number, jitter = 2.4): string {
  const n = 28
  const pts = Array.from({ length: n }, (_, i) => {
    const deg = (i / n) * 360
    const w = Math.sin(i * 0.5 + seed * 2.1) * jitter + Math.sin(i * 1.3 + seed) * jitter * 0.35
    return polar(deg, r + w)
  })
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const start = mid(pts[n - 1]!, pts[0]!)
  let d = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i]!, pts[(i + 1) % n]!)
    d += ` Q ${pts[i]!.x.toFixed(1)} ${pts[i]!.y.toFixed(1)} ${m.x.toFixed(1)} ${m.y.toFixed(1)}`
  }
  return d + ' Z'
}

/** 중심에서 deg 방향으로 뻗는, 살짝 휜 낙서 바늘 */
function wobblyHand(deg: number, len: number, bend: number): string {
  const tip = polar(deg, len)
  const mid = polar(deg, len * 0.5)
  const nx = Math.cos((deg * Math.PI) / 180)
  const ny = Math.sin((deg * Math.PI) / 180)
  return `M ${C} ${C} Q ${(mid.x + nx * bend).toFixed(1)} ${(mid.y + ny * bend).toFixed(1)} ${tip.x.toFixed(1)} ${tip.y.toFixed(1)}`
}

const HOUR_MARKS = Array.from({ length: 12 }, (_, i) => i + 1)
const STEP_MIN = 10 // 분은 10분 단위
// 숫자 사이사이의 눈금: 10분 단위 위치(60도마다)를 점으로 표시한다. 숫자 자리와 겹치지 않게 숫자(5분 단위)는 그대로 둔다.
const MIN_DOTS = Array.from({ length: 6 }, (_, i) => i * 60)
const HOUR_HAND = 46 // 짧은 바늘(시)
const MIN_HAND = 80 // 긴 바늘(분)
const SPLIT = 63 // 이 거리보다 안쪽을 누르면 시침, 바깥쪽이면 분침

/**
 * 낙서 스타일 원형 시계. 진짜 시계처럼 짧은 바늘은 시, 긴 바늘은 분이고 한 화면에서 둘 다 맞춘다.
 * 안쪽을 누르거나 끌면 시침이, 바깥쪽을 누르거나 끌면 분침이 움직인다(분은 10분 단위). 시계에 적힌 숫자는 1~12 그대로다.
 * 키보드는 ←/→ 로 10분, ↑/↓ 로 1시간씩 움직인다.
 */
export default function TimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const dragging = useRef<'hour' | 'min' | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const { pm, hour12, minute } = split(value)

  const face = useMemo(() => wobblyCircle(108, 1), [])
  const face2 = useMemo(() => wobblyCircle(105, 4, 2.8), []) // 한 번 더 덧그린 선
  const blob = useMemo(() => wobblyCircle(17, 7, 1.2), [])

  const hourDeg = (hour12 % 12) * 30
  const minDeg = minute * 6
  const hourHand = useMemo(() => wobblyHand(hourDeg, HOUR_HAND, 3), [hourDeg])
  const minHand = useMemo(() => wobblyHand(minDeg, MIN_HAND, -3), [minDeg])
  const hourTip = polar(hourDeg, 86) // 시에 해당하는 숫자 위치(강조)
  const minTip = polar(minDeg, MIN_HAND)

  const setHour = (h: number) => onChange(join(pm, h === 0 ? 12 : h, minute))
  const setMinute = (m: number) => onChange(join(pm, hour12, ((m % 60) + 60) % 60))

  // 누른 점이 중심에서 얼마나 떨어졌는지(viewBox 단위)와 시계 위 각도
  const locate = (clientX: number, clientY: number) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box) return null
    const dx = clientX - (box.left + box.width / 2)
    const dy = clientY - (box.top + box.height / 2)
    const dist = (Math.hypot(dx, dy) * 240) / box.width
    const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
    return { dist, deg }
  }
  const apply = (hand: 'hour' | 'min', deg: number) => {
    if (hand === 'hour') setHour(Math.round(deg / 30) % 12)
    else setMinute(Math.round(deg / (STEP_MIN * 6)) * STEP_MIN)
  }

  const down = (e: PointerEvent<SVGSVGElement>) => {
    const p = locate(e.clientX, e.clientY)
    if (!p || p.dist < 10) return // 가운데 점은 무시
    dragging.current = p.dist < SPLIT ? 'hour' : 'min'
    e.currentTarget.setPointerCapture(e.pointerId)
    apply(dragging.current, p.deg)
  }
  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return
    const p = locate(e.clientX, e.clientY)
    if (p) apply(dragging.current, p.deg)
  }
  const up = () => {
    dragging.current = null
  }
  const total = (hour12 % 12) * 60 + minute
  const keyPick = (e: KeyboardEvent) => {
    const delta = e.key === 'ArrowRight' ? STEP_MIN : e.key === 'ArrowLeft' ? -STEP_MIN : e.key === 'ArrowUp' ? 60 : e.key === 'ArrowDown' ? -60 : 0
    if (!delta) return
    e.preventDefault()
    const t = (((total + delta) % 720) + 720) % 720
    const h = Math.floor(t / 60)
    onChange(join(pm, h === 0 ? 12 : h, t % 60))
  }

  return (
    <>
      <button type="button" className="dbtn w2 tp-show" aria-expanded={open} aria-label={`${label} 시간 선택`} onClick={() => setOpen((o) => !o)}>
        <span className="tp-ampm">{pm ? '오후' : '오전'}</span> {hour12}:{p2(minute)}
      </button>
      {open && (
        <div className="tp-panel box w3" role="group" aria-label={`${label} 시간`}>
          <div className="row stretch">
            <DoodleButton seed={0} selected={!pm} onClick={() => onChange(join(false, hour12, minute))}>
              오전
            </DoodleButton>
            <DoodleButton seed={1} selected={pm} onClick={() => onChange(join(true, hour12, minute))}>
              오후
            </DoodleButton>
          </div>
          <div className="tp-readout" aria-live="polite">
            <span className="tp-part on">
              {hour12}시 {p2(minute)}분
            </span>
          </div>
          <svg
            ref={svgRef}
            className="tp-clock"
            viewBox="0 0 240 240"
            role="slider"
            tabIndex={0}
            aria-label={`${label} 시각`}
            aria-valuemin={0}
            aria-valuemax={719}
            aria-valuenow={total}
            aria-valuetext={`${pm ? '오후' : '오전'} ${hour12}시 ${minute}분`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onKeyDown={keyPick}
          >
            <path d={face} className="tp-face" />
            <path d={face2} className="tp-face tp-face2" />
            {MIN_DOTS.map((deg) => {
              const p = polar(deg, 99)
              return <circle key={deg} cx={p.x} cy={p.y} r="1.3" className="tp-tick" />
            })}
            <path d={blob} className="tp-blob" transform={`translate(${hourTip.x - C} ${hourTip.y - C})`} />
            <path d={minHand} className="tp-hand tp-hand-min" />
            <path d={hourHand} className="tp-hand tp-hand-hour" />
            <circle cx={minTip.x} cy={minTip.y} r="4" className="tp-mintip" />
            <circle cx={C} cy={C} r="4.5" className="tp-dot" />
            {HOUR_MARKS.map((n) => {
              const p = polar(n * 30, 86)
              return (
                <text key={n} x={p.x} y={p.y} className="tp-num" textAnchor="middle" dominantBaseline="central" aria-hidden="true">
                  {n}
                </text>
              )
            })}
          </svg>
          <p className="tiny tp-hint">끌거나 눌러서 조절해요</p>
          <button type="button" className="dbtn w1 small tp-done" onClick={() => setOpen(false)}>
            확인
          </button>
        </div>
      )}
    </>
  )
}
