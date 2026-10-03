import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HandText from '../components/HandText'
import ReactFigure from '../components/ReactFigure'
import { useInstallAction } from '../lib/useInstallAction'

// 앱 화면(캡처) 위에 손그림 말풍선과 점선 화살표를 얹어 "여기서는 이걸 볼 수 있어요"를 보여 주는 둘러보기.
// 좌표는 캡처 이미지(390x844) 기준 픽셀이다.
const BYE_URL = 'https://www.google.com'
// 개발 중 확인용: 주소 끝에 ?hold 를 붙이면 구글로 넘어가지 않는다
const HOLD = import.meta.env.DEV && new URLSearchParams(window.location.search).has('hold')
const W = 390
const H = 844
const SLIDE = 0.9 // 화면이 아래로 슬라이드되는 시간(초). CSS(.tour-track)와 같아야 한다
const READ = 2.4 // 마지막 말풍선이 뜬 뒤 읽을 시간(초). 지나면 다음 화면으로 넘어간다

interface Callout {
  text: string
  /** 말풍선 왼쪽 위와 크기 */
  x: number
  y: number
  w: number
  h: number
  /** 화살표가 가리킬 곳 */
  to: [number, number]
  /** 화살표를 휘는 정도(+/-) */
  bend?: number
}

/** 캡처 한 장과 그 위의 말풍선들 */
interface Frame {
  image: string
  alt: string
  callouts: Callout[]
}

/** 한 단계는 한 장 이상의 캡처. 여러 장이면 설명이 끝난 뒤 화면이 아래로 슬라이드된다. */
interface Step {
  title: string
  sub: string
  frames: Frame[]
}

interface Pos {
  i: number // 단계
  f: number // 그 단계 안의 화면
}

