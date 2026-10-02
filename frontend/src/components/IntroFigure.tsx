import { colorHex } from '../mocks/clothes'
import { ClothingArt } from './ClothingDoodle'

interface Piece {
  type: string
  color: string
}
interface Outfit {
  key: string
  bottom: Piece
  top: Piece
  outer?: Piece
}

// 무난한 티셔츠와 바지
const FINAL: Outfit = { key: 'final', top: { type: '반팔', color: '흰색' }, bottom: { type: '바지', color: '네이비' } }

type Pt = readonly [number, number]
interface Place {
  tx: number
  ty: number
  s: number
}
// 옷 그림(100x100) -> 졸라맨 좌표
const TOP: Place = { tx: 27.5, ty: 39.6, s: 0.65 }
const OUTER: Place = { tx: 24, ty: 41, s: 0.72 }
const BOTTOM: Place = { tx: 35, ty: 86, s: 0.5 }

const rad = (d: number) => (d * Math.PI) / 180
const rot = ([x, y]: Pt, [cx, cy]: Pt, deg: number): Pt => {
  const c = Math.cos(rad(deg))
  const s = Math.sin(rad(deg))
  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]
}
const at = (p: Place, [x, y]: Pt): Pt => [p.tx + x * p.s, p.ty + y * p.s]
const mirror = ([x, y]: Pt): Pt => [100 - x, y]
const poly = (pts: Pt[]) => pts.map((p) => p.join(',')).join(' ')

const ARM_ANGLE = 58 // 팔이 몸에서 벌어진 각도(세로 기준). 클수록 더 활짝
const LEG_ANGLE = 18

// 소매: 어깨 끝(pivot)을 축으로 소매만 바깥으로 돌린다. cuff 는 소매 끝 가운데, ext 는 소매 밖으로 더 나오는 팔 길이
interface Sleeve {
  pivot: Pt
  cuff: Pt
  ext: number
  area: Pt[] // 왼쪽 소매 영역(옷 그림 좌표). 몸통은 가운데 직사각형
  forearm: boolean
}
const SHORT_SLEEVE: Sleeve = { pivot: [32, 16], cuff: [14.5, 37], ext: 28, forearm: true, area: [[34, 10], [-10, 10], [-10, 46], [19, 46], [29, 39]] }
const LONG_SLEEVE: Sleeve = { pivot: [32, 16], cuff: [14.5, 69], ext: 0, forearm: false, area: [[34, 10], [-10, 10], [-10, 80], [18, 80], [31, 46]] }
const sleeveOf = (type: string) => (type === '반팔' ? SHORT_SLEEVE : LONG_SLEEVE)

// 소매 축 방향이 이미 바깥으로 얼마나 벌어져 있는지(도) -> 목표 각도까지 더 돌릴 양
function sleeveTurn(sl: Sleeve) {
  const [px, py] = sl.pivot
  const [cx, cy] = sl.cuff
  return ARM_ANGLE - (Math.atan2(px - cx, cy - py) * 180) / Math.PI
}

// 다리: 가랑이(pivot)를 축으로 다리 쪽만 돌린다. hem 은 밑단 가운데
interface Legs {
  pivot: Pt
  hem: Pt
}
const legsOf = (type: string): Legs => (type === '반바지' ? { pivot: [50, 34], hem: [33.5, 58] } : { pivot: [50, 38], hem: [34.5, 92] })

