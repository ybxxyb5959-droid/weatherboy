import { useEffect, useState, type ReactNode } from 'react'
import { ClothingArt } from './ClothingDoodle'
import StickPerson from './StickPerson'
import { useCharacter } from '../lib/character'

// 화면별 로딩 장면: 졸라맨이 그 화면에 어울리는 일을 하며 기다린다(서버 깨우기 장면과 같은 그림체).
// 움직임은 motion.css 의 .ls-* 가 맡는다("움직임 줄이기"에서는 정지 그림만 보여준다).
// 로딩이 0.4초도 안 걸리는 화면에서는 번쩍이지 않게, 그만큼 지난 뒤에야 나타난다.

export type LoadingKind = 'weather' | 'calendar' | 'note' | 'closet' | 'mirror' | 'gear' | 'letter' | 'edit'

const svgProps = { viewBox: '0 0 220 160', fill: 'none', stroke: '#222', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round', overflow: 'visible', 'aria-hidden': true } as const

/** 졸라맨 몸(머리·얼굴·몸통·다리). 팔은 장면마다 따로 그린다. x 는 가로 위치. */
function Man({ x = 0, children, head }: { x?: number; children?: ReactNode; head?: string }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <g className={head}>
        <circle cx="62" cy="46" r="16" fill="#fcfcfa" />
        <g stroke="none" fill="#222">
          <circle cx="56.5" cy="45" r="1.8" />
          <circle cx="67.5" cy="45" r="1.8" />
        </g>
        <path d="M57 52 Q62 56 67 52" strokeWidth="2" />
      </g>
      <path d="M62 62 L62 104 M62 104 L50 138 M62 104 L76 138" />
      {children}
    </g>
  )
}

const Ground = () => <path d="M6 142 H214" strokeWidth="2" opacity="0.45" />

/** 우리 앱의 해(DoodleWeather 의 Sun)를 가운데 (0,0) 기준으로 */
function SunDoodle() {
  return (
    <g transform="translate(-25 -25)">
      <path className="ls-spin" style={{ transformOrigin: '25px 25px' }} d="M25 3 L25 8 M25 42 L26 47 M3 25 L8 25 M42 24 L47 25 M9 9 L13 13 M37 37 L41 41 M41 9 L37 13 M9 41 L13 37" stroke="#e8a24a" strokeWidth="2.4" />
      <path d="M25 14 C33 13 37 22 35 28 C32 36 20 37 15 30 C12 22 17 15 25 14Z" fill="#f2cf4a" />
      <path d="M21 25 l.1 0 M29 25 l.1 0" strokeWidth="3.2" />
      <path d="M22 29.5 Q25 33 28 29.5" strokeWidth="1.8" />
    </g>
  )
}

/** 홈: 하늘을 올려다본다. 해 → 구름이 가리고 → 비 → 우산 → 다시 해 */
function Weather() {
  return (
    <svg className="doodle loading-svg ls-weather" {...svgProps}>
      <Ground />
      <Man head="ls-look">
        <path d="M62 72 L46 98" />
        <g className="ls-brow" style={{ transformOrigin: '62px 72px' }}>
          <path d="M62 72 L88 62" />
          <circle cx="91" cy="61" r="3.4" fill="#fcfcfa" strokeWidth="2.2" />
        </g>
        <g className="ls-umb" style={{ transformOrigin: '76px 24px' }}>
          <path d="M48 24 Q76 -8 104 24 Q96 19 90 24 Q83 19 76 24 Q69 19 62 24 Q56 19 48 24Z" fill="#cfe6e2" />
          <path d="M76 24 L88 62" />
        </g>
      </Man>
      <g transform="translate(150 42) scale(1.1)">
        <SunDoodle />
      </g>
      <g className="ls-cloud">
        <path d="M118 52 C106 52 105 38 117 37 C117 25 135 22 141 33 C152 27 165 37 158 46 C166 48 162 53 155 52Z" fill="#fcfcfa" />
        <g className="ls-rain" stroke="#4aa6a0" strokeWidth="2.2">
          <path className="ls-drop" d="M124 60 l-3 8" />
          <path className="ls-drop ls-d2" d="M136 60 l-3 8" />
          <path className="ls-drop ls-d3" d="M148 60 l-3 8" />
          <path className="ls-drop ls-d4" d="M158 60 l-3 8" />
        </g>
      </g>
    </svg>
  )
}

const DOTS = [78, 94, 110].flatMap((y) => [128, 144, 160, 176].map((x) => `M${x} ${y} l.1 0`)).join(' ')

