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

type Step = 'hour' | 'min'
const HOUR_MARKS = Array.from({ length: 12 }, (_, i) => i + 1)
const MIN_MARKS = Array.from({ length: 12 }, (_, i) => i * 5)

/**
 * 낙서 스타일 원형 시계로 시간을 고른다. 누르면(또는 바늘을 끌면) 시를 고르고, 이어서 분을 고른다.
 * 분은 5분 단위. 숫자는 키보드(Tab/Enter)로도 고를 수 있다.
 */
export default function TimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('hour')
  const dragging = useRef(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const { pm, hour12, minute } = split(value)

  const face = useMemo(() => wobblyCircle(108, 1), [])
  const face2 = useMemo(() => wobblyCircle(105, 4, 2.8), []) // 한 번 더 덧그린 선
  const blob = useMemo(() => wobblyCircle(17, 7, 1.2), [])

  const isHour = step === 'hour'
  const handDeg = isHour ? (hour12 % 12) * 30 : minute * 6
  const hand = useMemo(() => wobblyHand(handDeg, 62, isHour ? 3 : -3), [handDeg, isHour])
  const tip = polar(handDeg, 86)

  const pickAt = (clientX: number, clientY: number, final: boolean) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box) return
    const dx = clientX - (box.left + box.width / 2)
    const dy = clientY - (box.top + box.height / 2)
    if (Math.hypot(dx, dy) < box.width * 0.08) return // 가운데 점은 무시
    const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
    if (isHour) {
      onChange(join(pm, Math.round(deg / 30) % 12 || 12, minute))
      if (final) setStep('min') // 손을 떼면 분으로 넘어간다
    } else {
      onChange(join(pm, hour12, (Math.round(deg / 30) * 5) % 60))
    }
  }

  const down = (e: PointerEvent<SVGSVGElement>) => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    pickAt(e.clientX, e.clientY, false)
  }
  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (dragging.current) pickAt(e.clientX, e.clientY, false)
  }
  const up = (e: PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return
    dragging.current = false
    pickAt(e.clientX, e.clientY, true)
  }
  const keyPick = (e: KeyboardEvent, apply: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      apply()
    }
  }

  return (
    <>
      <button
        type="button"
        className="dbtn w2 tp-show"
        aria-expanded={open}
        aria-label={`${label} 시간 선택`}
        onClick={() => {
          setOpen((o) => !o)
          setStep('hour')
        }}
      >
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
            <button type="button" className={`tp-part${isHour ? ' on' : ''}`} aria-pressed={isHour} onClick={() => setStep('hour')}>
              {hour12}시
            </button>
            <button type="button" className={`tp-part${!isHour ? ' on' : ''}`} aria-pressed={!isHour} onClick={() => setStep('min')}>
              {p2(minute)}분
            </button>
          </div>
          <svg
            ref={svgRef}
            className="tp-clock"
            viewBox="0 0 240 240"
            role="group"
            aria-label={isHour ? '시계에서 시를 골라요' : '시계에서 분을 골라요'}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => {
              dragging.current = false
            }}
          >
            <path d={face} className="tp-face" />
            <path d={face2} className="tp-face tp-face2" />
            <path d={blob} className="tp-blob" transform={`translate(${tip.x - C} ${tip.y - C})`} />
            <path d={hand} className="tp-hand" />
            <circle cx={C} cy={C} r="4.5" className="tp-dot" />
            {(isHour ? HOUR_MARKS : MIN_MARKS).map((n) => {
              const p = polar(isHour ? n * 30 : n * 6, 86)
              const on = isHour ? n === hour12 : n === minute
              return (
                <text
                  key={n}
                  x={p.x}
                  y={p.y}
                  className={`tp-num${on ? ' on' : ''}`}
                  textAnchor="middle"
                  dominantBaseline="central"
                  tabIndex={0}
                  role="button"
                  aria-pressed={on}
                  aria-label={isHour ? `${n}시` : `${p2(n)}분`}
                  onKeyDown={(e) =>
                    keyPick(e, () => {
                      if (isHour) {
                        onChange(join(pm, n, minute))
                        setStep('min')
                      } else onChange(join(pm, hour12, n))
                    })
                  }
                >
                  {isHour ? n : p2(n)}
                </text>
              )
            })}
          </svg>
          <p className="tiny tp-hint">{isHour ? '시계를 눌러 시를 골라요 (끌어도 돼요)' : '이제 분을 골라요 (5분 단위)'}</p>
          <button type="button" className="dbtn w1 small tp-done" onClick={() => setOpen(false)}>
            확인
          </button>
        </div>
      )}
    </>
  )
}