function Garment({ id, type, color, place, strokeWidth, torsoOnly }: { id: string; type: string; color: string; place: Place; strokeWidth: number; torsoOnly: boolean }) {
  const sl = sleeveOf(type)
  const turn = sleeveTurn(sl)
  const left = sl.area
  const right = sl.area.map(mirror)
  const [px, py] = sl.pivot
  // 소매를 돌리면 겨드랑이 쪽이 벌어지므로, 그 틈을 같은 색으로 메우고 겨드랑이 솔기선을 긋는다
  const fill = colorHex[color] ?? color
  const armpit = left[left.length - 1]!
  const armpitL = rot(armpit, sl.pivot, turn)
  const armpitR = rot(mirror(armpit), mirror(sl.pivot), -turn)
  const gap = (a: Pt, b: Pt, p: Pt) => (
    <>
      <polygon points={poly([p, a, b])} fill={fill} stroke="none" />
      <path d={`M${a[0]} ${a[1]} L${b[0]} ${b[1]}`} />
    </>
  )
  return (
    <g transform={`translate(${place.tx} ${place.ty}) scale(${place.s})`} strokeWidth={strokeWidth}>
      <clipPath id={`${id}-torso`}>
        <rect x="29" y="-20" width="42" height="130" />
      </clipPath>
      <clipPath id={`${id}-l`}>
        <polygon points={poly(left)} />
      </clipPath>
      <clipPath id={`${id}-r`}>
        <polygon points={poly(right)} />
      </clipPath>
      <g clipPath={`url(#${id}-torso)`}>
        <ClothingArt type={type} color={color} />
      </g>
      {!torsoOnly && (
        <>
          {gap(armpit, armpitL, sl.pivot)}
          {gap(mirror(armpit), armpitR, mirror(sl.pivot))}
          <g transform={`rotate(${turn} ${px} ${py})`}>
            <g clipPath={`url(#${id}-l)`}>
              <ClothingArt type={type} color={color} />
            </g>
          </g>
          <g transform={`rotate(${-turn} ${100 - px} ${py})`}>
            <g clipPath={`url(#${id}-r)`}>
              <ClothingArt type={type} color={color} />
            </g>
          </g>
        </>
      )}
    </g>
  )
}

function Pants({ id, type, color }: { id: string; type: string; color: string }) {
  const { pivot } = legsOf(type)
  const [px, py] = pivot
  const cut = py - 8
  return (
    <g transform={`translate(${BOTTOM.tx} ${BOTTOM.ty}) scale(${BOTTOM.s})`} strokeWidth={3.6}>
      <clipPath id={`${id}-up`}>
        <rect x="0" y="-20" width="100" height={cut + 20} />
      </clipPath>
      <clipPath id={`${id}-ll`}>
        <polygon points={poly([[50, cut], [-10, cut], [-10, 110], [50, 110]])} />
      </clipPath>
      <clipPath id={`${id}-lr`}>
        <polygon points={poly([[50, cut], [110, cut], [110, 110], [50, 110]])} />
      </clipPath>
      <g clipPath={`url(#${id}-up)`}>
        <ClothingArt type={type} color={color} />
      </g>
      <g transform={`rotate(${LEG_ANGLE} ${px} ${py})`}>
        <g clipPath={`url(#${id}-ll)`}>
          <ClothingArt type={type} color={color} />
        </g>
      </g>
      <g transform={`rotate(${-LEG_ANGLE} ${px} ${py})`}>
        <g clipPath={`url(#${id}-lr)`}>
          <ClothingArt type={type} color={color} />
        </g>
      </g>
    </g>
  )
}

const hand = (p: Pt, key: string) => <circle key={key} cx={p[0]} cy={p[1]} r="3.4" fill="#fcfcfa" strokeWidth="2.2" />