/** 일정 목록: 큰 달력을 한 장씩 넘기고, 날짜에 펜으로 동그라미 */
function Calendar() {
  return (
    <svg className="doodle loading-svg ls-calendar" {...svgProps}>
      <Ground />
      <Man>
        <path d="M62 72 L46 98" />
        <g className="ls-point" style={{ transformOrigin: '62px 72px' }}>
          <path d="M62 72 L100 84" />
          <path d="M100 84 l8 3" stroke="#4a7fc1" strokeWidth="3.4" />
        </g>
      </Man>
      <g>
        <rect x="112" y="38" width="88" height="92" rx="6" fill="#fcfcfa" />
        <path d="M112 60 H200" />
        <path d="M134 32 v12 M178 32 v12" />
        <path d={DOTS} strokeWidth="3" />
        <g className="ls-page ls-p2" style={{ transformOrigin: '156px 60px' }}>
          <rect x="114" y="61" width="84" height="67" fill="#fcfcfa" stroke="none" />
          <path d="M128 78 l.1 0 M144 78 l.1 0 M160 78 l.1 0 M176 78 l.1 0 M128 94 l.1 0 M144 94 l.1 0 M160 94 l.1 0 M176 94 l.1 0" strokeWidth="3" />
          <path d="M120 70 H192" strokeWidth="1.4" opacity="0.5" />
        </g>
        <g className="ls-page ls-p1" style={{ transformOrigin: '156px 60px' }}>
          <rect x="114" y="61" width="84" height="67" fill="#fcfcfa" stroke="none" />
          <path d="M128 78 l.1 0 M144 78 l.1 0 M160 78 l.1 0 M176 78 l.1 0 M128 110 l.1 0 M144 110 l.1 0 M160 110 l.1 0 M176 110 l.1 0" strokeWidth="3" />
          <path d="M120 70 H192" strokeWidth="1.4" opacity="0.5" />
        </g>
        <path className="ls-circle" d="M146 96 C146 85 172 85 174 96 C176 107 148 108 146 97 C146 90 160 86 170 90" pathLength="1" stroke="#e05a5a" strokeWidth="2.8" />
      </g>
    </svg>
  )
}

/** 일정 상세: 테이프로 쪽지를 벽에 붙이고, 날씨 낙서를 적는다 */
function Note() {
  return (
    <svg className="doodle loading-svg ls-note" {...svgProps}>
      <Ground />
      <Man>
        <path d="M62 72 L46 98" />
        <g className="ls-pat" style={{ transformOrigin: '62px 72px' }}>
          <path d="M62 72 L100 56" />
          <circle cx="103" cy="54.5" r="3.4" fill="#fcfcfa" strokeWidth="2.2" />
        </g>
      </Man>
      <g className="ls-paper" style={{ transformOrigin: '150px 30px' }}>
        <path d="M104 34 L196 31 L198 124 L106 127Z" fill="#fcfcfa" />
        <g className="ls-tape ls-t1" style={{ transformOrigin: '118px 34px' }}>
          <rect x="105" y="26" width="30" height="11" fill="rgba(34,34,34,0.07)" strokeWidth="1.6" transform="rotate(-6 118 34)" />
        </g>
        <g className="ls-tape ls-t2" style={{ transformOrigin: '180px 31px' }}>
          <rect x="165" y="24" width="30" height="11" fill="rgba(34,34,34,0.07)" strokeWidth="1.6" transform="rotate(5 180 31)" />
        </g>
        <path className="ls-line ls-l1" d="M116 62 C130 58 144 66 160 61" pathLength="1" />
        <path className="ls-line ls-l2" d="M116 78 C132 74 150 82 176 76" pathLength="1" />
        <path className="ls-line ls-l3" d="M116 94 C128 90 140 98 156 93" pathLength="1" />
        <g className="ls-doodle">
          <circle cx="178" cy="108" r="6" fill="#f2cf4a" strokeWidth="1.8" />
          <path d="M178 97 V99 M167 108 H169 M189 108 H187 M170 100 L172 102 M186 100 L184 102" strokeWidth="1.6" stroke="#e8a24a" />
          <path d="M122 112 C116 112 116 105 122 105 C123 99 132 99 134 105 C140 105 140 112 134 112Z" fill="#fcfcfa" strokeWidth="1.8" />
        </g>
      </g>
    </svg>
  )
}