const STEPS: Step[] = [
  {
    title: '홈',
    sub: '열자마자 오늘 입을 옷이 보여요',
    frames: [
      {
        image: '/tour/home.jpg',
        alt: '뭐입을옷? 홈 화면: 오늘의 날씨, 준비물, 추천 옷',
        callouts: [
          { text: '오늘 날씨는 여기서 확인해요 ^_^', x: 190, y: 168, w: 190, h: 44, to: [150, 138], bend: 0.2 },
          { text: '비 오는 날엔 우산, 먼지 많은 날엔 마스크를 알려줘요', x: 146, y: 264, w: 232, h: 56, to: [114, 338], bend: -0.2 },
          { text: '오늘 입을 옷을 이렇게 골라줘요 ^_^', x: 170, y: 348, w: 186, h: 42, to: [208, 474], bend: -0.25 },
        ],
      },
    ],
  },
  {
    title: '옷장',
    sub: '내 옷을 등록해 두면 그 옷으로 코디해요',
    frames: [
      {
        image: '/tour/wardrobe.jpg',
        alt: '뭐입을옷? 옷장 화면: 옷걸이에 걸린 내 옷들',
        callouts: [
          { text: '옷은 여기서 추가해요', x: 196, y: 60, w: 178, h: 32, to: [262, 48], bend: 0.3 },
          { text: '등록한 옷이 옷걸이에 걸려요 ^_^', x: 246, y: 606, w: 134, h: 84, to: [224, 640], bend: 0.2 },
        ],
      },
    ],
  },
  {
    title: '캐릭터',
    sub: '5벌 이상 등록하면 열려요 · 위아래로 밀어보세요',
    frames: [
      {
        image: '/tour/character.jpg',
        alt: '뭐입을옷? 캐릭터 화면: 내 옷장 칭호와 꾸민 졸라맨, 꾸미기 목록',
        callouts: [
          { text: '내 옷장에 어울리는 칭호가 붙어요 ^_^', x: 236, y: 230, w: 144, h: 50, to: [236, 332], bend: 0.12 },
          { text: '꾸민 모습이 바로 입혀져요', x: 12, y: 72, w: 112, h: 54, to: [172, 118], bend: -0.2 },
          { text: '골라서 바로 꾸며요 ^_^', x: 84, y: 414, w: 200, h: 30, to: [130, 488], bend: 0.3 },
        ],
      },
      {
        // 위 설명이 끝나면 아래로 스르륵 내려와서 보여 주는 "내 옷장 분석" 구역
        image: '/tour/character2.jpg',
        alt: '뭐입을옷? 캐릭터 화면 아래쪽: 내 옷장 분석(색상, 종류, 무늬)과 칭호 도감',
        callouts: [
          { text: '내 옷장을 분석해줘요', x: 190, y: 8, w: 190, h: 44, to: [262, 118], bend: 0.2 },
          { text: '내 옷장에 맞는 칭호를 15가지 중에서 정해줘요', x: 176, y: 538, w: 204, h: 46, to: [260, 618], bend: -0.2 },
        ],
      },
    ],
  },
  {
    title: '일정',
    sub: '약속이 있는 날을 미리 등록해요',
    frames: [
      {
        image: '/tour/events.jpg',
        alt: '뭐입을옷? 일정 화면: 일정 목록과 달력',
        callouts: [
          { text: '일정은 여기서 추가해요', x: 196, y: 62, w: 178, h: 34, to: [322, 50], bend: 0.3 },
          { text: '일정을 달력에서 확인할 수 있어요!', x: 36, y: 706, w: 318, h: 40, to: [246, 592], bend: 0.35 },
        ],
      },
    ],
  },
  {
    title: '일정별 옷차림',
    sub: '그날 날씨에 맞춰 미리 알려줘요',
    frames: [
      {
        image: '/tour/event.jpg',
        alt: '뭐입을옷? 일정 상세 화면: 날짜별 아침, 낮, 저녁 날씨',
        callouts: [
          { text: '일정에 맞는 옷차림을 만들어줘요', x: 214, y: 90, w: 166, h: 62, to: [196, 176], bend: -0.25 },
          { text: '그날 아침·낮·저녁 날씨를 미리 확인할 수 있어요 ^_^', x: 112, y: 428, w: 268, h: 62, to: [206, 546], bend: 0.25 },
        ],
      },
    ],
  },
]

/** 캡처 아래쪽 메뉴 줄의 버튼 위치(캡처 픽셀)와 이동할 단계. 설정은 둘러보기에 없어서 뺐다. */
const TABS = [
  { label: '홈', x: 44, step: 0 },
  { label: '옷장', x: 118, step: 1 },
  { label: '캐릭터', x: 196, step: 2 },
  { label: '일정', x: 272, step: 3 },
]
const TAB_W = 74
const TAB_TOP = 780

const frameCount = (i: number) => STEPS[i]?.frames.length ?? 0
/** 다음: 같은 단계에 아래 화면이 남았으면 그리로, 아니면 다음 단계 */
const advance = ({ i, f }: Pos): Pos => (i >= STEPS.length ? { i, f } : f < frameCount(i) - 1 ? { i, f: f + 1 } : { i: i + 1, f: 0 })
/** 이전: 같은 단계에서 위 화면으로, 아니면 이전 단계의 마지막 화면 */
const retreat = ({ i, f }: Pos): Pos => (f > 0 ? { i, f: f - 1 } : i > 0 ? { i: i - 1, f: frameCount(i - 1) - 1 } : { i, f })

/** 사각형(말풍선) 가장자리에서 목표 방향으로 나가는 점 */
function edgePoint(cx: number, cy: number, w: number, h: number, tx: number, ty: number): [number, number] {
  const dx = tx - cx
  const dy = ty - cy
  const sx = dx === 0 ? Infinity : w / 2 / Math.abs(dx)
  const sy = dy === 0 ? Infinity : h / 2 / Math.abs(dy)
  const s = Math.min(sx, sy)
  return [cx + dx * s, cy + dy * s]
}

