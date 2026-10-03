/**
 * 개발자 응원하기 그림(대각선 구도): 비스듬한 책상 건너편에서 졸라맨이 이쪽을 비스듬히 보며 노트북을 두드리고,
 * 14초마다 팔을 뻗어 커피를 들어 한 모금 마신다(마실 때 눈은 ^ ^). 얼굴은 앱의 졸라맨과 같고 눈 밑에 찍찍 그은 다크서클만 더했다.
 *
 * 좌표는 책상 모서리를 기준으로 한 등각 투영(iso)으로 계산한다: u = 오른쪽 앞으로, v = 오른쪽 뒤로, h = 위로.
 * 커피 마시는 동작은 SMIL(<animate>)로 팔/커피잔/눈을 같은 시간표로 움직여 어긋나지 않게 했다.
 */
const O = { x: 48, y: 196 }
const P = (u: number, v: number, h = 0): [number, number] => [O.x + 0.96 * u + 0.94 * v, O.y + 0.27 * u - 0.34 * v - h]
const pts = (...a: [number, number][]) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
const line = (a: [number, number], b: [number, number]) => `M${a[0].toFixed(1)} ${a[1].toFixed(1)} L${b[0].toFixed(1)} ${b[1].toFixed(1)}`

// 책상(윗면 높이 68): 가로 u 125, 세로 v 140
const DESK_H = 68
const deskTop = pts(P(0, 0, DESK_H), P(125, 0, DESK_H), P(125, 140, DESK_H), P(0, 140, DESK_H))
const deskFrontLeft = pts(P(0, 0, DESK_H), P(125, 0, DESK_H), P(125, 0, DESK_H - 7), P(0, 0, DESK_H - 7))
const deskFrontRight = pts(P(125, 0, DESK_H), P(125, 140, DESK_H), P(125, 140, DESK_H - 7), P(125, 0, DESK_H - 7))
const leg = (u: number, v: number) => line(P(u, v, DESK_H - 7), P(u, v, 0))

// 노트북: 상판 뒷면이 보인다(화면은 건너편 졸라맨을 향함). 바닥 변 A-B, 위쪽 변 D-C
const lidA = P(28, 105, DESK_H)
const lidB = P(96, 105, DESK_H)
const lidC = P(96, 95, DESK_H + 38)
const lidD = P(28, 95, DESK_H + 38)
/** 상판 위의 점: s 는 왼쪽->오른쪽(0~1), t 는 아래->위(0~1) */
const lid = (s: number, t: number): [number, number] => [
  lidA[0] + s * (lidB[0] - lidA[0]) + t * (lidD[0] - lidA[0]),
  lidA[1] + s * (lidB[1] - lidA[1]) + t * (lidD[1] - lidA[1]),
]
const lidPoly = pts(lidA, lidB, lidC, lidD)
const deck = pts(P(28, 105, DESK_H), P(96, 105, DESK_H), P(96, 136, DESK_H), P(28, 136, DESK_H))
const star = lid(0.3, 0.52)
const face = lid(0.64, 0.32)
const note = lid(0.5, 0.2)

// 커피 마시는 시간표(14초 반복): 키보드 -> 커피 쪽으로 -> 입 -> 한 모금 -> 내려놓기 -> 다시 키보드
const KEY_TIMES = '0;0.5714;0.6357;0.7071;0.75;0.7714;0.8143;0.8857;0.9286;1'
const DUR = '14s'
// 오른쪽 팔(그림 기준 오른쪽, 졸라맨의 왼팔) 모양: 어깨 끝(291,100) -> 팔꿈치 -> 손
const arm = (ex: number, ey: number, hx: number, hy: number) => `M291 100 L${ex} ${ey} L${hx} ${hy}`
const ARM_TYPE = arm(293, 110, 270, 111)
const ARM_REACH = arm(288, 116, 266, 122)
const ARM_LIFT = arm(298, 91, 273, 81)
const H_TYPE = { x: 270, y: 111 }
const H_REACH = { x: 266, y: 122 }
const H_LIFT = { x: 273, y: 81 }
const seq = <T,>(a: T, b: T, c: T) => [a, a, b, c, c, c, c, b, a, a] // 키타임 10개에 맞춘 (타이핑, 뻗기, 입 앞) 순서
const armValues = seq(ARM_TYPE, ARM_REACH, ARM_LIFT).join(';')
const handX = seq(H_TYPE, H_REACH, H_LIFT).map((h) => h.x).join(';')
const handY = seq(H_TYPE, H_REACH, H_LIFT).map((h) => h.y).join(';')
// 커피잔: 책상 위 -> 입 앞(+7,-42) -> 한 모금 때 기울임 -> 제자리
const mugMove = '0 0;0 0;0 0;7 -42;7 -42;7 -42;7 -42;0 0;0 0;0 0'
const mugTilt = '0 252 115;0 252 115;0 252 115;0 252 115;-18 252 115;-18 252 115;0 252 115;0 252 115;0 252 115;0 252 115'
// 눈: 평소엔 점 두 개, 마시는 동안은 ^ ^ (기분 좋게)
const dotsOpacity = '1;1;1;1;0;0;1;1;1;1'
const happyOpacity = '0;0;0;0;1;1;0;0;0;0'
const steamOpacity = '1;1;1;0;0;0;0;1;1;1'