/** 옷장: 졸라맨이 빨랫줄에 옷을 하나씩 건다 */
function Closet() {
  const clothes = [
    { x: 92, type: '반팔', color: '하늘색', cls: 'ls-c1' },
    { x: 128, type: '바지', color: '검정', cls: 'ls-c2' },
    { x: 164, type: '긴팔', color: '베이지', cls: 'ls-c3' },
  ]
  return (
    <svg className="doodle loading-svg ls-closet" {...svgProps}>
      <Ground />
      <path d="M72 30 C110 40 160 40 208 28" strokeWidth="2.2" />
      <path d="M72 24 V140 M208 22 V140" strokeWidth="2" opacity="0.45" />
      <Man>
        <path d="M62 72 L46 98" />
        <g className="ls-reach" style={{ transformOrigin: '62px 72px' }}>
          <path d="M62 72 L84 44" />
          <circle cx="86" cy="41" r="3.4" fill="#fcfcfa" strokeWidth="2.2" />
        </g>
      </Man>
      {clothes.map((c) => (
        <g key={c.type} transform={`translate(${c.x} 0)`}>
          <g className={`ls-cloth ${c.cls}`} style={{ transformOrigin: '0px 36px' }}>
            <g transform="translate(-17 33) scale(0.34)" strokeWidth="5">
              <ClothingArt type={c.type} color={c.color} />
            </g>
          </g>
        </g>
      ))}
    </svg>
  )
}

/** 캐릭터: 내 캐릭터가 거울 앞에서 한 바퀴 돌며 뽐낸다 */
function Mirror() {
  const character = useCharacter().data
  const acc = character?.unlocked ? character.config : undefined
  return (
    <div className="loading-svg ls-mirror" aria-hidden="true">
      <div className="ls-turn">
        <StickPerson mood="stand" size={104} persona={null} accessories={acc} />
      </div>
      <div className="ls-glass">
        <div className="ls-reflect">
          <StickPerson mood="stand" size={64} persona={null} accessories={acc} />
        </div>
        <i className="ls-shine" />
      </div>
      <svg className="ls-sparkles" viewBox="0 0 80 100" fill="none" stroke="#e8a24a" strokeWidth="2.4" strokeLinecap="round">
        <path className="ls-sp ls-sp1" d="M66 14 v-8 M62 10 h8" />
        <path className="ls-sp ls-sp2" d="M10 56 v-6 M7 53 h6" />
        <path className="ls-sp ls-sp3" d="M70 84 v-6 M67 81 h6" />
      </svg>
    </div>
  )
}

// 톱니: 이빨 n 개짜리 바퀴 모양 길
function gearPath(teeth: number, rOut: number, rIn: number) {
  const pts: string[] = []
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2
    const w = (Math.PI * 2) / teeth
    for (const [da, r] of [[0.08, rIn], [0.22, rOut], [0.5, rOut], [0.64, rIn]] as const) {
      const a = a0 + da * w
      pts.push(`${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`)
    }
  }
  return `M${pts.join(' L')}Z`
}
const BIG_GEAR = gearPath(10, 34, 27)
const SMALL_GEAR = gearPath(6, 21, 15)

/** 설정: 톱니바퀴를 렌치로 돌려 맞춘다(철컥, 철컥, 철컥) */
function Gear() {
  return (
    <svg className="doodle loading-svg ls-gear" {...svgProps}>
      <Ground />
      <Man>
        <path d="M62 72 L46 98" />
        <g className="ls-wrench" style={{ transformOrigin: '62px 72px' }}>
          <path d="M62 72 L112 78" />
          <circle cx="115" cy="78.5" r="3.4" fill="#fcfcfa" strokeWidth="2.2" />
        </g>
      </Man>
      <g transform="translate(150 80)">
        <g className="ls-bigg">
          <path d={BIG_GEAR} fill="#e7dcc4" strokeWidth="2.4" />
          <circle r="7" fill="#fcfcfa" strokeWidth="2.2" />
          <path d="M0 0 L22 0" strokeWidth="2.2" />
        </g>
      </g>
      <g transform="translate(192 122)">
        <g className="ls-smallg">
          <path d={SMALL_GEAR} fill="#cfe6e2" strokeWidth="2.4" />
          <circle r="4.5" fill="#fcfcfa" strokeWidth="2" />
        </g>
      </g>
      <path className="ls-sweat" d="M52 22 q-3 6 0 8 q3 -2 0 -8" stroke="#4aa6a0" fill="#cfe6e2" strokeWidth="1.4" />
    </svg>
  )
}

