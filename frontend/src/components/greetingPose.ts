import { colorHex } from '../mocks/clothes'

// 인사하는 졸라맨을 '획(path)' 단위로 계산한다. IntroFigure 와 같은 옷(흰 반팔, 네이비 바지)과 같은 비율이다.
// 애니메이션은 이 획들을 하나씩 실제 선으로 그려 나간다(마스크로 가리지 않으므로 선이 잘리지 않는다).

type Pt = readonly [number, number]
interface Place {
  tx: number
  ty: number
  s: number
}

const TOP: Place = { tx: 27.5, ty: 39.6, s: 0.65 }
const BOTTOM: Place = { tx: 35, ty: 86, s: 0.5 }
const LEG_ANGLE = 18

// 반팔 티셔츠(옷 그림 100x100 좌표)
const PIVOT: Pt = [32, 16] // 어깨 끝(소매를 돌리는 축)
const CUFF: Pt = [14.5, 37] // 소매 끝 가운데
const EXT = 28 // 소매 밖으로 나오는 팔 길이
const SLEEVE_OUT: Pt[] = [[10, 30], [19, 44]] // 왼쪽 소매 끝 두 점
const ARMPIT: Pt = [29, 39]

const rad = (d: number) => (d * Math.PI) / 180
const rot = ([x, y]: Pt, [cx, cy]: Pt, deg: number): Pt => {
  const c = Math.cos(rad(deg))
  const s = Math.sin(rad(deg))
  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]
}
const at = (p: Place, [x, y]: Pt): Pt => [p.tx + x * p.s, p.ty + y * p.s]
const mirror = ([x, y]: Pt): Pt => [100 - x, y]
const fmt = (n: number) => Math.round(n * 100) / 100
const P = (pts: Pt[], close = true) => `M${pts.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(' L')}${close ? 'Z' : ''}`

// 소매 축이 이미 바깥으로 벌어진 각도를 빼서, 목표 각도까지 더 돌릴 양을 구한다
const sleeveTurn = (angle: number) => angle - (Math.atan2(PIVOT[0] - CUFF[0], CUFF[1] - PIVOT[1]) * 180) / Math.PI

export interface Pose {
  head: string
  eyes: Pt[]
  smile: string
  body: string
  armL: string
  armR: string
  handL: Pt
  handR: Pt
  legL: string
  legR: string
  pants: string
  pantsWaist: string
  tee: string
  teeNeck: string
  teeFill: string
  pantsFill: string
  hatch: string
}

