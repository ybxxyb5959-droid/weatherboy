import { useEffect, useState } from 'react'

// 로딩 그림: 클립보드의 항목마다 연필이 혼자 ✓ 를 한다.
// 응답이 금방 오면 다 체크한 모습으로 가만히 있고, 1초 넘게 걸리면 한 칸씩 체크하는 움직임이 시작된다(4.8초 반복).
// 움직임은 SVG 애니메이션(SMIL)이고, "움직임 줄이기"에서는 시작하지 않는다.

const CYCLE = '4.8s'
const T = [0, 0.04, 0.08, 0.14, 0.22, 0.26, 0.32, 0.4, 0.44, 0.5, 0.58, 0.88, 1]
const ROWS = [52, 80, 108]
// 연필 끝의 자리: 칸마다 ✓ 의 획(시작 -> 아래로 -> 위로)을 따라가고, 다 하면 옆으로 물러난다
const REST: [number, number] = [122, 128]
const PEN: [number, number][] = [
  [81, 52], [81, 52], [86, 57], [97, 44],
  [81, 80], [86, 85], [97, 72],
  [81, 108], [86, 113], [97, 100],
  REST, REST, [81, 52],
]
const keyTimes = T.join(';')
const calm = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const TICKS = [
  { y: ROWS[0], from: 0.04, to: 0.14 },
  { y: ROWS[1], from: 0.22, to: 0.32 },
  { y: ROWS[2], from: 0.4, to: 0.5 },
]

export default function CheckScene({ size = 140 }: { size?: number }) {
  const [moving, setMoving] = useState(false)
  useEffect(() => {
    if (calm()) return
    const t = window.setTimeout(() => setMoving(true), 1000)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <svg className="doodle check-scene" width={size} height={size * 1.07} viewBox="0 0 150 160" fill="none" stroke="#222" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" overflow="visible" aria-hidden="true">
      {/* 클립보드: 삐뚤게 놓여 있다 */}
      <g transform="rotate(-3 65 80)">
        <rect x="22" y="16" width="86" height="130" rx="6" fill="#fcfcfa" />
        <path d="M50 10 H80 V24 H50 Z" fill="#fcfcfa" strokeWidth="2.2" />
        <path d="M58 17 H72" strokeWidth="2" opacity="0.6" />
        {TICKS.map((t) => (
          <g key={t.y}>
            <path d={`M34 ${t.y} H68`} strokeWidth="2.2" opacity="0.5" />
            <path d={`M34 ${t.y + 10} H58`} strokeWidth="1.6" opacity="0.3" />
            <rect x="80" y={t.y - 8} width="14" height="14" rx="2" strokeWidth="2.2" />
          </g>
        ))}

        {/* ✓: 한 칸씩 그려진다. 움직이지 않을 때는 다 그려져 있다 */}
        <g stroke="#3a9a5c" strokeWidth="3.4">
          {TICKS.map((t) => (
            <path key={t.y} d={`M81 ${t.y} L86 ${t.y + 5} L97 ${t.y - 8}`} pathLength="1" strokeDasharray="1" strokeDashoffset="0">
              {moving && (
                <>
                  <animate attributeName="stroke-dashoffset" dur={CYCLE} repeatCount="indefinite" keyTimes={`0;${t.from};${t.to};1`} values="1;1;0;0" />
                  <animate attributeName="opacity" dur={CYCLE} repeatCount="indefinite" keyTimes="0;0.88;0.98;1" values="1;1;0;0" />
                </>
              )}
            </path>
          ))}
        </g>

        {/* 연필: 끝이 ✓ 의 획을 따라 움직인다 */}
        <g transform={`translate(${REST[0]} ${REST[1]})`}>
          {moving && <animateTransform attributeName="transform" type="translate" dur={CYCLE} repeatCount="indefinite" keyTimes={keyTimes} values={PEN.map(([x, y]) => `${x} ${y}`).join(';')} />}
          <path d="M0 0 L3 -7 L17 -30 L22 -27 L8 -4 Z" fill="#e8a24a" strokeWidth="2.2" />
          <path d="M3 -7 L8 -4" strokeWidth="2" />
          <path d="M17 -30 L22 -27" strokeWidth="2" stroke="#e05a5a" />
        </g>
      </g>
    </svg>
  )
}