/** 후기: 편지를 써서 접어 우체통에 넣는다 */
function Letter() {
  return (
    <svg className="doodle loading-svg ls-letter" {...svgProps}>
      <Ground />
      <Man>
        <path d="M62 72 L46 98" />
        <path d="M62 72 L84 84" />
        <circle cx="87" cy="85.5" r="3.4" fill="#fcfcfa" strokeWidth="2.2" />
      </Man>
      {/* 우체통 */}
      <g>
        <path d="M184 142 V104" strokeWidth="3" />
        <path d="M168 104 V84 C168 70 200 70 200 84 V104Z" fill="#f4c6c6" />
        <path d="M174 90 H194" strokeWidth="2" />
        <path className="ls-flag" style={{ transformOrigin: '200px 94px' }} d="M200 94 V76 L212 80 L200 84" fill="#e05a5a" strokeWidth="2" />
      </g>
      {/* 편지: 써지고 → 접히고 → 우체통으로 */}
      <g className="ls-mail" style={{ transformOrigin: '110px 80px' }}>
        <g className="ls-sheet" style={{ transformOrigin: '110px 94px' }}>
          <rect x="94" y="60" width="38" height="46" fill="#fcfcfa" transform="rotate(-4 113 83)" />
          <path className="ls-line ls-l1" d="M100 72 H124" pathLength="1" />
          <path className="ls-line ls-l2" d="M100 82 H126" pathLength="1" />
          <path className="ls-line ls-l3" d="M100 92 H116" pathLength="1" />
        </g>
        <path className="ls-flap" d="M94 60 L113 76 L132 60" strokeWidth="2" />
      </g>
    </svg>
  )
}

/** 일정·옷 수정: 지우개로 지우고 펜으로 다시 쓴다 */
function Edit() {
  return (
    <svg className="doodle loading-svg ls-edit" {...svgProps}>
      <Ground />
      <Man>
        <path d="M62 72 L46 98" />
        <g className="ls-armtool" style={{ transformOrigin: '62px 72px' }}>
          <path d="M0 0 H40" transform="translate(62 72)" vectorEffect="non-scaling-stroke" />
        </g>
      </Man>
      <path d="M104 40 L196 37 L198 120 L106 123Z" fill="#fcfcfa" />
      <g className="ls-oldtext">
        <path d="M116 62 C130 58 144 66 160 61 M116 78 C132 74 150 82 176 76 M116 94 C128 90 140 98 156 93" strokeWidth="2.4" />
      </g>
      <g className="ls-newtext">
        <path d="M116 62 C130 66 144 58 164 63 M116 78 C134 82 150 74 172 79 M116 94 C130 98 146 90 168 95" strokeWidth="2.4" stroke="#4a7fc1" />
      </g>
      {/* 지우개 */}
      <g className="ls-eraser">
        <g transform="rotate(30)" strokeLinejoin="round">
          <rect x="-5" y="-11" width="10" height="11" rx="2.2" fill="#f2a7b0" strokeWidth="1.8" />
          <rect x="-5" y="-30" width="10" height="19" rx="2" fill="#fcfcfa" strokeWidth="1.8" />
        </g>
      </g>
      {/* 펜 */}
      <g className="ls-pen">
        <g transform="rotate(30)" strokeLinejoin="round">
          <path d="M0 0 L-2 -7 L2 -7Z" fill="#222" strokeWidth="1" />
          <rect x="-2.7" y="-36" width="5.4" height="29" rx="1.7" fill="#fcfcfa" strokeWidth="1.8" />
          <rect x="-2.7" y="-36" width="5.4" height="9" rx="1.7" fill="#4a7fc1" strokeWidth="1.8" />
        </g>
      </g>
    </svg>
  )
}

const SCENES: Record<LoadingKind, () => ReactNode> = { weather: Weather, calendar: Calendar, note: Note, closet: Closet, mirror: Mirror, gear: Gear, letter: Letter, edit: Edit }

export default function LoadingScene({ kind }: { kind: LoadingKind }) {
  const Scene = SCENES[kind]
  return <Scene />
}

/**
 * 화면 안의 로딩 표시. 0.4초가 지나도 안 끝날 때만 나타난다(금방 끝나는 로딩에서 번쩍이지 않게).
 * label 은 장면 아래 짧은 안내 글.
 */
export function Loading({ kind, label = '불러오는 중…' }: { kind: LoadingKind; label?: string }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setShow(true), 400)
    return () => window.clearTimeout(t)
  }, [])
  if (!show) return <div className="loading-wait" aria-hidden="true" />
  return (
    <div className="loading-scene" role="status" aria-live="polite">
      <LoadingScene kind={kind} />
      <p className="tiny">{label}</p>
    </div>
  )
}
