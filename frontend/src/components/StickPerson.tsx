import { ClothingArt } from './ClothingDoodle'

export type Mood = 'wave' | 'cold' | 'rain' | 'trip' | 'empty' | 'wait' | 'stand' | 'travel' | 'camp' | 'hike' | 'outdoor'

export interface WornItem {
  type: string
  color: string
  pattern?: string
}

interface Props {
  mood?: Mood
  size?: number
  /** mood='stand' 일 때 캐릭터가 입는 추천 옷 */
  wear?: { top?: WornItem; bottom?: WornItem; outer?: WornItem }
  /** mood='stand' 일 때 우산을 들고 서 있기 */
  umbrella?: boolean
}

const ink = '#222'

export default function StickPerson({ mood = 'wave', size = 140, wear, umbrella = false }: Props) {
  const showUmbrella = mood === 'rain' || (mood === 'stand' && umbrella)
  const shift = showUmbrella ? 'translate(-12 22)' : mood === 'camp' ? 'translate(-14 8)' : mood === 'outdoor' ? 'translate(-4 28)' : 'translate(10 0)'
  return (
    <svg
      className="doodle"
      width={size}
      height={size * 1.15}
      viewBox="0 0 140 160"
      fill="none"
      stroke={ink}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {showUmbrella && (
        <g transform={mood === 'stand' ? 'translate(-18 0)' : undefined}>
          <path d="M42 36 Q92 -18 130 36 Q120 29 111 36 Q101 29 92 36 Q82 29 73 36 Q63 29 42 36Z" fill="#cfe6e2" />
          {/* 서 있을 땐 팔을 내린 채 손으로 우산대를 잡는다 */}
          {mood === 'stand' ? <path d="M86 36 L86 112 M86 112 C86 119 94 119 94 113" /> : <path d="M86 36 L86 78" />}
          <path d="M12 56 l-3 9 M24 80 l-3 9 M120 70 l-3 9 M130 100 l-3 9" strokeWidth="2" stroke="#4aa6a0" />
        </g>
      )}
      {mood === 'hike' && (
        <g>
          {/* 산: 큰 봉우리에 눈 덮인 꼭대기와 깃발, 작은 봉우리 */}
          <path d="M40 138 L88 66 L112 100 L124 84 L146 138Z" fill="#cfe6e2" />
          <path d="M78 82 L88 66 L98 82 L92 79 L88 85 L83 79Z" fill="#fcfcfa" strokeWidth="1.8" />
          <path d="M88 66 V52 M88 52 L102 57 L88 62" strokeWidth="2" />
          <path d="M104 100 L112 90 L120 100" strokeWidth="1.6" />
        </g>
      )}
      {mood === 'outdoor' && (
        <g>
          {/* 나무와 해 */}
          <path d="M20 66 V130" strokeWidth="3" />
          <path d="M20 48 C4 46 2 70 18 68 C30 76 42 62 34 52 C36 40 26 38 20 48Z" fill="#9fd1a0" />
          <circle cx="116" cy="22" r="8" fill="#f2cf4a" />
          <path d="M116 6 V10 M116 34 V38 M100 22 H104 M128 22 H132 M104 10 L107 13 M128 10 L125 13" strokeWidth="1.8" />
        </g>
      )}
      <g transform={shift}>
        {/* 몸 */}
        <path d="M60 47 L61 100" />
        {mood === 'stand' ? (
          <path d="M60 100 L53 138 M60 100 L67 138" />
        ) : mood === 'travel' || mood === 'hike' ? (
          <path d="M61 100 L48 136 M61 100 L72 134" />
        ) : mood === 'outdoor' ? (
          // 돗자리에 앉아 무릎을 세운다
          <path d="M61 100 L80 86 L92 100" />
        ) : mood === 'camp' ? (
          // 통나무에 걸터앉아 무릎을 접고 불 쪽으로 발을 뻗는다
          <path d="M61 100 L84 102 L84 130" />
        ) : (
          <path d="M61 100 L44 136 M61 100 L80 133" />
        )}
        {/* 머리 */}
        <path d="M60 13 C75 11 79 28 75 37 C70 49 50 48 45 37 C41 27 46 14 61 12 L67 15" />
        {mood === 'stand' ? (
          // 오늘 추천: 후기 카드의 '딱 좋아요' 얼굴과 같다 (동그란 눈 + 활짝 웃는 입)
          <g>
            <g stroke="none">
              <circle cx="53" cy="27.7" r="2.6" fill={ink} />
              <circle cx="67" cy="27.7" r="2.6" fill={ink} />
            </g>
            <path d="M49.6 35.5 Q60 47.2 70.4 35.5 Z" fill="#fcfcfa" strokeWidth="1.8" />
          </g>
        ) : (
          <>
            {/* 얼굴: 작고 동그란 점 눈 + 작은 미소(양 끝에 보조개 점) */}
            <g stroke="none">
              <circle cx="53.5" cy="30" r="1.9" fill={ink} />
              <circle cx="66.5" cy="29.5" r="1.9" fill={ink} />
            </g>
            {mood !== 'empty' && <path d="M56.5 36.5 Q60.5 40 64.5 36" strokeWidth="2" />}
          </>
        )}

        {mood === 'hike' && (
          <g>
            {/* 가방은 몸 한쪽 뒤로, 한 손엔 등산 스틱 */}
            <path d="M35 64 Q35 55 44 55 L58 55 L58 102 L44 102 Q35 102 35 94Z" fill="#e8a24a" />
            <path d="M43 55 Q47 48 53 55" strokeWidth="2" />
            <path d="M35 86 H58 M42 86 V98" strokeWidth="1.6" />
            <path d="M55 57 C67 62 69 78 61 96" stroke="#8a5a2a" strokeWidth="3.6" />
            <path d="M60 58 L84 80" />
            <path d="M60 58 L46 86" />
            <path d="M82 70 L90 138" strokeWidth="3" />
            <path d="M84 78 L80 74" strokeWidth="2" />
            {/* 챙 넓은 모자 */}
            <path d="M42 22 Q60 -2 78 22 Q60 28 42 22Z" fill="#6b8f5e" />
            <path d="M38 22 Q60 30 82 22" strokeWidth="2.4" />
          </g>
        )}

        {mood === 'outdoor' && (
          <g>
            {/* 야구모자와 도시락 바구니 쪽으로 뻗은 손 */}
            <path d="M46 20 Q60 4 76 18 L88 22 L46 24Z" fill="#4a8bd4" />
            <path d="M60 58 L84 82" />
            <path d="M60 58 L50 84" />
          </g>
        )}

        {mood === 'travel' && (
          <g>
            {/* 선글라스 */}
            <path d="M47 27 C47 25 58 25 58 27 C58 33 48 34 47 27Z M62 27 C62 25 73 25 73 27 C72 34 63 33 62 27Z" fill={ink} strokeWidth="1.6" />
            <path d="M58 27 Q60 25.5 62 27 M47 27 L44 25 M73 27 L76 25" strokeWidth="1.6" />
            {/* 한 팔은 캐리어 손잡이, 한 팔은 흔들며 */}
            <path d="M60 58 L90 88" />
            <path d="M60 58 L42 82" />
            {/* 캐리어 */}
            <path d="M90 88 L90 100" strokeWidth="2.2" />
            <path d="M78 100 L102 100 L102 134 L78 134Z" fill="#e8a24a" />
            <path d="M84 100 L84 134 M96 100 L96 134" strokeWidth="1.6" />
            <path d="M85 100 V96 H95 V100" strokeWidth="1.8" />
            <path d="M82 137 l.1 0 M98 137 l.1 0" strokeWidth="3.4" />
          </g>
        )}

        {mood === 'camp' && (
          <g>
            {/* 앉은 자리: 통나무, 불쪽으로 내민 손, 무릎 위의 손 */}
            <path d="M40 108 L90 108" strokeWidth="3.4" />
            <path d="M60 58 L84 78" />
            <path d="M60 58 L52 84 L70 98" />
          </g>
        )}

        {mood === 'stand' && (
          <g>
            {/* 팔은 내리고 가만히 서 있다. 우산이 필요하면 오른팔로 우산대를 잡는다. */}
            <path d="M60 58 L45 92" />
            <path d={umbrella ? 'M60 58 L80 92' : 'M60 58 L75 92'} />
            {/* 추천 옷 입히기: 하의 -> 상의 -> 겉옷 순으로 덧그린다 */}
            {wear?.bottom && (
              <g transform="translate(35 86) scale(0.5)" strokeWidth="3.6">
                <ClothingArt type={wear.bottom.type} color={wear.bottom.color} pattern={wear.bottom.pattern} />
              </g>
            )}
            {wear?.top && (
              <>
                {/* 겉옷을 입으면 상의는 몸통만 보이게 한다: 반팔 소매가 겉옷 소매 밖으로 삐져나와 겹쳐 보이지 않도록 */}
                <clipPath id="wb-top-torso">
                  <rect x="29" y="0" width="42" height="100" />
                </clipPath>
                <g transform="translate(27.5 39.6) scale(0.65)" strokeWidth="3.4" clipPath={wear?.outer ? 'url(#wb-top-torso)' : undefined}>
                  <ClothingArt type={wear.top.type} color={wear.top.color} pattern={wear.top.pattern} />
                </g>
              </>
            )}
            {wear?.outer && (
              <g transform="translate(24 41) scale(0.72)" strokeWidth="3.2">
                <ClothingArt type={wear.outer.type} color={wear.outer.color} pattern={wear.outer.pattern} />
              </g>
            )}
          </g>
        )}

        {mood === 'wave' && (
          <g>
            <path d="M60 58 L38 82" />
            <g className="wave-arm">
              <path d="M60 58 L88 36" />
              <path d="M88 36 l6 -4 M88 36 l3 -7 M88 36 l8 1" strokeWidth="2" />
            </g>
          </g>
        )}

        {mood === 'cold' && (
          <g>
            <path d="M43 56 Q60 47 77 56 L85 98 Q60 104 35 98Z" fill="#e8a24a" />
            <path d="M38 76 Q60 82 82 76 M37 88 Q60 94 83 88" strokeWidth="1.8" />
            <path d="M60 50 L60 100" strokeWidth="1.8" />
            <path d="M44 60 L28 86 M76 60 L92 86" strokeWidth="5" stroke="#e8a24a" />
            <path d="M44 60 L28 86 M76 60 L92 86" strokeWidth="2.4" />
            <path d="M26 20 l-7 -3 M24 30 l-8 0 M96 20 l7 -3 M98 30 l8 0" strokeWidth="2" />
          </g>
        )}

        {mood === 'rain' && (
          <g>
            <path d="M60 58 L38 82" />
            <path d="M60 58 L86 76" />
          </g>
        )}

        {mood === 'trip' && (
          <g>
            <path d="M60 58 L38 80" />
            <path d="M60 58 L84 80" />
            <path d="M80 82 L104 82 L106 104 L78 104Z" />
            <path d="M86 82 Q92 70 98 82" />
          </g>
        )}

        {mood === 'empty' && (
          <g>
            <path d="M55 38 L65 38" />
            <path d="M60 58 L40 90" />
            <path d="M60 58 L80 90" />
            <path d="M96 40 l1 0 M104 40 l1 0 M112 40 l1 0" strokeWidth="4" />
          </g>
        )}

        {mood === 'wait' && (
          <g>
            <path d="M60 58 L38 84" />
            <path d="M60 58 L82 36" />
            <path d="M92 14 Q86 14 87 22 Q80 24 84 30 L108 30 Q116 22 108 18 Q106 8 96 10 Q94 11 92 14Z" />
          </g>
        )}
      </g>
      {mood === 'outdoor' && (
        <g>
          {/* 돗자리(체크무늬)와 도시락 바구니 */}
          <path d="M26 132 L112 132 L124 148 L12 148Z" fill="#f4c6c6" />
          <path d="M40 132 L34 148 M60 132 L58 148 M80 132 L82 148 M100 132 L106 148 M19 140 H118" strokeWidth="1.4" />
          <path d="M92 114 L116 114 L113 132 L95 132Z" fill="#c9965a" />
          <path d="M96 114 Q104 100 112 114" strokeWidth="2" />
          <path d="M100 123 H108" strokeWidth="1.6" />
        </g>
      )}
      {mood === 'camp' && (
        <g>
          {/* 텐트 */}
          <path d="M82 124 L110 62 L138 124Z" fill="#cfe6e2" />
          <path d="M102 124 L110 94 L118 124" />
          <path d="M110 62 L110 54" strokeWidth="2" />
          {/* 모닥불 */}
          <path d="M92 144 L116 134 M92 134 L116 144" strokeWidth="3.4" />
          <path d="M104 112 C96 122 96 132 104 138 C112 132 112 122 104 112Z" fill="#e8a24a" />
          <path d="M104 124 C100 129 101 134 104 136 C107 134 108 129 104 124Z" fill="#f2cf4a" strokeWidth="1.6" />
          <path d="M92 116 l-3 -5 M118 114 l3 -5 M104 106 l0 -5" stroke="#e8a24a" strokeWidth="1.8" />
        </g>
      )}
    </svg>
  )
}
