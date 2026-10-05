// 일출·일몰: 지평선 위로 해가 지나가는 길(점선 호)과 해, 양쪽에 시각, 가운데에 낮의 길이.
// now 를 주면 지금 해가 그 길의 어디쯤인지 보여준다(해가 졌거나 뜨기 전이면 달).
// 홈(now)에서는 해가 뜨고 지는 때를 연출한다(열 때 한 번만 움직인다):
//  - 일출 30분 전 ~ 일출(dawn): 밤 빌딩 뒤로 새벽빛이 번지고 빌딩 모서리에 빛이 든다
//  - 일출 ~ 5분 뒤(rising): 하늘이 물든 채 빌딩 위로 해가 떠오르며 빌딩을 비춘다
//  - 일몰 30분 전 ~ 일몰(dusk): 노을이 번지고 빌딩이 땅에서 하나씩 그려지듯 올라온다
//  - 일몰 ~ 5분 뒤(setting): 노을빛 하늘, 빌딩 사이로 해가 진다 -> 그 뒤는 밤 그림
// 일정 화면에서는 now 대신 eventTime(일정 시작·끝)을 주면 "일정 시간" 기준으로 보여준다: 시작이 일몰 뒤(또는 일출 전)면 달과 밤 빌딩.

const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5))

// 손글씨 폰트는 띄어쓰기가 좁아서 "곧 해가"가 붙어 보인다: 줄바꿈 없는 공백 두 칸
const SP = '  '

// 해가 지나가는 길(3차 베지어) 위의 점
const P = [
  [29, 38],
  [60, -16],
  [200, -16],
  [231, 39],
] as const
const at = (t: number): [number, number] => {
  const u = 1 - t
  const c = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]
  return [0, 1].map((k) => c.reduce((a, w, i) => a + w * P[i]![k]!, 0)) as [number, number]
}

// 해가 지금까지 지나온 호(처음 ~ t): 베지어를 t 에서 잘라 앞 조각만 그린다
const passedPath = (t: number): string => {
  if (t <= 0.01) return ''
  const mix = (a: readonly number[], b: readonly number[]) => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t]
  const q0 = mix(P[0], P[1])
  const q1 = mix(P[1], P[2])
  const q2 = mix(P[2], P[3])
  const r0 = mix(q0, q1)
  const r1 = mix(q1, q2)
  const s = mix(r0, r1)
  const f = (p: number[]) => `${p[0]!.toFixed(1)} ${p[1]!.toFixed(1)}`
  return `M${P[0][0]} ${P[0][1]} C${f(q0)} ${f(r0)} ${f(s)}`
}

// 빌딩: [왼쪽아래, 왼쪽위, 오른쪽위, 오른쪽아래] 의 x,y
const BUILDINGS = [
  [14, 58, 14, 40, 27, 39, 28, 58], [29, 58, 30, 24, 40, 23, 41, 58], [42, 58, 42, 36, 56, 37, 57, 58], [58, 58, 58, 14, 66, 12, 68, 58],
  [69, 58, 70, 32, 84, 31, 85, 58], [86, 58, 86, 38, 96, 40, 97, 58], [98, 58, 99, 26, 112, 25, 113, 58], [114, 58, 114, 42, 128, 41, 129, 58],
  [130, 58, 131, 34, 140, 33, 141, 58], [142, 58, 142, 44, 156, 45, 157, 58], [158, 58, 158, 38, 168, 37, 169, 58], [200, 58, 200, 40, 212, 41, 213, 58],
  [214, 58, 215, 28, 226, 27, 227, 58], [228, 58, 228, 42, 246, 41, 247, 58],
] as const
// 오후 햇빛이 땅에 닿는 자리와 굵기
const BEAMS = [210, 150, 128, 104, 82, 58, 34] as const
const BEAMS_RISE = [60, 92, 122, 152, 182, 214, 238] as const // 해가 왼쪽에서 뜰 때 빛이 닿는 자리
const BEAM_HALF = 7
const WINDOWS = 'M34 32 l.1 0 M34 42 l.1 0 M62 24 l.1 0 M62 36 l.1 0 M62 48 l.1 0 M76 40 l.1 0 M104 34 l.1 0 M104 46 l.1 0 M135 42 l.1 0 M163 46 l.1 0 M220 36 l.1 0 M220 48 l.1 0 M235 50 l.1 0 M20 48 l.1 0'

// 떠오르는 해는 왼쪽 빌딩 위로, 지는 해는 오른쪽 빌딩 사이로
const RISE_POS = [20, 27] as const
const SET_POS = [184, 30] as const

