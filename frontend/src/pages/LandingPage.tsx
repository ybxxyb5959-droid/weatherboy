import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import HandText from '../components/HandText'
import IntroFigure from '../components/IntroFigure'
import { Bee, Cloud, Flower, Sun, WeatherDoodle } from '../components/DoodleWeather'
import type { WeatherKind } from '../components/DoodleWeather'
import { detectPlatform, openInExternalBrowser, useInstall } from '../lib/install'

const features: { kind: WeatherKind; title: string; body: string }[] = [
  { kind: 'rain', title: '날씨 맞춤 추천', body: '기온, 비, 미세먼지까지 보고 입을 옷을 골라줘요.' },
  { kind: 'partly', title: '내 옷장', body: '가진 옷을 등록하면 그 옷으로 코디를 짜줘요.' },
  { kind: 'clear', title: '일정별 코디', body: '약속 날짜와 장소를 넣으면 그날 날씨로 알려줘요.' },
  { kind: 'snow', title: '준비물 알림', body: '우산, 마스크, 선크림이 필요한 날을 알려줘요.' },
]

// 설치가 바로 안 될 때 보여 줄 안내
const helpText: Record<'kakao' | 'ios' | 'android' | 'other', string> = {
  kakao: '카카오톡 안에서는 설치할 수 없어요. 오른쪽 아래 ⋮(또는 공유) 버튼을 눌러 "다른 브라우저로 열기"를 한 뒤 다시 눌러주세요.',
  ios: '아이폰은 사파리에서 하단의 공유 버튼(네모에 화살표)을 누르고 "홈 화면에 추가"를 눌러주세요.',
  android: '크롬 오른쪽 위 ⋮ 메뉴에서 "홈 화면에 추가"(또는 "앱 설치")를 눌러주세요.',
  other: '크롬이나 엣지 주소창 오른쪽의 설치 아이콘을 누르거나, 메뉴에서 "앱 설치"를 눌러주세요.',
}

export default function LandingPage() {
  const nav = useNavigate()
  const { canPrompt, installed, prompt } = useInstall()
  const [hint, setHint] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)

  // 카카오 로그인 실패 등으로 /?login=... 로 돌아온 경우엔 로그인 화면으로 보낸다
  const search = window.location.search
  if (new URLSearchParams(search).has('login')) return <Navigate to={`/start${search}`} replace />

  const install = async () => {
    setHint('')
    const platform = detectPlatform()
    if (platform === 'kakao') {
      setHint(helpText.kakao)
      openInExternalBrowser()
      return
    }
    if (canPrompt) {
      const ok = await prompt()
      if (!ok) setHint('설치를 취소했어요. 필요하면 다시 눌러주세요.')
      return
    }
    // 바로 설치 창을 띄울 수 없는 환경(아이폰, 이미 설치됨 등): 방법을 안내한다
    setHint(helpText[platform])
    setHelpOpen(true)
  }

  return (
    <main className="landing">
      <span className="corner" style={{ top: 6, right: 4 }}>
        <Sun />
      </span>
      <span className="corner" style={{ top: 60, left: 0 }}>
        <Cloud />
      </span>

      <section className="landing-hero">
        <p className="tiny">날씨 · 옷장 · 일정으로 고르는</p>
        <h1 className="landing-title">
          <HandText>뭐입을옷?</HandText>
        </h1>
        <IntroFigure size={190} />
        <p className="lead">
          <HandText>오늘 뭐 입지? 고민은 이제 그만! 날씨랑 내 옷장을 보고 입을 옷을 골라줘요.</HandText>
        </p>
        <div className="landing-actions">
          <button type="button" className="dbtn block w1" onClick={() => void install()}>
            {installed ? '설치됐어요! 홈 화면에서 열어주세요' : '앱으로 설치하고 시작하기'}
          </button>
          <button type="button" className="dbtn block w2" onClick={() => nav('/start')}>
            웹에서 둘러보기
          </button>
          {hint && (
            <p className="tiny install-hint" role="status">
              {hint}
            </p>
          )}
        </div>
      </section>

      <hr className="scribble" />

      <section>
        <h2>
          <HandText>이런 앱이에요</HandText>
        </h2>
        <ul className="feat-grid">
          {features.map((f, i) => (
            <li key={f.title} className={`box feat w${(i % 3) + 1}`}>
              <WeatherDoodle kind={f.kind} size={52} />
              <h3>{f.title}</h3>
              <p className="tiny">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <hr className="scribble" />

      <section>
        <h2>
          <HandText>앱처럼 설치해요</HandText>
        </h2>
        <ol className="steps">
          <li>위의 "앱으로 설치하고 시작하기"를 눌러요.</li>
          <li>나오는 창에서 "설치"(또는 "추가")를 눌러요.</li>
          <li>홈 화면에 생긴 뭐입을옷? 아이콘으로 열어요.</li>
        </ol>
        <p className="tiny">앱스토어 없이도 설치되고, 용량도 거의 차지하지 않아요.</p>

        <details className="install-help" open={helpOpen} onToggle={(e) => setHelpOpen(e.currentTarget.open)}>
          <summary>설치가 안 되나요?</summary>
          <dl>
            <dt>안드로이드</dt>
            <dd>{helpText.android}</dd>
            <dt>아이폰</dt>
            <dd>{helpText.ios}</dd>
            <dt>카카오톡으로 열었다면</dt>
            <dd>{helpText.kakao}</dd>
          </dl>
        </details>
      </section>

      <footer className="landing-foot tiny">
        <p>뭐입을옷? · 문의 ybxxyb5959@gmail.com</p>
      </footer>

      <div className="bee-lane" aria-hidden="true">
        <div className="bee-fly">
          <div className="bee-flip">
            <div className="bee-wob">
              <Bee size={30} />
            </div>
          </div>
        </div>
      </div>
      <span className="corner" style={{ bottom: 6, right: 12 }}>
        <Flower size={40} />
      </span>
    </main>
  )
}