export default function CheerScene() {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const smil = (attr: string, values: string) => (reduced ? null : <animate attributeName={attr} dur={DUR} repeatCount="indefinite" keyTimes={KEY_TIMES} values={values} />)
  const lidTop = [lid(0.03, 0.96), lid(0.97, 0.96)]
  const glow = [lid(0.02, 0.985), lid(0.98, 0.985)]
  return (
    <svg
      className="doodle cheer-scene"
      viewBox="92 28 224 172"
      width="100%"
      fill="none"
      stroke="#222"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="비스듬한 책상에서 노트북을 두드리다 커피를 마시는 졸라맨"
    >
      {/* 밤 창문: 달과 반짝이는 별 */}
      <g transform="translate(100 14) scale(0.78)">
        <path d="M14 14 L78 14 L78 66 L14 66Z" fill="#26324d" strokeWidth="2.4" />
        <path d="M46 14 V66 M14 40 H78" strokeWidth="1.8" />
        <path d="M64 26 Q53 33 60 48 Q49 46 47 36 Q47 25 64 26Z" fill="#f6d44c" strokeWidth="1.6" />
        <g stroke="#f6e9a8" strokeWidth="1.6">
          <path className="cheer-star" d="M26 26 h6 M29 23 v6" />
          <path className="cheer-star s2" d="M66 56 h5 M68.5 53.5 v5" />
          <path className="cheer-star s3" d="M28 54 h5 M30.5 51.5 v5" />
        </g>
      </g>

      {/* 바닥 그림자 */}
      <ellipse cx="176" cy="196" rx="124" ry="17" fill="#222" stroke="none" opacity="0.07" />

      {/* 의자 등받이(졸라맨 뒤) */}
      <path d="M276 104 L276 62 Q290 56 304 62 L304 104Z" fill="#efdcb2" />

      {/* 졸라맨: 목, 티셔츠, 소매 */}
      <path d="M265 78 V84" />
      <path d="M252 78 L283 87 L283 122 L254 112Z" fill="#fff" />
      <path d="M252 78 L240 88 L245 98 L254 91Z" fill="#fff" />
      <path d="M283 87 L295 94 L291 104 L282 97Z" fill="#fff" />

      {/* 머리(꾸벅꾸벅): 얼굴은 앱의 졸라맨과 같다. 노트북 쪽(왼쪽 아래)을 향해 비스듬히 */}
      <g className="cheer-head">
        <path d="M263 40 C274 39 283 48 283 59 C283 70 274 79 263 79 C252 79 243 70 243 59 C243 48 252 41 263 40Z" fill="#fcfcfa" />
        <g className="cheer-eye">
          <g stroke="none" fill="#222">
            <circle cx="253.5" cy="62.5" r="2.3">{!reduced && <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" keyTimes={KEY_TIMES} values={dotsOpacity} />}</circle>
            <circle cx="266.5" cy="60.8" r="2.3">{!reduced && <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" keyTimes={KEY_TIMES} values={dotsOpacity} />}</circle>
          </g>
          {/* 한 모금 마실 때의 ^ ^ 눈 */}
          <g strokeWidth="2.2" opacity="0">
            {smil('opacity', happyOpacity)}
            <path d="M250 64 Q253.5 59.5 257 64" />
            <path d="M263 62.3 Q266.5 57.8 270 62.3" />
          </g>
        </g>
        {/* 웃는 입 */}
        <path d="M254.6 69.6 Q259.6 74.8 265.2 68.8" strokeWidth="2.2" />
        {/* 귀여운 다크서클: 눈 밑에 찍찍 그은 짧은 세로 선 */}
        <g stroke="#7a68a8" strokeWidth="1.7">
          <path d="M251.8 66.6 L251.4 70.6 M254.4 67 L254.2 71.6 M257 66.6 L257.4 70.4" />
          <path d="M264.6 64.8 L264.2 68.6 M267.2 65 L267.2 69.6 M269.8 64.6 L270.3 68.4" />
        </g>
        <path className="cheer-sweat" d="M282 52 Q277.5 58 282 62.5 Q286.5 58 282 52Z" fill="#9ed8f5" stroke="#4a9ccb" strokeWidth="1.6" />
      </g>

      {/* 졸다가 떠오르는 z */}
      <g className="cheer-zz" fill="#222" stroke="none" fontSize="15" fontWeight="700">
        <text x="288" y="40">z</text>
        <text className="z2" x="296" y="30" fontSize="19">Z</text>
      </g>

      {/* 책상: 비스듬히 놓인 윗면 + 앞면 두 개 + 다리 */}
      <polygon points={deskTop} fill="#fff" />
      <polygon points={deskFrontLeft} fill="#fff" />
      <polygon points={deskFrontRight} fill="#f1ecdc" />
      <path d={`${leg(4, 4)} ${leg(121, 4)} ${leg(121, 136)}`} />

      {/* 타이핑하는 팔(그림 왼쪽): 소매에서 노트북 뒤로 */}
      <g className="cheer-arm a">
        <path d="M242 94 L236 101 L222 104" />
      </g>

      {/* 노트북 본체(키보드 쪽)와 상판 */}
      <polygon points={deck} fill="#fcfcfa" />
      <g className="cheer-lid">
        <polygon points={lidPoly} fill="#e8e8e2" />
        {/* 윗면 두께와 새어 나오는 화면 불빛 */}
        <path d={line(lidTop[0], lidTop[1])} stroke="#fff" strokeWidth="2.2" />
        <path className="cheer-glow" d={line(glow[0], glow[1])} stroke="#9ed8f5" strokeWidth="2.4" />
        {/* 유리 반사 */}
        <path d={`${line(lid(0.1, 0.05), lid(0.42, 0.9))} ${line(lid(0.22, 0.05), lid(0.5, 0.75))}`} stroke="#fff" strokeWidth="2" opacity="0.65" />
        {/* 스티커 */}
        <path d={`M${star[0]} ${star[1] - 6} l2.2 4.6 5 .7 -3.6 3.5 .9 5 -4.5 -2.4 -4.5 2.4 .9 -5 -3.6 -3.5 5 -.7z`} fill="#f6d44c" strokeWidth="1.3" />
        <g>
          <circle cx={face[0]} cy={face[1]} r="5.4" fill="#ffd9a8" strokeWidth="1.4" />
          <path d={`M${face[0] - 1.9} ${face[1] - 1.4} h.1 M${face[0] + 1.9} ${face[1] - 1.6} h.1 M${face[0] - 1.8} ${face[1] + 1.8} q1.8 2 3.6 0`} strokeWidth="1.3" />
        </g>
        <path d={`M${note[0]} ${note[1]} l9 -1.4 -.8 7 -9 1.4z`} fill="#cfe9d4" strokeWidth="1.2" />
        <path d={`M${note[0] + 2} ${note[1] + 2.6} l5 -.8`} strokeWidth="1" />
      </g>
      {/* 전원 LED */}
      <circle className="cheer-led" cx={lidB[0] - 4} cy={lidB[1] - 3.4} r="1.7" fill="#79e08a" stroke="none" />

      {/* 커피잔 */}
      <g>
        {!reduced && <animateTransform attributeName="transform" type="translate" dur={DUR} repeatCount="indefinite" keyTimes={KEY_TIMES} values={mugMove} />}
        <g>
          {!reduced && <animateTransform attributeName="transform" type="rotate" additive="sum" dur={DUR} repeatCount="indefinite" keyTimes={KEY_TIMES} values={mugTilt} />}
          <g transform="translate(31 -20)">
            <path d="M221 135 V146 Q221 152 232 152 Q243 152 243 146 V135" fill="#fff" />
            <ellipse cx="232" cy="135" rx="11" ry="4" fill="#fff" />
            <ellipse cx="232" cy="135.5" rx="8.6" ry="2.8" fill="#8a5a3c" stroke="none" />
            <path d="M243 138 Q252 140 243 147" />
            <path d="M228 141 h.1 M236 141 h.1 M229.5 144.5 q2.5 2.5 5 0" strokeWidth="1.6" />
            <g className="cheer-steam" stroke="#8a8a8a" strokeWidth="2">
              {/* 마시는 동안은 김이 얼굴을 가리지 않게 숨긴다 */}
              {smil('opacity', steamOpacity)}
              <path d="M228 126 Q224 118 229 112 Q234 106 229 100" />
              <path className="s2" d="M236 126 Q232 119 237 113 Q242 107 237 102" />
              <path className="s3" d="M232 124 Q229 118 233 113" />
            </g>
          </g>
        </g>
      </g>

      {/* 커피 마시는 팔(그림 오른쪽): 타이핑 -> 커피 쪽으로 -> 입 앞에서 한 모금 -> 내려놓고 다시 타이핑 */}
      <g className="cheer-arm b">
        <path d={ARM_TYPE}>{smil('d', armValues)}</path>
        <circle cx={H_TYPE.x} cy={H_TYPE.y} r="3.6" fill="#fcfcfa" strokeWidth="2.2">
          {smil('cx', handX)}
          {smil('cy', handY)}
        </circle>
      </g>

      {/* 노트북에서 올라오는 코드 기호 */}
      <g className="cheer-glyph" fill="#4a9ccb" stroke="none" fontSize="15" fontWeight="700">
        <text x="144" y="66">{'{ }'}</text>
        <text className="g2" x="206" y="52" fill="#e8a24a">{'</>'}</text>
        <text className="g3" x="172" y="48" fill="#79b87a">{';'}</text>
      </g>

      {/* 타자 소리 */}
      <g className="cheer-tak" fill="#222" stroke="none" fontSize="13" fontWeight="700">
        <text x="236" y="126">탁</text>
        <text className="t2" x="150" y="108">딱</text>
      </g>
    </svg>
  )
}
