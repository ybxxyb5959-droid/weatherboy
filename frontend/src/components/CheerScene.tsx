/**
 * 개발자 응원하기 그림: 밤늦게 책상에 앉아 노트북을 두드리는 졸라맨을 비스듬히(대각선 앞쪽에서) 바라보는 구도.
 * 얼굴은 앱의 졸라맨과 같다(점 눈 두 개 + 웃는 입). 졸려서 눈 밑에 살짝 다크서클만 더했다.
 * 움직임(CSS 는 styles/cheer.css 의 .cheer-*): 두 팔의 타이핑, "탁/딱", 꾸벅 졸다 번쩍 깨는 고개, 눈 깜빡,
 * 땀방울, 떠오르는 z, 노트북에서 올라오는 코드 기호, 커피 김, 반짝이는 별.
 */
export default function CheerScene() {
  return (
    <svg
      className="doodle cheer-scene"
      viewBox="28 34 272 184"
      width="100%"
      fill="none"
      stroke="#222"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="밤늦게 책상에서 노트북을 두드리는 졸라맨과 커피 한 잔"
    >
      {/* 밤 창문: 달과 반짝이는 별 */}
      <g transform="translate(26 24)">
        <path d="M14 14 L78 14 L78 66 L14 66Z" fill="#26324d" strokeWidth="2.4" />
        <path d="M46 14 V66 M14 40 H78" strokeWidth="1.8" />
        <path d="M64 26 Q53 33 60 48 Q49 46 47 36 Q47 25 64 26Z" fill="#f6d44c" strokeWidth="1.6" />
        <g stroke="#f6e9a8" strokeWidth="1.6">
          <path className="cheer-star" d="M26 26 h6 M29 23 v6" />
          <path className="cheer-star s2" d="M66 56 h5 M68.5 53.5 v5" />
          <path className="cheer-star s3" d="M28 54 h5 M30.5 51.5 v5" />
        </g>
      </g>

      {/* 바닥 */}
      <path d="M8 210 H312" strokeWidth="2.2" />
      <path d="M60 217 H250" strokeWidth="1.6" strokeDasharray="3 6" opacity="0.5" />

      {/* 책상 뒤쪽 다리(멀어서 연하게) */}
      <path d="M282 142 V198" stroke="#777" strokeWidth="2.2" />

      {/* 의자 등받이(졸라맨 뒤) */}
      <path d="M130 101 Q150 94 170 101 L172 141 Q150 147 128 141Z" fill="#efdcb2" />

      {/* 졸라맨: 티셔츠 */}
      <path d="M150 96 V103" />
      <path d="M136 104 L122 115 L129 124 L136 119 V136 H164 V119 L171 124 L178 115 L164 104 Q150 111 136 104Z" fill="#fff" />

      {/* 머리(꾸벅꾸벅): 앱의 졸라맨과 같은 얼굴 */}
      <g className="cheer-head">
        <path d="M150 56 C161 55 170 64 170 76 C170 88 161 98 150 98 C139 98 130 88 130 76 C130 64 139 56 150 56Z" fill="#fcfcfa" />
        <g className="cheer-eye" stroke="none" fill="#222">
          <circle cx="142" cy="76" r="2.3" />
          <circle cx="157" cy="75.5" r="2.3" />
        </g>
        {/* 웃는 입 */}
        <path d="M145.4 83.6 Q150 88.8 154.6 83.2" strokeWidth="2.2" />
        {/* 귀여운 다크서클: 눈 밑에 찍찍 그은 짧은 세로 선 */}
        <g stroke="#7a68a8" strokeWidth="1.7">
          <path d="M139.6 80.5 L139.1 84.6 M142.2 81 L142 85.8 M144.8 80.5 L145.2 84.4" />
          <path d="M154.8 80 L154.4 84 M157.4 80.5 L157.4 85.3 M160 80 L160.5 83.9" />
        </g>
        {/* 이마 땀방울 */}
        <path className="cheer-sweat" d="M171 62 Q166.5 68 171 72.5 Q175.5 68 171 62Z" fill="#9ed8f5" stroke="#4a9ccb" strokeWidth="1.6" />
      </g>

      {/* 졸다가 떠오르는 z */}
      <g className="cheer-zz" fill="#222" stroke="none" fontSize="15" fontWeight="700">
        <text x="176" y="52">z</text>
        <text className="z2" x="184" y="42" fontSize="19">Z</text>
      </g>

      {/* 책상: 비스듬히 보이는 윗면 + 앞면 + 옆면 */}
      <path d="M30 152 L250 152 L292 128 L72 128Z" fill="#fff" />
      <path d="M30 152 H250 V166 H30Z" fill="#fff" />
      <path d="M250 152 L292 128 V142 L250 166Z" fill="#f1ecdc" />
      <path d="M38 166 V210 M242 166 V210" />

      {/* 노트북 화면에서 새어 나와 턱에 비치는 불빛 */}
      <ellipse className="cheer-glow" cx="150" cy="100" rx="19" ry="5" fill="#bfe4ff" stroke="none" />

      {/* 노트북: 졸라맨을 향한 화면의 뒷면이 보인다. 타이핑할 때 상판이 살짝 떨린다 */}
      <g className="cheer-lid">
        {/* 상판(둥근 모서리) */}
        <path d="M118 118 Q117 113 122 112.5 L178 107 Q183.5 106.5 183.5 112 L185 134 Q185 139 180 139.6 L124 144.5 Q119.5 145 119.2 140.5Z" fill="#e8e8e2" />
        {/* 윗면 두께와 새어 나오는 화면 불빛 */}
        <path d="M123 114 L178 109" stroke="#fff" strokeWidth="2.2" />
        <path className="cheer-glow" d="M122 112.4 L178 107.2" stroke="#9ed8f5" strokeWidth="2.2" />
        {/* 유리 반사 */}
        <path d="M128 140 L146 112 M138 139 L152 117" stroke="#fff" strokeWidth="2" opacity="0.65" />
        {/* 스티커들 */}
        <path d="M141 117 l2.2 4.6 5 .7 -3.6 3.5 .9 5 -4.5 -2.4 -4.5 2.4 .9 -5 -3.6 -3.5 5 -.7z" fill="#f6d44c" strokeWidth="1.3" />
        <g>
          <circle cx="168" cy="127" r="5" fill="#ffd9a8" strokeWidth="1.4" />
          <path d="M166.2 125.6 h.1 M170 125.4 h.1 M166.4 128.6 q1.6 1.8 3.2 0" strokeWidth="1.3" />
        </g>
        <path d="M156 133 l9 -1 -.6 6 -9 1z" fill="#cfe9d4" strokeWidth="1.2" />
        <path d="M158 135 l5 -.6" strokeWidth="1" />
      </g>

      {/* 힌지(경첩) */}
      <path d="M124 141.5 Q124 138.5 128 138.2 L134 137.8 Q137 138 137 141 Z" fill="#cfcfc8" strokeWidth="1.5" />
      <path d="M168 137.3 Q168 134.5 172 134.2 L178 133.8 Q181 134 181 137 Z" fill="#cfcfc8" strokeWidth="1.5" />

      {/* 본체(키보드 쪽 두꺼운 면) */}
      <path d="M113 144 L188 137.4 Q196 136.8 199 142 Q200.5 147 195 148.6 L120 152 Q112 152.4 111 148Z" fill="#fcfcfa" />
      <path d="M115 148.4 L194 144.8" strokeWidth="1.3" strokeDasharray="4 3" />
      {/* 전원 LED */}
      <circle className="cheer-led" cx="192.6" cy="141.4" r="1.6" fill="#79e08a" stroke="none" />

      {/* 두 팔의 손이 노트북 양옆에서 키보드를 두드린다 */}
      <g className="cheer-arm a" stroke="#222">
        <path d="M126 119 L110 141" />
        <circle cx="107.5" cy="144" r="3.6" fill="#fcfcfa" strokeWidth="2.2" />
      </g>
      <g className="cheer-arm b" stroke="#222">
        <path d="M174 119 L196 136" />
        <circle cx="199" cy="139" r="3.6" fill="#fcfcfa" strokeWidth="2.2" />
      </g>

      {/* 노트북에서 올라오는 코드 기호 */}
      <g className="cheer-glyph" fill="#4a9ccb" stroke="none" fontSize="15" fontWeight="700">
        <text x="96" y="104">{'{ }'}</text>
        <text className="g2" x="194" y="100" fill="#e8a24a">{'</>'}</text>
        <text className="g3" x="204" y="116" fill="#79b87a">{';'}</text>
      </g>

      {/* 타자 소리 */}
      <g className="cheer-tak" fill="#222" stroke="none" fontSize="13" fontWeight="700">
        <text x="86" y="140">탁</text>
        <text className="t2" x="206" y="136">딱</text>
      </g>

      {/* 커피(위에서 비스듬히 보여서 커피 수면이 보인다) */}
      <g>
        <path d="M221 135 V146 Q221 152 232 152 Q243 152 243 146 V135" fill="#fff" />
        <ellipse cx="232" cy="135" rx="11" ry="4" fill="#fff" />
        <ellipse cx="232" cy="135.5" rx="8.6" ry="2.8" fill="#8a5a3c" stroke="none" />
        <path d="M243 138 Q252 140 243 147" />
        <path d="M228 141 h.1 M236 141 h.1 M229.5 144.5 q2.5 2.5 5 0" strokeWidth="1.6" />
        {/* 김 */}
        <g className="cheer-steam" stroke="#8a8a8a" strokeWidth="2">
          <path d="M228 126 Q224 118 229 112 Q234 106 229 100" />
          <path className="s2" d="M236 126 Q232 119 237 113 Q242 107 237 102" />
          <path className="s3" d="M232 124 Q229 118 233 113" />
        </g>
      </g>
    </svg>
  )
}
