// 지난 일정 그림: 졸라맨(뒷모습, 상반신만)이 벽걸이 달력의 지난 장을 뜯어낸다.
// 들어올 때 한 번만 움직인다: 팔을 뻗어 종이를 잡고 -> 당겨 뜯고 -> 종이가 떨어져 사라지면 새 장이 드러난다.
// 움직임은 motion.css 의 .ps-* 가 맡는다("움직임 줄이기"에서는 뜯고 난 뒤의 모습으로 가만히 있는다).

const GRID = 'M118 56 H193 M117 72 H194 M117 88 H195 M116 104 H196 M135 46 V116 M155 46 V116 M175 46 V116'

export default function PastScene({ size = 220 }: { size?: number }) {
  return (
    <svg className="doodle past-scene" width={size} height={size * 0.72} viewBox="0 0 220 158" fill="none" stroke="#222" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" overflow="visible" aria-hidden="true">
      {/* 벽걸이 달력: 삐뚤게 걸려 있다 */}
      <g transform="rotate(2.5 156 70)">
        <path d="M156 6 V20" strokeWidth="2" />
        <path d="M112 22 Q156 19 199 24 L200 120 Q156 124 113 119 Z" fill="#fcfcfa" />
        <path d="M112 22 Q156 19 199 24 L199.4 40 Q156 36 112.4 39 Z" fill="#e8a24a" fillOpacity="0.45" strokeWidth="2.2" />
        <path d="M130 21 v-4 M160 21 v-4 M188 22.5 v-4" strokeWidth="2.2" />
        {/* 뜯고 난 뒤 드러난 새 장 */}
        <path d={GRID} strokeWidth="1.3" opacity="0.4" />
        <path d="M121 47 l5 -1 M141 46 l4 0 M161 46 l5 0 M181 47 l4 -1" strokeWidth="1.8" opacity="0.55" />
        {/* 윗단에 남은 들쭉날쭉한 종이 끝 */}
        <path d="M113 39 L118 34 L123 40 L129 34 L135 41 L142 35 L148 41 L156 35 L163 41 L170 35 L177 41 L184 36 L191 41 L199 37" strokeWidth="1.8" fill="#fcfcfa" />

        {/* 뜯기는 지난 장: 칸마다 X 로 지워 둔 모습. 윗단을 축으로 말려 올라오다 떨어진다 */}
        <g className="ps-sheet" style={{ transformOrigin: '156px 40px' }}>
          <path d="M113 40 Q156 36 199 41 L200 120 Q156 124 113 119 Z" fill="#fcfcfa" />
          <path d={GRID} strokeWidth="1.3" opacity="0.4" />
          <path d="M118 60 l12 10 M130 60 l-12 10 M138 60 l12 10 M150 60 l-12 10 M158 60 l12 10 M170 60 l-12 10 M178 60 l12 10 M190 60 l-12 10" strokeWidth="1.6" opacity="0.55" />
          <path d="M118 78 l12 10 M130 78 l-12 10 M138 78 l12 10 M150 78 l-12 10" strokeWidth="1.6" opacity="0.55" />
        </g>
      </g>

      {/* 졸라맨: 뒷모습, 상반신만(허리 아래는 그리지 않는다) */}
      <g>
        <circle cx="64" cy="70" r="16" fill="#fcfcfa" />
        <path d="M64 86 L62 158" />
        {/* 왼팔은 아래로 늘어뜨린다 */}
        <path d="M64 100 L42 128" />
        {/* 뜯는 오른팔: 달력 쪽으로 쭉 뻗어 종이 모서리를 쥔다 */}
        <g className="ps-arm" style={{ transformOrigin: '64px 100px' }}>
          <path d="M64 100 L88 92 L107 69" />
          <circle cx="109" cy="66" r="3.6" fill="#fcfcfa" strokeWidth="2.2" />
        </g>
      </g>

      {/* 뜯는 순간의 찢어지는 기운 */}
      <path className="ps-puff" d="M100 52 q-5 3 -4 9 M104 44 q-6 1 -8 6 M114 34 l-3 -7 M126 30 l0 -7" strokeWidth="1.8" stroke="#e8a24a" />

      {/* 뜯으면서 흩어진 조각 */}
      <g strokeWidth="2">
        <g className="ps-bit ps-b1"><path d="M118 134 L131 131 L134 142 L121 146 Z" fill="#fcfcfa" transform="rotate(16 126 138)" /></g>
        <g className="ps-bit ps-b2"><path d="M146 128 L158 125 L160 136 L148 139 Z" fill="#fcfcfa" transform="rotate(-20 153 132)" /></g>
        <g className="ps-bit ps-b3"><path d="M204 70 L212 68 L213 77 L205 79 Z" fill="#fcfcfa" transform="rotate(22 208 73)" opacity="0.8" /></g>
      </g>
    </svg>
  )
}
