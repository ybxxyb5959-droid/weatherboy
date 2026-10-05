import SunBar from './SunBar'
import type { EventDayActivity } from '../types'

// 야외활동 점수 카드 (초안): 러닝·등산 같은 활동은 기능성 운동복을 입으니 옷 대신 "밖에서 움직이기 좋은 날씨인가"를 보여준다.
//  - 손으로 그린 반원 게이지: 오늘의 종합 점수(0~100)
//  - 요인 막대 4개: 기온 · 비 · 바람 · 미세먼지 (낙서 느낌의 줄무늬 막대)
//  - 일출·일몰: 해가 떠 있는 시간(밖에서 움직일 수 있는 밝은 때)

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
const dayLabel = (date: string) => {
  const [, m, d] = date.split('-').map(Number)
  return `${m}/${d} (${WEEKDAY[new Date(`${date}T00:00:00`).getDay()]})`
}

/** 점수 색: 좋음(청록) / 보통(노랑) / 별로(주황) / 나쁨(빨강). 디자인 팔레트 그대로 */
const tone = (score: number) => (score >= 65 ? '#4aa6a0' : score >= 45 ? '#f2cf4a' : score >= 25 ? '#e8a24a' : '#e05a5a')

const FACTORS = [
  ['temp', '기온'],
  ['rain', '비'],
  ['wind', '바람'],
  ['air', '미세먼지'],
] as const
/** 손으로 그린 듯한 반원 게이지 */
function Gauge({ score }: { score: number }) {
  const color = tone(score)
  return (
    <svg className="act-gauge" viewBox="0 0 120 74" width="132" height="81" fill="none" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={`야외활동 점수 ${score}점`}>
      {/* 바깥 윤곽(살짝 삐뚤게)과 칸 눈금 */}
      <path d="M8 64 C6 30 34 6 60 6 C88 6 114 30 112 64" stroke="#222" strokeWidth="2.4" />
      <path d="M20 64 C20 38 40 18 60 18 C82 18 100 38 100 64" stroke="#222" strokeWidth="2" opacity="0.85" />
      <path d="M8 64 H20 M100 64 H112" stroke="#222" strokeWidth="2.4" />
      {/* 채워지는 호: 점수만큼 */}
      <path className="act-arc" d="M14 64 C14 33 36 12 60 12 C84 12 106 33 106 64" stroke={color} strokeWidth="7" pathLength="100" strokeDasharray={`${Math.max(score, 1)} 100`} />
      <g stroke="#222" strokeWidth="1.6">
        <path d="M60 3 V0 M31 11 L29 8 M89 11 L91 8" />
      </g>
    </svg>
  )
}

function Day({ d, index }: { d: EventDayActivity; index: number }) {
  return (
    <div className={`box w${(index % 3) + 1} act-day`} style={{ ['--i' as string]: index }}>
      <div className="ev-day-head">
        <b>{dayLabel(d.date)}</b>
        <span className="tiny">{d.label}</span>
      </div>

      <div className="act-top">
        <div className="act-meter">
          <Gauge score={d.score} />
          <div className="act-num" style={{ color: d.score >= 25 ? undefined : '#e05a5a' }}>
            {d.score}
            <span>점</span>
          </div>
        </div>
        <div className="act-factors">
          {FACTORS.map(([key, name]) => {
            const f = d.factors[key]
            return (
              <div key={key} className="act-row">
                <span className="act-name">{name}</span>
                <span className="act-track" aria-hidden="true">
                  {f.score != null && <span className="act-fill" style={{ width: `${Math.max(f.score, 4)}%`, ['--c' as string]: tone(f.score) }} />}
                </span>
                <span className="act-val tiny">{f.value}</span>
              </div>
            )
          })}
        </div>
      </div>

      {d.sun && <SunBar rise={d.sun.rise} set={d.sun.set} />}

      <p className="tiny act-tip">{d.tip}</p>
    </div>
  )
}

export default function ActivityScore({ days }: { days: EventDayActivity[]; approx?: boolean }) {
  return (
    <section className="section">
      <h2>야외활동 점수</h2>
      <div className="act-days">
        {days.map((d, i) => (
          <Day key={d.date} d={d} index={i} />
        ))}
      </div>
    </section>
  )
}