/** armL/armR: 팔이 몸에서 벌어진 각도(세로 아래 기준, 클수록 위로 올라감) */
export function buildPose(armL: number, armR: number): Pose {
  const tL = sleeveTurn(armL)
  const tR = sleeveTurn(armR)
  const T = (p: Pt) => at(TOP, p)

  // --- 티셔츠: 소매를 돌린 윤곽 한 줄 ---
  const sl = SLEEVE_OUT.map((p) => rot(p, PIVOT, tL))
  const armpitL = rot(ARMPIT, PIVOT, tL)
  const pivotR = mirror(PIVOT)
  const sr = SLEEVE_OUT.map((p) => rot(mirror(p), pivotR, -tR)).reverse() // 오른쪽은 아래 소매 끝부터 위로
  const armpitR = rot(mirror(ARMPIT), pivotR, -tR)
  const teePts: Pt[] = [PIVOT, ...sl, armpitL, ARMPIT, [29, 86], [71, 86], mirror(ARMPIT), armpitR, ...sr, pivotR]
  const tee = P(teePts.map(T), false)
  const [nx, ny] = T([50, 28])
  const [px0, py0] = T(PIVOT)
  const teeOutline = `${tee} Q${fmt(nx)} ${fmt(ny)} ${fmt(px0)} ${fmt(py0)}Z`
  const teeNeck = (() => {
    const a = T([40, 18])
    const b = T([60, 18])
    const c = T([50, 27])
    return `M${fmt(a[0])} ${fmt(a[1])} Q${fmt(c[0])} ${fmt(c[1])} ${fmt(b[0])} ${fmt(b[1])}`
  })()

  // --- 팔: 어깨 끝에서 손까지 한 줄(옷에 가려지는 부분은 옷 아래에 깔린다) ---
  const unit: Pt = (() => {
    const dx = CUFF[0] - PIVOT[0]
    const dy = CUFF[1] - PIVOT[1]
    const l = Math.hypot(dx, dy)
    return [dx / l, dy / l]
  })()
  const handArt: Pt = [CUFF[0] + unit[0] * (EXT + 3.5), CUFF[1] + unit[1] * (EXT + 3.5)]
  const handL = T(rot(handArt, PIVOT, tL))
  const handR = T(rot(mirror(handArt), pivotR, -tR))
  const shoulderL = T(PIVOT)
  const shoulderR = T(pivotR)
  // 손 원(반지름 3.4)의 가장자리까지만 선을 긋는다
  const stop = (from: Pt, to: Pt): Pt => {
    const dx = to[0] - from[0]
    const dy = to[1] - from[1]
    const l = Math.hypot(dx, dy)
    return [to[0] - (dx / l) * 3.4, to[1] - (dy / l) * 3.4]
  }
  const endL = stop(shoulderL, handL)
  const endR = stop(shoulderR, handR)

  // --- 바지: 다리를 벌린 윤곽 ---
  const pivotB: Pt = [50, 38]
  const rotL = (p: Pt) => at(BOTTOM, rot(p, pivotB, LEG_ANGLE))
  const rotR = (p: Pt) => at(BOTTOM, rot(p, pivotB, -LEG_ANGLE))
  const cutY = 30
  const edge = (x0: number, x1: number) => x0 + ((cutY - 12) / 80) * (x1 - x0)
  const pantsPts: Pt[] = [
    at(BOTTOM, [30, 12]), at(BOTTOM, [70, 12]),
    at(BOTTOM, [edge(70, 75), cutY]), rotR([edge(70, 75), cutY]), rotR([75, 92]), rotR([56, 92]),
    at(BOTTOM, pivotB),
    rotL([44, 92]), rotL([25, 92]), rotL([edge(30, 25), cutY]), at(BOTTOM, [edge(30, 25), cutY]),
  ]
  const pants = P(pantsPts)
  const w1 = at(BOTTOM, [30, 20])
  const w2 = at(BOTTOM, [70, 20])
  const pantsWaist = `M${fmt(w1[0])} ${fmt(w1[1])} L${fmt(w2[0])} ${fmt(w2[1])}`

  // 바지 안쪽을 색연필로 칠하는 지그재그(바지 윤곽으로 잘라 쓴다)
  const xs = pantsPts.map((p) => p[0])
  const ys = pantsPts.map((p) => p[1])
  const x0 = Math.min(...xs) - 2
  const x1 = Math.max(...xs) + 2
  const y0 = Math.min(...ys) - 2
  const y1 = Math.max(...ys) + 2
  const hatchPts: Pt[] = []
  let flip = false
  for (let y = y0; y <= y1; y += 4.2) {
    hatchPts.push(flip ? [x1, y] : [x0, y], flip ? [x0, y + 2.1] : [x1, y + 2.1])
    flip = !flip
  }

  // --- 다리 선: 가랑이에서 발끝까지(바지 밑단 아래로 살짝 나온다) ---
  const hem: Pt = [34.5, 92]
  const dir: Pt = [hem[0] - pivotB[0], hem[1] - pivotB[1]]
  const dl = Math.hypot(dir[0], dir[1])
  const footArt: Pt = [pivotB[0] + (dir[0] / dl) * 74, pivotB[1] + (dir[1] / dl) * 74]
  const hip = at(BOTTOM, pivotB)
  const footL = rotL(footArt)
  const footR = rotR(mirror(footArt))

  return {
    head: 'M60.5 12.5 C71 11.5 78.5 20 77.5 30.5 C76.5 40 70 48 60 48 C50 48 42.5 40.5 42.5 30 C42.5 20.5 49.5 13 60.5 12.5Z',
    eyes: [[53.5, 30], [66.5, 29.5]],
    smile: 'M56.5 36.5 Q60.5 40 64.5 36',
    body: 'M60 47 L61 100',
    armL: `M${fmt(shoulderL[0])} ${fmt(shoulderL[1])} L${fmt(endL[0])} ${fmt(endL[1])}`,
    armR: `M${fmt(shoulderR[0])} ${fmt(shoulderR[1])} L${fmt(endR[0])} ${fmt(endR[1])}`,
    handL,
    handR,
    legL: `M${fmt(hip[0])} ${fmt(hip[1])} L${fmt(footL[0])} ${fmt(footL[1])}`,
    legR: `M${fmt(hip[0])} ${fmt(hip[1])} L${fmt(footR[0])} ${fmt(footR[1])}`,
    pants,
    pantsWaist,
    tee: teeOutline,
    teeNeck,
    teeFill: colorHex['흰색'] ?? '#fff',
    pantsFill: colorHex['네이비'] ?? '#1f3a68',
    hatch: P(hatchPts, false),
  }
}
