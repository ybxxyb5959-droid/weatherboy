import { Link } from 'react-router-dom'
import { WeatherDoodle, weatherKinds } from '../components/DoodleWeather'
import StickPerson, { type Mood } from '../components/StickPerson'

// 기타 일정 제목 예시 -> 장면 (lib/eventMood.ts 의 키워드)
const OTHER_EXAMPLES: [string, Mood][] = [
  ['엄마 생일', 'birthday'],
  ['친구 결혼식', 'gift'],
  ['기념일 데이트', 'date'],
  ['팀 회식', 'drink'],
  ['콘서트', 'show'],
  ['풋살', 'sport'],
  ['저녁 약속', 'meal'],
  ['면접', 'work'],
  ['그 밖의 일정', 'trip'],
]

// 날씨 낙서 미리보기 (개발용): /weather
export default function WeatherPreviewPage() {
  return (
    <main>
      <div className="page-head">
        <h1>날씨 낙서</h1>
        <Link to="/home" className="dbtn w1 small">
          홈으로
        </Link>
      </div>
      <div className="grid2">
        {weatherKinds.map((w, i) => (
          <div key={w.kind} className={`box w${i % 4} cloth`}>
            <WeatherDoodle kind={w.kind} size={96} />
            <div className="label">{w.label}</div>
          </div>
        ))}
      </div>
      <h2 style={{ marginTop: 24 }}>기타 일정 그림</h2>
      <div className="grid2">
        {OTHER_EXAMPLES.map(([title, mood], i) => (
          <div key={mood} className={`box w${i % 4} cloth`}>
            <StickPerson mood={mood} size={110} />
            <div className="label">{title}</div>
          </div>
        ))}
      </div>
    </main>
  )
}
