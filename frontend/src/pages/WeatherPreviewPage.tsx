import { Link } from 'react-router-dom'
import { WeatherDoodle, weatherKinds } from '../components/DoodleWeather'

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
    </main>
  )
}
