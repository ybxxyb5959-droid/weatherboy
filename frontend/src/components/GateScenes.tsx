// 위치/알림 허용 화면의 낙서 그림: 상반신만 나온 졸라맨이 ':/' 표정으로 서 있고, 지도(위치)나 휴대폰·종(알림)이 같이 있다.
const common = {
  className: 'doodle gate-scene',
  viewBox: '0 0 260 190',
  fill: 'none',
  stroke: '#222',
  strokeWidth: 2.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** 서 있는 상반신 졸라맨 (머리, 얼굴, 몸통). face: ':/' 시큰둥한 표정 / 웃는 표정. 아래는 그림 밖으로 잘린다. */
function Upper({ face, x = 0 }: { face: 'meh' | 'smile'; x?: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <path d="M36 66 C36 48 50 40 62 41 C76 42 86 54 84 70 C82 86 68 94 56 92 C42 91 36 80 36 66Z" fill="#fcfcfa" />
      <circle cx="52" cy="64" r="1.9" fill="#222" stroke="none" />
      <circle cx="68" cy="63" r="1.9" fill="#222" stroke="none" />
      {face === 'meh' ? <path d="M52 77 L67 74" strokeWidth="2" /> : <path d="M50 72 Q60 84 70 71" strokeWidth="2" />}
      <path d="M60 92 L60 140" />
    </g>
  )
}

/** 위치: 졸라맨이 두 손으로 지도를 펼쳐 가슴 앞에 들고 있다(접힌 자국이 있는 큰 지도). 뒤로 길이 그려져 있다 */
export function MapScene({ width = 260 }: { width?: number }) {
  return (
    <svg {...common} width={width} height={(width * 190) / 260} role="img" aria-label="지도를 펼쳐 든 졸라맨">
      {/* 뒤쪽 거리: 삐뚤빼뚤한 길 */}
      <path d="M176 8 Q173 34 175 62 M204 6 Q202 32 204 58 M232 10 Q230 32 231 56" />
      <path d="M164 66 Q200 61 250 64 M168 98 Q206 94 252 97" />
      <path d="M186 98 Q184 126 186 160 M218 96 Q216 122 218 156" />
      <path d="M8 40 L8 72 M8 72 L34 70 M8 108 Q20 106 30 108" />
      <Upper face="meh" x={36} />
      {/* 팔: 어깨에서 양옆으로 나가 지도 양쪽 끝을 잡는다 */}
      <path d="M96 108 Q70 110 50 128" />
      <path d="M96 108 Q122 108 148 126" />
      {/* 펼친 지도: 위아래가 지그재그로 접힌 자국 */}
      <path d="M46 128 L74 122 L98 130 L124 120 L152 127 L156 180 L128 188 L100 180 L74 188 L50 181Z" fill="#f4ecc8" />
      <path d="M74 122 L74 188 M124 120 L128 188" strokeWidth="1.5" />
      <path d="M56 146 Q64 140 70 150 M84 160 Q94 152 104 160 M134 140 Q142 146 148 138 M132 166 Q142 160 150 168" strokeWidth="1.4" />
      {/* 위치 핀 */}
      <path d="M101 168 C89 154 91 142 101 142 C111 142 113 154 101 168Z" fill="#e8735a" strokeWidth="2" />
      <circle cx="101" cy="151" r="2.3" fill="#fcfcfa" stroke="none" />
      {/* 손 */}
      <circle cx="48" cy="130" r="4.3" fill="#fcfcfa" strokeWidth="2.1" />
      <circle cx="152" cy="128" r="4.3" fill="#fcfcfa" strokeWidth="2.1" />
    </svg>
  )
}

/** 알림: 웃는 졸라맨이 신나게 두 팔을 들고 있고, 옆에서 큰 종이 울리며 알림 카드가 떠 있다 */
export function BellScene({ width = 260 }: { width?: number }) {
  return (
    <svg {...common} width={width} height={(width * 190) / 260} role="img" aria-label="웃는 졸라맨과 울리는 종">
      {/* 큰 종과 울림 표시 */}
      <path d="M180 30 V22" />
      <path d="M180 30 C158 32 154 60 152 82 L142 100 H218 L208 82 C206 60 202 32 180 30Z" fill="#f6d44c" />
      <path d="M170 104 Q180 118 190 104" />
      <path d="M140 56 L130 48 M146 38 L140 28 M222 56 L232 48 M216 38 L222 28" strokeWidth="2" />
      {/* 떠 있는 알림 카드 */}
      <path d="M136 128 L228 122 L232 158 L140 164Z" fill="#fcfcfa" />
      <path d="M150 140 L208 136 M151 150 L190 147" strokeWidth="1.8" />
      <circle cx="217" cy="134" r="3.4" fill="#e8735a" stroke="none" />
      <Upper face="smile" />
      {/* 신나서 두 팔을 번쩍 */}
      <path d="M60 108 L34 84" />
      <path d="M60 108 L88 80" />
      <circle cx="32" cy="82" r="4.3" fill="#fcfcfa" strokeWidth="2.1" />
      <circle cx="90" cy="78" r="4.3" fill="#fcfcfa" strokeWidth="2.1" />
      <path d="M22 66 L28 72 M96 62 L90 70" strokeWidth="1.8" />
    </svg>
  )
}
