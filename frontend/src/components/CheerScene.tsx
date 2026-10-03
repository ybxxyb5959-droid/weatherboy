/**
 * 개발자 응원하기 그림: 밤늦게 노트북으로 타이핑하는 졸라맨(귀여운 다크서클), 옆에 김 나는 커피, 달 뜬 창문.
 * 움직임(CSS 애니메이션은 global.css 의 .cheer-*):
 *  타이핑하는 두 팔, 화면에 코드가 한 줄씩 써졌다 지워짐 + 깜빡이는 커서, "탁/딱" 키 소리,
 *  졸려서 꾸벅꾸벅 고개 + 눈 깜빡임, 이마 땀방울, 떠오르는 z, 커피 김, 반짝이는 별.
 */
export default function CheerScene() {
  return (
    <svg
      className="doodle cheer-scene"
      viewBox="0 0 320 230"
      width="100%"
      fill="none"
      stroke="#222"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="밤늦게 노트북으로 일하는 졸라맨과 커피 한 잔"
    >
      {/* 밤 창문: 달과 반짝이는 별 */}
      <g>
        <path d="M16 16 L80 16 L80 68 L16 68Z" fill="#26324d" strokeWidth="2.4" />
        <path d="M48 16 V68 M16 42 H80" stroke="#222" strokeWidth="1.8" />
        <path d="M66 28 Q55 35 62 50 Q51 48 49 38 Q49 27 66 28Z" fill="#f6d44c" stroke="#222" strokeWidth="1.6" />
        <g stroke="#f6e9a8" strokeWidth="1.6">
          <path className="cheer-star" d="M28 28 h6 M31 25 v6" />
          <path className="cheer-star s2" d="M68 58 h5 M70.5 55.5 v5" />
          <path className="cheer-star s3" d="M30 56 h5 M32.5 53.5 v5" />
        </g>
      </g>

      {/* 바닥과 그림자 */}
      <path d="M8 207 H312" strokeWidth="2.2" />
      <path d="M70 212 H190" strokeWidth="1.6" strokeDasharray="3 6" opacity="0.5" />

      {/* 의자 */}
      <path d="M96 104 L92 152" />
      <path d="M90 152 H134" />
      <path d="M92 152 L90 207 M132 152 L134 207" />

      {/* 책상 */}
      <path d="M150 143 H312" />
      <path d="M150 147 H312" strokeWidth="1.6" />
      <path d="M300 147 V207" />

      {/* 졸라맨: 몸통, 다리 */}
      <path d="M108 151 L118 97" />
      <path d="M108 151 L151 153 L153 205 L168 205" />

      {/* 머리(꾸벅꾸벅) */}
      <g className="cheer-head">
        <path d="M118 59 C128 58 135 66 135 76 C135 86 128 94 118 94 C108 94 101 86 101 76 C101 66 108 59 118 59Z" fill="#fcfcfa" />
        {/* 부스스한 머리카락 */}
        <path d="M107 62 Q108 53 113 59 M116 58 Q119 49 123 58 M126 60 Q132 55 132 64" strokeWidth="2.2" />
        {/* 졸린 눈: 눈꺼풀이 반쯤 내려옴 + 가끔 깜빡 */}
        <g className="cheer-eye">
          <circle cx="127" cy="76" r="2" fill="#222" stroke="none" />
          <path d="M122 74 Q127 71 132 74" strokeWidth="2.2" />
        </g>
        {/* 귀여운 다크서클 */}
        <path d="M121 80 Q127 88 133 80 Q127 84 121 80Z" fill="#9a86c4" stroke="#7a68a8" strokeWidth="1.4" />
        <path d="M123 85 Q127 88 131 85" stroke="#7a68a8" strokeWidth="1.4" opacity="0.8" />
        {/* 입 */}
        <path d="M128 88 Q131 90 135 87" strokeWidth="2" />
        {/* 이마 땀방울 */}
        <path className="cheer-sweat" d="M106 68 Q102 74 106 78 Q110 74 106 68Z" fill="#9ed8f5" stroke="#4a9ccb" strokeWidth="1.6" />
      </g>

      {/* 졸려서 떠오르는 z */}
      <g className="cheer-zz" fill="#222" stroke="none" fontSize="15" fontWeight="700">
        <text x="138" y="56">z</text>
        <text className="z2" x="146" y="46" fontSize="19">Z</text>
      </g>

      {/* 먼 쪽 팔(조금 연하게) */}
      <g className="cheer-arm b" stroke="#555">
        <path d="M117 104 L138 126 L171 135" />
        <circle cx="174" cy="135" r="3.4" fill="#fcfcfa" strokeWidth="2.2" />
      </g>
      {/* 가까운 쪽 팔 */}
      <g className="cheer-arm a">
        <path d="M118 100 L141 128 L166 133" />
        <circle cx="169" cy="132" r="3.6" fill="#fcfcfa" strokeWidth="2.2" />
      </g>

      {/* 노트북: 화면 + 코드 */}
      <path d="M180 86 H254 V132 H180Z" fill="#eef6fb" />
      <g className="cheer-code" strokeWidth="2.2">
        <path pathLength="1" d="M188 96 H214" stroke="#4a9ccb" style={{ animationDelay: '0s' }} />
        <path pathLength="1" d="M194 104 H234" stroke="#e8a24a" style={{ animationDelay: '0.7s' }} />
        <path pathLength="1" d="M194 112 H222" stroke="#79b87a" style={{ animationDelay: '1.4s' }} />
        <path pathLength="1" d="M188 120 H240" stroke="#9a86c4" style={{ animationDelay: '2.1s' }} />
      </g>
      <rect className="cheer-cursor" x="244" y="116" width="4" height="9" fill="#222" stroke="none" />
      <path d="M170 136 H262 L266 143 H166Z" fill="#fcfcfa" />
      <path d="M176 139.5 H256" strokeWidth="1.4" strokeDasharray="3 3" />

      {/* 타자 소리 */}
      <g className="cheer-tak" fill="#222" stroke="none" fontSize="13" fontWeight="700">
        <text x="160" y="124">탁</text>
        <text className="t2" x="170" y="118">딱</text>
      </g>

      {/* 커피 */}
      <g>
        <path d="M276 123 V140 Q276 143 280 143 H292 Q296 143 296 140 V123Z" fill="#fff" />
        <path d="M277 123 Q286 119 295 123 V127 H277Z" fill="#8a5a3c" stroke="#222" strokeWidth="1.6" />
        <path d="M296 127 Q305 129 296 137" />
        <path d="M284 131 q2 -3 4 0 q-2 4 -4 0" strokeWidth="1.4" stroke="#e5533d" />
        {/* 김 */}
        <g className="cheer-steam" stroke="#8a8a8a" strokeWidth="2">
          <path d="M282 114 Q278 106 283 100 Q288 94 283 88" />
          <path className="s2" d="M290 114 Q286 107 291 101 Q296 95 291 90" />
          <path className="s3" d="M286 112 Q283 106 287 101" />
        </g>
      </g>
    </svg>
  )
}