/** 점선 곡선 + 화살촉 */
function Arrow({ c, delay }: { c: Callout; delay: number }) {
  const cx = c.x + c.w / 2
  const cy = c.y + c.h / 2
  const [sx, sy] = edgePoint(cx, cy, c.w + 8, c.h + 8, c.to[0], c.to[1])
  const [ex, ey] = c.to
  const mx = (sx + ex) / 2
  const my = (sy + ey) / 2
  const dist = Math.hypot(ex - sx, ey - sy)
  const nx = -(ey - sy) / (dist || 1)
  const ny = (ex - sx) / (dist || 1)
  const qx = mx + nx * dist * (c.bend ?? 0.2)
  const qy = my + ny * dist * (c.bend ?? 0.2)
  // 화살촉: 끝에서 들어오는 방향(q -> e)의 반대로 두 줄
  const ang = Math.atan2(ey - qy, ex - qx)
  const head = (da: number) => `${ex - 11 * Math.cos(ang + da)},${ey - 11 * Math.sin(ang + da)}`
  return (
    <g className="tour-arrow" style={{ animationDelay: `${delay}s` }}>
      <path d={`M${sx} ${sy} Q${qx} ${qy} ${ex} ${ey}`} strokeDasharray="7 7" />
      <path d={`M${head(0.5)} L${ex},${ey} L${head(-0.5)}`} />
    </g>
  )
}

