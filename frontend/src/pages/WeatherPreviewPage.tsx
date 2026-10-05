import { Link } from 'react-router-dom'
import { WeatherDoodle, weatherKinds } from '../components/DoodleWeather'
import StickPerson, { type Mood } from '../components/StickPerson'
import WeatherAmbience from '../components/WeatherAmbience'

// 기타 일정 제목 예시 -> 장면 (lib/eventMood.ts 의 키워드)
const OTHER_EXAMPLES: [string, Mood][] = [
  ['엄마 생일', 'birthday'],
  ['친구 결혼식', 'gift'],
  ['기념일 데이트', 'date'],
  ['팀 회식', 'drink'],
  ['콘서트', 'show'],
  ['풋살', 'sport'],
  ['한강 러닝', 'run'],
  ['저녁 약속', 'meal'],
  ['면접', 'work'],
  ['그 밖의 일정', 'trip'],
]

// 일정 종류별 그림
const KIND_EXAMPLES: [string, Mood][] = [
  ['여행', 'travel'],
  ['캠핑', 'camp'],
  ['등산', 'hike'],
  ['야외활동', 'outdoor'],
  ['예보 기다리는 중', 'wait'],
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
          <div key={w.kind} className={`box w${i % 4} cloth has-amb wx-preview`}>
            <WeatherAmbience kind={w.kind} />
            <WeatherDoodle kind={w.kind} size={96} animate />
            <div className="label">{w.label}</div>
          </div>
        ))}
      </div>
      <h2 style={{ marginTop: 24 }}>일정 종류 그림</h2>
      <div className="grid2">
        {KIND_EXAMPLES.map(([title, mood], i) => (
          <div key={mood} className={`box w${i % 4} cloth`}>
            <StickPerson mood={mood} size={110} />
            <div className="label">{title}</div>
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