// 빌딩 뒤에서 비쳐 오는 햇살(깜빡임)
const RAYS_RISE = ['M24 30 L20 8 M32 34 L40 12', 'M48 40 L58 20 M12 38 L4 20', 'M92 44 L98 26 M104 46 L112 30', 'M140 40 L136 24 M170 44 L176 28']
const RAYS_SET = ['M176 32 L170 12 M192 34 L200 14', 'M160 42 L150 24 M208 40 L218 22', 'M110 44 L104 28 M126 44 L132 28', 'M60 42 L54 26 M234 42 L242 26']

function SunFace() {
  return (
    <g transform="scale(1.15)">
      {/* 동글납작한 얼굴, 점 눈, 작은 미소, 길이가 제각각인 햇살 */}
      <path d="M0 -10 C8 -11 12 -3 10 4 C7 12 -5 13 -10 6 C-13 -2 -8 -9 0 -10Z" fill="#f2cf4a" stroke="#222" strokeWidth="2.2" />
      <path d="M-4 -1 l.1 0 M4 -1.5 l.1 0" stroke="#222" strokeWidth="3" />
      <path d="M-3 4 Q0 7.5 3.5 3.5" stroke="#222" strokeWidth="1.8" />
      <path d="M1 -15 L0 -19 M-14 -3 L-18 -5 M15 -2 L19 -3 M-10 -12 L-13 -16 M11 -11 L15 -13 M-9 11 L-12 14 M10 11 L13 14" stroke="#e8a24a" strokeWidth="2" />
    </g>
  )
}

