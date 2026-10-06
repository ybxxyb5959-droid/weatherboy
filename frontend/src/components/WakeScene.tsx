// 로딩 화면 그림: 잠든 서버를 졸라맨이 깨우는 장면. 8초 한 바퀴를 돌며 반복한다.
// 콕콕 찌르기 -> 알람시계를 울리며 흔들기 -> 서버가 눈을 번쩍 뜨고 하품 -> 불이 켜지고 만세 -> 다시 졸기
// 움직임은 motion.css 의 .ws-* 가 맡는다("움직임 줄이기"에서는 잠든 모습으로 가만히 있는다).

export default function WakeScene({ size = 240 }: { size?: number }) {
  return (
    <svg className="doodle wake-scene" width={size} height={size * 0.73} viewBox="0 0 220 160" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" overflow="visible" aria-hidden="true">
      <path d="M6 142 H214" strokeWidth="2" opacity="0.45" />

      {/* 졸라맨 */}
      <g className="ws-man">
        <circle cx="62" cy="46" r="16" fill="var(--paper)" />
        <g stroke="none" fill="var(--ink)">
          <circle cx="56.5" cy="45" r="1.8" />
          <circle cx="67.5" cy="45" r="1.8" />
        </g>
        <path d="M57 52 Q62 56 67 52" strokeWidth="2" />
        <path d="M62 62 L62 104 M62 104 L50 138 M62 104 L76 138" />
        {/* 왼팔: 알람시계를 들고 있다 */}
        <path d="M62 72 L44 90" />
        <g className="ws-clock" style={{ transformOrigin: '38px 94px' }}>
          <circle cx="38" cy="95" r="9" fill="var(--paper)" strokeWidth="2.2" />
          <path d="M38 95 V89 M38 95 L42 97" strokeWidth="1.8" />
          <path d="M31 87 L28 83 M45 87 L48 83" strokeWidth="2.2" />
          <path className="ws-ringlines" d="M24 92 l-6 -2 M24 99 l-7 2 M30 84 l-3 -6 M46 84 l3 -6 M52 92 l6 -2" strokeWidth="1.8" stroke="#e8a24a" />
        </g>
        {/* 오른팔: 서버를 콕콕 찌르고, 깨면 만세 */}
        <g className="ws-arm" style={{ transformOrigin: '62px 72px' }}>
          <path d="M62 72 L96 90" />
          <circle cx="99" cy="91.5" r="3.4" fill="var(--paper)" strokeWidth="2.2" />
        </g>
        <path className="ws-bang" style={{ transformOrigin: '86px 22px' }} d="M86 8 V22 M86 29 l.1 0" strokeWidth="3.2" stroke="#e05a5a" />
      </g>

      {/* 서버 */}
      <g className="ws-server" style={{ transformOrigin: '144px 140px' }}>
        <g className="ws-breathe" style={{ transformOrigin: '144px 140px' }}>
          <path d="M120 140 v-4 M168 140 v-4" />
          <rect x="112" y="64" width="64" height="72" rx="8" fill="var(--paper)" />
          <path d="M122 74 H146 M122 126 H146" strokeWidth="2.2" />
          <circle className="ws-led ws-l1" cx="158" cy="74" r="2.6" strokeWidth="1.6" />
          <circle className="ws-led ws-l2" cx="166" cy="74" r="2.6" strokeWidth="1.6" />
          <circle className="ws-led ws-l3" cx="166" cy="126" r="2.6" strokeWidth="1.6" />
          {/* 얼굴: 자는 눈 -> 번쩍 뜬 눈, 하품 */}
          <g className="ws-eyes-closed">
            <path d="M126 98 Q132 103 138 98 M150 98 Q156 103 162 98" strokeWidth="2.2" />
          </g>
          <g className="ws-eyes-open" style={{ transformOrigin: '144px 97px' }}>
            <circle cx="132" cy="97" r="4.2" fill="var(--paper)" strokeWidth="2" />
            <circle cx="156" cy="97" r="4.2" fill="var(--paper)" strokeWidth="2" />
            <g stroke="none" fill="var(--ink)">
              <circle cx="132.6" cy="97.6" r="1.8" />
              <circle cx="155.4" cy="97.6" r="1.8" />
            </g>
          </g>
          <path className="ws-mouth" d="M139 109 Q144 112 149 109" strokeWidth="2" />
          <ellipse className="ws-yawn" style={{ transformOrigin: '144px 109px' }} cx="144" cy="109" rx="4.2" ry="5.2" fill="var(--ink)" strokeWidth="1.6" />
        </g>
      </g>

      {/* 자는 숨: Z */}
      <g className="ws-zs" strokeWidth="2.2">
        <path className="ws-z ws-z1" d="M168 52 h8 l-8 9 h8" />
        <path className="ws-z ws-z2" d="M178 40 h10 l-10 11 h10" />
        <path className="ws-z ws-z3" d="M190 24 h12 l-12 13 h12" />
      </g>

      {/* 깨어난 반짝임 */}
      <path className="ws-spark" d="M112 58 l-6 -6 M144 54 v-9 M176 58 l6 -6 M104 74 l-8 0 M184 74 l8 0" stroke="#e8a24a" strokeWidth="2.2" />
    </svg>
  )
}