export default function TourPage() {
  const nav = useNavigate()
  const { install, installed, hint } = useInstallAction()
  const [pos, setPos] = useState<Pos>({ i: 0, f: 0 })
  const { i, f } = pos
  const [manual, setManual] = useState(-1) // 사용자가 직접 넘기거나 민 단계: 이 단계에서는 자동 슬라이드를 하지 않는다
  const [dragY, setDragY] = useState<number | null>(null) // 위아래로 미는 중인 거리(px)
  const phoneRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(pos)
  const drag = useRef({ startY: null as number | null, moved: false, lastWheel: 0 })
  const [reaction, setReaction] = useState<'idle' | 'flat' | 'cry'>('idle') // 안 쓸래요를 누르면: 무표정 -> 울음
  const [msg, setMsg] = useState('')
  const timers = useRef<number[]>([])
  const busy = reaction !== 'idle'
  const last = i === STEPS.length // 마지막은 "어때요?" 화면
  const step = STEPS[i]
  const touchX = useRef<number | null>(null)

  const next = () => {
    if (busy) return
    setManual(i)
    setPos(advance)
  }
  const prev = () => {
    if (busy) return
    setManual(i)
    setPos(retreat)
  }

  // 캡처 속 메뉴 버튼을 누르면 그 화면의 둘러보기로 간다
  const goStep = (n: number) => {
    if (busy) return
    setManual(-1) // 새로 들어간 단계에서는 자동 슬라이드가 다시 동작한다
    setPos({ i: n, f: 0 })
  }

  const multi = !!step && step.frames.length > 1 // 화면이 여러 장이면 위아래로 밀어서 볼 수 있다

  useEffect(() => {
    posRef.current = pos
  })

  // 위아래로 밀기(터치/마우스 드래그): 미는 동안 화면이 손가락을 따라오고, 놓으면 가까운 화면에 붙는다
  const onDown = (e: React.PointerEvent) => {
    if (!multi || busy) return
    if ((e.target as HTMLElement).closest('.tour-tab')) return // 메뉴 버튼은 밀기가 아니라 누르기
    drag.current.startY = e.clientY
    drag.current.moved = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    const y0 = drag.current.startY
    if (y0 == null || !step) return
    let dy = e.clientY - y0
    if (Math.abs(dy) > 6) drag.current.moved = true
    // 맨 위/맨 아래에서 더 밀면 살짝만 따라온다
    if ((f === 0 && dy > 0) || (f === step.frames.length - 1 && dy < 0)) dy *= 0.3
    setDragY(dy)
  }
  const onUp = () => {
    const y0 = drag.current.startY
    drag.current.startY = null
    if (y0 == null || !step) return
    const dy = dragY ?? 0
    setDragY(null)
    if (dy < -50 && f < step.frames.length - 1) {
      setManual(i)
      setPos(advance)
    } else if (dy > 50 && f > 0) {
      setManual(i)
      setPos(retreat)
    }
  }
  // 마우스 휠: 이 단계 안에서 위/아래 화면으로 (더 갈 곳이 없으면 페이지가 그대로 스크롤되게 둔다)
  useEffect(() => {
    const el = phoneRef.current
    if (!el || !multi || busy) return
    const onWheel = (e: WheelEvent) => {
      const { i: ci, f: cf } = posRef.current
      const n = frameCount(ci)
      const down = e.deltaY > 0
      if (Math.abs(e.deltaY) < 8 || (down && cf >= n - 1) || (!down && cf <= 0)) return
      e.preventDefault()
      const now = performance.now()
      if (now - drag.current.lastWheel < 800) return
      drag.current.lastWheel = now
      setManual(ci)
      setPos(down ? advance : retreat)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [i, multi, busy])

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  // 이스터에그: 졸라맨이 시무룩해졌다가(-_- -> ㅠㅠ) 잠시 뒤 구글로 가 버린다
  const decline = () => {
    if (busy) return
    setReaction('flat')
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
    at(850, () => {
      setReaction('cry')
      setMsg('ㅠㅠ')
    })
    ;['.', '..', '...', '....'].forEach((d, k) => at(1250 + k * 120, () => setMsg('ㅠㅠ ' + d)))
    at(2100, () => setMsg('ㅠㅠ .... 네...'))
    at(4100, () => {
      if (!HOLD) window.location.assign(BYE_URL)
    })
  }

  // 한 단계에 화면이 여러 장이면, 말풍선을 다 읽을 시간이 지난 뒤 자동으로 아래 화면으로 슬라이드한다
  useEffect(() => {
    if (busy || !step || manual === i || f >= step.frames.length - 1) return
    const n = step.frames[f]!.callouts.length
    const lastBubbleAt = (f > 0 ? SLIDE : 0) + 0.35 + (n - 1) * 0.7
    const t = window.setTimeout(() => setPos(advance), (lastBubbleAt + 0.45 + READ) * 1000)
    return () => window.clearTimeout(t)
  }, [i, f, busy, step, manual])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (timers.current.length > 0) return // 안 쓸래요 반응 중에는 넘기지 않는다
      if (e.key === 'ArrowRight') setPos(advance)
      if (e.key === 'ArrowLeft') setPos(retreat)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <main
      className="tour"
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(e) => {
        const x0 = touchX.current
        const x1 = e.changedTouches[0]?.clientX
        touchX.current = null
        if (x0 == null || x1 == null || Math.abs(x1 - x0) < 60) return
        if (x1 < x0) next()
        else prev()
      }}
    >
      <header className="tour-head">
        <button type="button" className="tour-back" onClick={() => nav('/')} aria-label="처음으로">
          ←
        </button>
        <h1>
          <HandText>둘러보기</HandText>
        </h1>
        <span className="tiny tour-count">{last ? '끝' : `${i + 1} / ${STEPS.length}`}</span>
      </header>

      {step ? (
        <section key={i} className="tour-step">
          <h2>
            <HandText>{step.title}</HandText>
          </h2>
          <p className="tiny">{step.sub}</p>

          <div
            ref={phoneRef}
            className={`tour-phone${multi ? ' multi' : ''}`}
            onClick={() => {
              if (drag.current.moved) {
                drag.current.moved = false // 밀고 난 뒤의 클릭은 넘기기로 치지 않는다
                return
              }
              next()
            }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <div
              className="tour-track"
              style={{
                transform: `translateY(calc(${-(f / step.frames.length) * 100}% + ${dragY ?? 0}px))`,
                transition: dragY !== null ? 'none' : undefined,
              }}
            >
              {step.frames.map((fr, fi) => {
                // 슬라이드로 내려온 화면은 내려오는 동안(SLIDE) 기다렸다가 말풍선을 띄운다
                const base = fi > 0 ? SLIDE : 0
                return (
                  <div key={fi} className={`tour-frame${fi === f ? ' on' : ''}`}>
                    <img src={fr.image} alt={fr.alt} width={W} height={H} draggable={false} />
                    <svg className="doodle tour-lines" viewBox={`0 0 ${W} ${H}`} fill="none" stroke="#222" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {fr.callouts.map((c, k) => (
                        <Arrow key={k} c={c} delay={base + 0.5 + k * 0.7} />
                      ))}
                    </svg>
                    {fr.callouts.map((c, k) => (
                      <div
                        key={k}
                        className="tour-bubble"
                        style={{
                          left: `${(c.x / W) * 100}%`,
                          top: `${(c.y / H) * 100}%`,
                          width: `${(c.w / W) * 100}%`,
                          minHeight: `${(c.h / H) * 100}%`,
                          animationDelay: `${base + 0.35 + k * 0.7}s`,
                          transform: `rotate(${k % 2 === 0 ? -1.2 : 1}deg)`,
                        }}
                      >
                        <HandText>{c.text}</HandText>
                      </div>
                    ))}
                    {TABS.map((t) => (
                      <button
                        key={t.label}
                        type="button"
                        className="tour-tab"
                        aria-label={`${t.label} 화면 둘러보기`}
                        style={{
                          left: `${((t.x - TAB_W / 2) / W) * 100}%`,
                          top: `${(TAB_TOP / H) * 100}%`,
                          width: `${(TAB_W / W) * 100}%`,
                          height: `${((H - TAB_TOP) / H) * 100}%`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation() // 화면 누르기(다음으로)로 번지지 않게
                          goStep(t.step)
                        }}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      ) : (
        <section className="tour-step tour-end">
          <ReactFigure mood={reaction === 'idle' ? 'smile' : reaction} size={150} />
          <div className="tour-lead-box" aria-live="polite">
            {reaction === 'cry' ? (
              <p className="lead tour-sad">
                <HandText>{msg}</HandText>
              </p>
            ) : (
              <p className={`lead${reaction === 'flat' ? ' tour-fadeout' : ''}`}>
                <span className="lead-line">
                  <HandText>어때요? 한번 써봐주세요 ^_^</HandText>
                </span>
                <span className="lead-line">
                  <HandText>설치하면 앱처럼 바로 열 수 있어요</HandText>
                </span>
              </p>
            )}
          </div>
          <div className="landing-actions">
            <button type="button" className="dbtn block w1" onClick={() => void install()} disabled={busy}>
              {installed ? '설치됐어요! 홈 화면에서 열어주세요' : '앱으로 설치하고 테스트해주기'}
            </button>
            {hint && !busy && (
              <p className="tiny install-hint" role="status">
                {hint}
              </p>
            )}
            <button type="button" className="skip-link" onClick={decline} disabled={busy}>
              안 쓸래요
            </button>
          </div>
        </section>
      )}

      <nav className="tour-nav" aria-label="둘러보기 이동">
        <button type="button" className="dbtn small" onClick={prev} disabled={(i === 0 && f === 0) || busy}>
          이전
        </button>
        <span className="tour-dots" aria-hidden="true">
          {[...STEPS, null].map((_, k) => (
            <span key={k} className={k === i ? 'on' : ''} />
          ))}
        </span>
        <button type="button" className="dbtn small" onClick={next} disabled={last || busy}>
          다음
        </button>
      </nav>
    </main>
  )
}