/** 옷 한 벌: 다리(바지 밑으로 보이는 부분) -> 하의 -> 상의/겉옷 -> 소매 밖으로 나온 팔뚝과 손 */
function Wear({ o }: { o: Outfit }) {
  const upper = o.outer ?? o.top
  const upperPlace = o.outer ? OUTER : TOP
  const sl = sleeveOf(upper.type)
  const turn = sleeveTurn(sl)

  // 다리: 가랑이에서 밑단 방향으로 뻗는 막대 (옷에 가려지는 부분은 옷 아래에 그려진다)
  const lg = legsOf(o.bottom.type)
  const dir: Pt = [lg.hem[0] - lg.pivot[0], lg.hem[1] - lg.pivot[1]]
  const len = Math.hypot(dir[0], dir[1])
  const footArt: Pt = [lg.pivot[0] + (dir[0] / len) * 74, lg.pivot[1] + (dir[1] / len) * 74]
  const hipFig = at(BOTTOM, lg.pivot)
  const footL = at(BOTTOM, rot(footArt, lg.pivot, LEG_ANGLE))
  const footR = at(BOTTOM, rot(mirror(footArt), mirror(lg.pivot), -LEG_ANGLE))

  // 팔: 소매 끝에서 소매 방향 그대로 이어지는 팔뚝/손
  const ud: Pt = [sl.cuff[0] - sl.pivot[0], sl.cuff[1] - sl.pivot[1]]
  const ul = Math.hypot(ud[0], ud[1])
  const unit: Pt = [ud[0] / ul, ud[1] / ul]
  const wristArt: Pt = [sl.cuff[0] + unit[0] * sl.ext, sl.cuff[1] + unit[1] * sl.ext]
  const handArt: Pt = [wristArt[0] + unit[0] * 3.5, wristArt[1] + unit[1] * 3.5]
  const side = (flip: boolean) => {
    const piv: Pt = flip ? mirror(sl.pivot) : sl.pivot
    const f = (p: Pt) => at(upperPlace, rot(flip ? mirror(p) : p, piv, flip ? -turn : turn))
    return { cuff: f(sl.cuff), wrist: f(wristArt), hand: f(handArt) }
  }
  const armL = side(false)
  const armR = side(true)

  return (
    <>
      <path d={`M${hipFig[0]} ${hipFig[1]} L${footL[0]} ${footL[1]} M${hipFig[0]} ${hipFig[1]} L${footR[0]} ${footR[1]}`} />
      <Pants id={`${o.key}-b`} type={o.bottom.type} color={o.bottom.color} />
      <Garment id={`${o.key}-t`} type={o.top.type} color={o.top.color} place={TOP} strokeWidth={3.4} torsoOnly={!!o.outer} />
      {o.outer && <Garment id={`${o.key}-o`} type={o.outer.type} color={o.outer.color} place={OUTER} strokeWidth={3.2} torsoOnly={false} />}
      {sl.forearm && (
        <path d={`M${armL.cuff[0]} ${armL.cuff[1]} L${armL.wrist[0]} ${armL.wrist[1]} M${armR.cuff[0]} ${armR.cuff[1]} L${armR.wrist[0]} ${armR.wrist[1]}`} strokeWidth="2.6" />
      )}
      {hand(armL.hand, 'hl')}
      {hand(armR.hand, 'hr')}
    </>
  )
}

/** 로그인 첫 화면의 졸라맨: 팔다리를 벌린 '大' 자로, 무난한 티셔츠와 바지를 입고 서 있다. */
export default function IntroFigure({ size = 200 }: { size?: number }) {
  return (
    <svg
      className="doodle intro-figure"
      width={size}
      height={size * 1.15}
      viewBox="0 0 140 160"
      fill="none"
      stroke="#222"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      overflow="visible"
      aria-hidden="true"
    >
      <g transform="translate(10 0)">
        {/* 몸통과 머리 */}
        <path d="M60 47 L61 100" />
        <path d="M60.5 12.5 C71 11.5 78.5 20 77.5 30.5 C76.5 40 70 48 60 48 C50 48 42.5 40.5 42.5 30 C42.5 20.5 49.5 13 60.5 12.5Z" />
        <g stroke="none">
          <circle cx="53.5" cy="30" r="1.9" fill="#222" />
          <circle cx="66.5" cy="29.5" r="1.9" fill="#222" />
        </g>
        <path d="M56.5 36.5 Q60.5 40 64.5 36" strokeWidth="2" />

        <Wear o={FINAL} />
      </g>
    </svg>
  )
}