export default function SunBar({ rise, set, now, eventTime }: { rise: string; set: string; now?: Date; eventTime?: { start: string; end: string } }) {
  const len = toMin(set) - toMin(rise)
  let t = 0.5
  let night = false
  let dawn = 0 // 0..1: 일출 30분 전 -> 일출. 0 이면 새벽이 아니다
  let rising = false
  let dusk = 0 // 0..1: 일몰 30분 전 -> 일몰. 0 이면 노을 전이다
  let setting = false
  let morning = false // 일출 후 5~8분: 일출 장면이 사라지고 낮 그림이 나타난다(한 번 교차)
  let duskIn = false // 노을 시작 첫 3분: 낮 그림이 사라지고 노을 장면이 나타난다
  let status = ''
  // 하루 종일 일정(00:00~23:59)은 시간대가 없으니 그냥 낮 그림
  const timed = eventTime && !(toMin(eventTime.start) <= 0 && toMin(eventTime.end) >= 23 * 60)
  if (now || timed) {
    const kst = now ? new Date(now.getTime() + 9 * 3600_000) : null
    const m = kst ? kst.getUTCHours() * 60 + kst.getUTCMinutes() : toMin(eventTime!.start)
    const r = toMin(rise)
    const s = toMin(set)
    if (kst && m >= r - 30 && m < r) {
      night = true
      dawn = Math.max(0.05, (m - (r - 30)) / 30)
      status = `곧${SP}해가 떠요 · 일출 ${rise}`
    } else if (kst && m >= r && m < r + 5) {
      rising = true
      status = '해가 떠오르고 있어요'
    } else if (m < r) {
      night = true
      status = kst ? '아직 해가 뜨기 전이에요' : `해 뜨기 전 일정이에요 · 일출 ${rise}`
    } else if (kst && m >= s && m < s + 5) {
      setting = true
      status = '해가 지고 있어요'
    } else if (m > s) {
      night = true
      status = kst ? '오늘은 해가 졌어요' : `일몰 후 일정이에요 · 일몰 ${set}`
    } else {
      t = (m - r) / len
      if (kst && m < r + 8) {
        morning = true
        rising = true
      }
      if (kst && m >= s - 30) {
        dusk = Math.max(0.05, (m - (s - 30)) / 30)
        duskIn = m < s - 27
        status = `곧${SP}해가 져요 · 일몰 ${set}`
      } else {
        status = kst
          ? `해가 떠 있어요 · 일몰까지 ${Math.floor((s - m) / 60)}시간 ${(s - m) % 60}분`
          : toMin(eventTime!.end) > s
            ? `일정 중에 해가 져요 · 일몰 ${set}`
            : `해가 떠 있는 시간 일정이에요 · 일몰까지 ${Math.floor((s - m) / 60)}시간 ${(s - m) % 60}분`
      }
    }
  }
  const scene = night || rising || dusk > 0 || setting // 빌딩이 보이는 장면
  // 해가 빌딩 뒤에서 보이는 장면은 해를 빌딩보다 먼저(뒤에) 그린다
  const sunBehind = rising || setting || dusk > 0
  const [ax, ay] = at(t)
  const passed = now || timed ? passedPath(t) : ''
  const [x, y] = night
    ? [182, 12]
    : setting
      ? [SET_POS[0], SET_POS[1]]
      : dusk > 0
      ? [SET_POS[0], ay * (1 - dusk) + SET_POS[1] * dusk]
      : [ax, ay]
  const riseAnim = rising && !morning
  const dayLayer = (!night && !rising && !setting && dusk === 0) || morning || duskIn
  const sceneFx = morning ? 'sb-fx-out' : duskIn ? 'sb-fx-in' : undefined
  const dayFx = morning ? 'sb-fx-in' : duskIn ? 'sb-fx-out' : undefined
  const [sx, sy] = night ? [x, y] : [ax, ay]
  const sunX = rising || dawn > 0 ? RISE_POS[0] : SET_POS[0]
  // 빛이 드는 정도: 새벽·노을 전에는 점점 밝게, 일출·일몰 때는 가장 강하게
  const lit = rising || setting ? 1 : dawn > 0 ? Math.min(1, dawn * 1.2) : dusk

  return (
    <div className="act-sun" aria-label={`일출 ${rise}, 일몰 ${set}`}>
      <svg viewBox="0 -14 260 88" width="100%" height="88" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <defs>
          <clipPath id="sb-above-ground">
            <rect x="0" y="-14" width="260" height="72" />
          </clipPath>
        </defs>

        <g className={sceneFx}>
        {/* 해가 진 뒤(그리고 새벽): 보랏빛 크레용으로 쓱쓱 칠한 밤하늘과 별 */}
        {night && (
          <g className="act-night">
            <g stroke="#b7aee3" strokeWidth="13" opacity={0.78 * (1 - 0.55 * dawn)}>
              <path d="M12 -6 C60 -12 120 -2 248 -8" />
              <path d="M6 7 C70 12 150 0 252 6" />
              <path d="M14 20 C80 14 160 25 246 17" />
              <path d="M8 33 C60 39 170 28 254 35" />
              <path d="M16 46 C90 41 150 52 244 45" />
              <path d="M10 58 C70 63 180 55 250 60" />
            </g>
            <g stroke="#222" strokeWidth="2.6" opacity={0.8 * (1 - dawn)}>
              <path d="M52 2 l.1 0 M92 22 l.1 0 M214 28 l.1 0 M236 4 l.1 0 M34 40 l.1 0" />
            </g>
          </g>
        )}
        {/* 새벽빛: 수평선 쪽부터 분홍·주황빛이 번진다 */}
        {dawn > 0 && (
          <>
            <g stroke="#f4b6c2" strokeWidth="13" opacity={0.65 * dawn}>
              <path d="M14 20 C80 14 160 25 246 17" />
              <path d="M8 33 C60 39 170 28 254 35" />
            </g>
            <g stroke="#f6b26b" strokeWidth="13" opacity={0.12 + 0.62 * dawn}>
              <path d="M16 46 C90 41 150 52 244 45" />
              <path d="M10 58 C70 63 180 55 250 60" />
            </g>
          </>
        )}
        {/* 일출: 하늘이 분홍 -> 주황 -> 노랑으로 물든 채 유지된다 */}
        {rising && (
          <g strokeWidth="13">
            <g stroke="#f7c3cf" opacity="0.85">
              <path d="M12 -6 C60 -12 120 -2 248 -8" />
              <path d="M6 7 C70 12 150 0 252 6" />
            </g>
            <g stroke="#f9cf9b" opacity="0.9">
              <path d="M14 20 C80 14 160 25 246 17" />
              <path d="M8 33 C60 39 170 28 254 35" />
            </g>
            <g stroke="#f8d878" opacity="0.92">
              <path d="M16 46 C90 41 150 52 244 45" />
              <path d="M10 58 C70 63 180 55 250 60" />
            </g>
          </g>
        )}
        {/* 노을: 해가 질수록 하늘이 주황 -> 붉은 분홍 -> 보랏빛으로 번진다 */}
        {(dusk > 0 || setting) && (
          <g strokeWidth="13">
            <g stroke="#c9a6d9" opacity={setting ? 0.85 : 0.25 + 0.6 * dusk}>
              <path d="M12 -6 C60 -12 120 -2 248 -8" />
              <path d="M6 7 C70 12 150 0 252 6" />
            </g>
            <g stroke="#f09aa2" opacity={setting ? 0.9 : 0.4 + 0.5 * dusk}>
              <path d="M14 20 C80 14 160 25 246 17" />
              <path d="M8 33 C60 39 170 28 254 35" />
            </g>
            <g stroke="#f6a45a" opacity={setting ? 0.92 : 0.45 + 0.47 * dusk}>
              <path d="M16 46 C90 41 150 52 244 45" />
              <path d="M10 58 C70 63 180 55 250 60" />
            </g>
          </g>
        )}

        {/* 해 둘레의 따뜻한 빛번짐 */}
        {(rising || setting || dusk > 0 || dawn > 0) && (
          <circle cx={rising || dawn > 0 ? RISE_POS[0] : x} cy={rising || dawn > 0 ? RISE_POS[1] + 4 : y} r="40" fill="#ffe28a" stroke="none" opacity={rising || setting ? 0.38 : 0.38 * lit} />
        )}
        {/* 빌딩 뒤에서 비쳐 오는 햇살: 간간이 깜빡인다 */}
        {(dawn > 0 || rising || setting || dusk > 0) && (
          <g stroke="#f2cf4a" strokeWidth="2.6" opacity={rising || setting ? 0.9 : 0.2 + 0.7 * lit}>
            {(dawn > 0 || rising ? RAYS_RISE : RAYS_SET).map((d, i) => (
              <path key={i} className="sb-ray" style={{ ['--d' as string]: `${(i * 0.8).toFixed(1)}s` }} d={d} />
            ))}
          </g>
        )}

        {/* 빌딩 뒤의 해: 떠오르거나(왼쪽) 빌딩 사이로 진다(오른쪽) */}
        {sunBehind && (
          <g clipPath="url(#sb-above-ground)">
            <g transform={rising ? `translate(${RISE_POS[0]} ${RISE_POS[1]})` : `translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
              <g className={riseAnim ? 'sb-rise-in' : setting ? 'sb-set-in' : undefined}>
                <SunFace />
              </g>
            </g>
          </g>
        )}

        </g>

        {/* 땅: 손으로 그은 삐뚤빼뚤한 선 */}
        <path d="M5 58 C24 55 44 61 78 57 C108 54 124 60 158 58 C190 56 222 61 255 56" stroke="#222" strokeWidth="2.4" />
        <path d="M70 64 q6 3 12 0 M176 65 q7 3 13 0" stroke="#222" strokeWidth="1.5" opacity="0.5" />
        {/* 해가 지나가는 길: 점선을 콕콕 찍은 듯 */}
        {dayLayer && (
          <g className={dayFx}>
            <path d="M29 38 C60 -16 200 -16 231 39" stroke="#222" strokeWidth="2.2" strokeDasharray="0.5 8" opacity="0.75" />
            {/* 해가 지나온 길은 주황 실선으로 */}
            {passed && <path d={passed} stroke="#e8a24a" strokeWidth="3.2" />}
          </g>
        )}

        {/* 빌딩: 밤에는 까만 그림자와 켜진 창, 일출·일몰에는 해 쪽 모서리에 빛이 든다. 노을 전에는 땅에서 하나씩 올라온다 */}
        {scene && (
          <g className={sceneFx}>
          <g clipPath="url(#sb-above-ground)">
            {BUILDINGS.map((b, i) => {
              const cx = (b[0] + b[6]) / 2
              const faceRight = cx < sunX // 해가 오른쪽에 있으면 오른쪽 모서리가 밝다
              const near = Math.abs(cx - sunX) < 48
              const body = `M${b[0]} ${b[1]} L${b[2]} ${b[3]} L${b[4]} ${b[5]} L${b[6]} ${b[7]}Z`
              return (
                <g key={i}>
                  <path d={body} fill="#222" stroke="#222" strokeWidth="1.6" />
                  {/* 빛: 해가 뜰 때는 해에 가까운 빌딩부터 차례로 켜지고, 질 때는 먼 빌딩부터 해와 함께 꺼진다 */}
                  <g
                    className={riseAnim ? 'sb-light-in' : setting ? 'sb-light-out' : undefined}
                    style={{ ['--d' as string]: `${((rising ? Math.abs(cx - sunX) : 260 - Math.abs(cx - sunX)) / 260 * 2.6).toFixed(2)}s` }}
                  >
                    {lit > 0 && near && (rising || setting) && <path d={body} fill="#f6b26b" fillOpacity="0.5" stroke="none" />}
                    {lit > 0 && (
                      <path
                        d={faceRight ? `M${b[2]} ${b[3]} L${b[4]} ${b[5]} L${b[6]} ${b[7]}` : `M${b[0]} ${b[1]} L${b[2]} ${b[3]} L${b[4]} ${b[5]}`}
                        stroke="#ffd27a"
                        strokeWidth="2"
                        opacity={Math.min(1, lit * 1.1)}
                      />
                    )}
                  </g>
                </g>
              )
            })}
            <path d="M62 12 V4 M105 25 V19" stroke="#222" strokeWidth="1.6" />
            {/* 오후의 햇빛: 해에서 빌딩 사이로 비스듬히 뻗어 빌딩과 땅에 닿는다. 해가 질수록 가늘어진다 */}
            {/* 일출: 해가 오르는 만큼 빛줄기도 함께 올라오며 오른쪽 빌딩들을 비춘다. 일몰: 해와 함께 내려가며 줄어든다 */}
            {(dusk > 0 || setting || rising) && (
              <g transform={`translate(${(rising ? RISE_POS[0] : x).toFixed(1)} ${(rising ? RISE_POS[1] : y).toFixed(1)})`}>
                <g className={riseAnim ? 'sb-rise-in' : setting ? 'sb-set-in' : undefined}>
                  <g className={riseAnim ? 'sb-light-in' : setting ? 'sb-light-out' : undefined} fill="#ffd980" stroke="none">
                    {(rising ? BEAMS_RISE : BEAMS).map((gx, i) => {
                      const ox = rising ? RISE_POS[0] : x
                      const oy = rising ? RISE_POS[1] : y
                      const hw = BEAM_HALF * (rising ? 0.9 : setting ? 0.22 : 1 - 0.75 * dusk)
                      return <path key={i} d={`M0 0 L${(gx - hw - ox).toFixed(1)} ${(58 - oy).toFixed(1)} L${(gx + hw - ox).toFixed(1)} ${(58 - oy).toFixed(1)}Z`} opacity={rising ? 0.34 : setting ? 0.3 : 0.38 - 0.1 * dusk} />
                    })}
                  </g>
                </g>
              </g>
            )}
            {/* 켜진 창: 해가 뜨면 꺼지고, 해가 지면 켜진다 */}
            {(night || dusk > 0) && <path d={WINDOWS} stroke="#f2cf4a" strokeWidth="3" opacity={night ? 0.95 * (1 - dawn) : 0.95 * dusk * dusk} />}
          </g>
          </g>
        )}

        {/* 일출·일몰 자리: 호의 양 끝에 작은 점과 눈금(해는 가운데에서 움직이는 하나만) */}
        {dayLayer && (
          <g className={dayFx} stroke="#222" strokeWidth="2.2">
            <circle cx="29" cy="40" r="3" fill="#fcfcfa" />
            <circle cx="231" cy="41" r="3" fill="#fcfcfa" />
            <path d="M29 46 V55 M231 47 V55" strokeWidth="1.8" opacity="0.6" />
          </g>
        )}
        {/* 낮의 해 / 밤의 달 */}
        {(!sunBehind || morning || duskIn) && (
          <g className={dayFx} transform={`translate(${sx.toFixed(1)} ${sy.toFixed(1)})`} opacity={night ? 1 - dawn : 1}>
            <g className="act-sunbody">
              {night ? (
                <g className={now && dawn === 0 ? 'sb-moon-in' : undefined}>
                  <g transform="scale(0.95) rotate(-14)">
                    <path d="M4 -14 C-1 -16 -7 -11 -10 -4 C-14 2 -11 11 -4 14 C2 16 6 18 12 14 C16 11 17 8 14 7 C10 9 5 7 2 4 C-2 0 -3 -4 0 -8 C2 -11 6 -11 4 -14Z" fill="#f2cf4a" stroke="#222" strokeWidth="2.4" />
                    <path d="M1 -11 C-5 -9 -10 -2 -8 5 C-7 9 -4 11 -1 12" stroke="#222" strokeWidth="1.2" opacity="0.45" />
                    <path d="M-5 0 l.1 0 M-2 8 l.1 0" stroke="#e8a24a" strokeWidth="2.6" />
                  </g>
                </g>
              ) : (
                <SunFace />
              )}
            </g>
          </g>
        )}
      </svg>
      <div className="act-suntimes">
        <span className="act-sunlabel">
          <span className="tiny">일출</span>
          <b>{rise}</b>
        </span>
        <span className="tiny act-daylen">낮 {Math.floor(len / 60)}시간 {len % 60}분</span>
        <span className="act-sunlabel">
          <span className="tiny">일몰</span>
          <b>{set}</b>
        </span>
      </div>
      {status && <p className="tiny act-status">{status}</p>}
    </div>
  )
}
