// 일출·일몰: 지평선 위로 해가 지나가는 길(점선 호)과 해, 양쪽에 시각, 가운데에 낮의 길이.
// now 를 주면 지금 해가 그 길의 어디쯤인지 보여준다(해가 졌거나 뜨기 전이면 달).

const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5))

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

export default function SunBar({ rise, set, now }: { rise: string; set: string; now?: Date }) {
  const len = toMin(set) - toMin(rise)
  let t = 0.5
  let night = false
  let status = ''
  if (now) {
    const kst = new Date(now.getTime() + 9 * 3600_000)
    const m = kst.getUTCHours() * 60 + kst.getUTCMinutes()
    if (m < toMin(rise)) {
      night = true
      status = '아직 해가 뜨기 전이에요'
    } else if (m > toMin(set)) {
      night = true
      status = '오늘은 해가 졌어요'
    } else {
      t = (m - toMin(rise)) / len
      status = `해가 떠 있어요 · 일몰까지 ${Math.floor((toMin(set) - m) / 60)}시간 ${(toMin(set) - m) % 60}분`
    }
  }
  const [x, y] = night ? [182, 12] : at(t)
  return (
    <div className="act-sun" aria-label={`일출 ${rise}, 일몰 ${set}`}>
      <svg viewBox="0 -14 260 88" width="100%" height="88" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* 해가 진 뒤: 보랏빛 크레용으로 쓱쓱 칠한 밤하늘과 별 */}
        {night && (
          <g className="act-night">
            <g stroke="#b7aee3" strokeWidth="13" opacity="0.78">
              <path d="M12 -6 C60 -12 120 -2 248 -8" />
              <path d="M6 7 C70 12 150 0 252 6" />
              <path d="M14 20 C80 14 160 25 246 17" />
              <path d="M8 33 C60 39 170 28 254 35" />
              <path d="M16 46 C90 41 150 52 244 45" />
              <path d="M10 58 C70 63 180 55 250 60" />
            </g>
            <g stroke="#222" strokeWidth="2.6" opacity="0.8">
              <path d="M52 2 l.1 0 M92 22 l.1 0 M214 28 l.1 0 M236 4 l.1 0 M34 40 l.1 0" />
            </g>
          </g>
        )}
        {/* 땅: 손으로 그은 삐뚤빼뚤한 선 */}
        <path d="M5 58 C24 55 44 61 78 57 C108 54 124 60 158 58 C190 56 222 61 255 56" stroke="#222" strokeWidth="2.4" />
        <path d="M70 64 q6 3 12 0 M176 65 q7 3 13 0" stroke="#222" strokeWidth="1.5" opacity="0.5" />
        {/* 해가 지나가는 길: 점선을 콕콕 찍은 듯 */}
        {!night && <path d="M29 38 C60 -16 200 -16 231 39" stroke="#222" strokeWidth="2.2" strokeDasharray="0.5 8" opacity="0.75" />}
        {/* 해가 진 뒤: 까만 빌딩 그림자와 켜진 창 */}
        {night && (
          <g>
            <g fill="#222" stroke="#222" strokeWidth="1.6">
              <path d="M14 58 L14 40 L27 39 L28 58Z" />
              <path d="M29 58 L30 24 L40 23 L41 58Z" />
              <path d="M42 58 L42 36 L56 37 L57 58Z" />
              <path d="M58 58 L58 14 L66 12 L68 58Z" />
              <path d="M69 58 L70 32 L84 31 L85 58Z" />
              <path d="M86 58 L86 38 L96 40 L97 58Z" />
              <path d="M98 58 L99 26 L112 25 L113 58Z" />
              <path d="M114 58 L114 42 L128 41 L129 58Z" />
              <path d="M130 58 L131 34 L140 33 L141 58Z" />
              <path d="M142 58 L142 44 L156 45 L157 58Z" />
              <path d="M158 58 L158 38 L168 37 L169 58Z" />
              <path d="M200 58 L200 40 L212 41 L213 58Z" />
              <path d="M214 58 L215 28 L226 27 L227 58Z" />
              <path d="M228 58 L228 42 L246 41 L247 58Z" />
              <path d="M62 12 V4 M105 25 V19" fill="none" />
            </g>
            <g stroke="#f2cf4a" strokeWidth="3" opacity="0.95">
              <path d="M34 32 l.1 0 M34 42 l.1 0 M62 24 l.1 0 M62 36 l.1 0 M62 48 l.1 0 M76 40 l.1 0 M104 34 l.1 0 M104 46 l.1 0 M135 42 l.1 0 M163 46 l.1 0 M220 36 l.1 0 M220 48 l.1 0 M235 50 l.1 0 M20 48 l.1 0" />
            </g>
          </g>
        )}
        {/* 땅에 반쯤 걸린 해: 뜰 때(노랑) / 질 때(주황) */}
        {!night && (
        <g>
          <path d="M17 58 C15 49 21 43 28 44 C35 44 41 50 39 58" fill="#f2cf4a" stroke="#222" strokeWidth="2.2" />
          <path d="M27 40 V36 M16 44 L12 42 M39 44 L43 41" stroke="#e8a24a" strokeWidth="2" />
          <path d="M221 58 C220 50 225 44 232 45 C240 45 244 51 242 58" fill="#e8a24a" stroke="#222" strokeWidth="2.2" />
          <path d="M232 41 V37 M221 45 L217 43 M243 45 L247 42" stroke="#e8a24a" strokeWidth="2" />
        </g>
        )}
        <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
          <g className="act-sunbody">
            {night ? (
              /* 달 */
              <g transform="scale(1.15)">
                <path d="M2 -13 C-9 -12 -14 2 -6 11 C1 17 12 13 14 6 C5 8 -3 -1 2 -13Z" fill="#f2cf4a" stroke="#222" strokeWidth="2.2" />
              </g>
            ) : (
              <g transform="scale(1.15)">
                {/* 동글납작한 얼굴, 점 눈, 작은 미소, 길이가 제각각인 햇살 */}
                <path d="M0 -10 C8 -11 12 -3 10 4 C7 12 -5 13 -10 6 C-13 -2 -8 -9 0 -10Z" fill="#f2cf4a" stroke="#222" strokeWidth="2.2" />
                <path d="M-4 -1 l.1 0 M4 -1.5 l.1 0" stroke="#222" strokeWidth="3" />
                <path d="M-3 4 Q0 7.5 3.5 3.5" stroke="#222" strokeWidth="1.8" />
                <path d="M1 -15 L0 -19 M-14 -3 L-18 -5 M15 -2 L19 -3 M-10 -12 L-13 -16 M11 -11 L15 -13 M-9 11 L-12 14 M10 11 L13 14" stroke="#e8a24a" strokeWidth="2" />
              </g>
            )}
          </g>
        </g>
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
