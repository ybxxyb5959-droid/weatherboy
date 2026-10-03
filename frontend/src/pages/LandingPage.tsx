import { Navigate, useNavigate } from 'react-router-dom'
import HandText from '../components/HandText'
import GreetingFigure from '../components/GreetingFigure'
import GearDoodles from '../components/GearDoodles'
import { ClosetScene } from '../components/Clothesline'
import { Bee, Cloud, Flower, Sun, WeatherDoodle } from '../components/DoodleWeather'
import { helpText, useInstallAction } from '../lib/useInstallAction'

export default function LandingPage() {
  const nav = useNavigate()
  const { install, installed, hint, helpOpen, setHelpOpen } = useInstallAction()

  // 카카오 로그인 실패 등으로 /?login=... 로 돌아온 경우엔 로그인 화면으로 보낸다
  const search = window.location.search
  if (new URLSearchParams(search).has('login')) return <Navigate to={`/start${search}`} replace />

  return (
    <main className="landing">
      <span className="corner" style={{ top: 6, right: 4 }}>
        <Sun />
      </span>
      <span className="corner" style={{ top: 60, left: 0 }}>
        <Cloud />
      </span>

      <section className="landing-hero">
        <h1 className="landing-title">
          <HandText>뭐입을옷?</HandText>
        </h1>
        <GreetingFigure size={210} />
        <p className="lead">
          <span className="lead-line">
            <HandText>안녕하세요.</HandText>
          </span>
          <span className="lead-line">
            <HandText>제가 앱을 하나 생각을 해봤는데요.</HandText>
          </span>
          <span className="lead-line">
            <HandText>한번 사용해봐주세요 ^_^</HandText>
          </span>
        </p>
        <div className="landing-actions">
          <button type="button" className="dbtn block w1" onClick={() => void install()}>
            {installed ? '설치됐어요! 홈 화면에서 열어주세요' : '앱으로 설치하고 테스트해주기'}
          </button>
          {hint && (
            <p className="tiny install-hint" role="status">
              {hint}
            </p>
          )}
          <button type="button" className="guest-link" onClick={() => nav('/tour')}>
            <HandText>설치 없이 웹에서 미리볼래요</HandText>
          </button>
        </div>
      </section>

      <hr className="scribble" />

      <section>
        <h2>
          <HandText>이런 앱이에요</HandText>
        </h2>
        <ul className="feat-grid">
          <li className="box feat w1">
            <WeatherDoodle kind="rain" size={52} />
            <h3>날씨 맞춤 추천</h3>
            <p className="tiny">기온, 비, 미세먼지까지 보고 입을 옷을 골라줘요.</p>
          </li>
          <li className="box feat w2">
            <ClosetScene />
            <h3>내 옷장</h3>
            <p className="tiny">가진 옷을 등록하면 그 옷으로 코디를 짜줘요.</p>
          </li>
          <li className="box feat w3">
            <WeatherDoodle kind="clear" size={52} />
            <h3>일정등록과 코디</h3>
            <p className="tiny">약속 날짜와 장소를 넣으면 저장하고 브리핑 해줘요.</p>
          </li>
          <li className="box feat feat-gear w1">
            <GearDoodles items={['umbrella', 'mask', 'sunscreen']} />
            <h3>준비물 알림</h3>
            <p className="tiny">우산, 마스크, 선크림이 필요한 날을 알려줘요.</p>
          </li>
        </ul>
      </section>

      <hr className="scribble" />

      <section>
        <h2>
          <HandText>앱처럼 설치해요</HandText>
        </h2>
        <ol className="steps">
          <li>위의 "앱으로 설치하고 테스트해주기"를 눌러요.</li>
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

      <hr className="scribble" />

      <section className="thanks">
        <p>
          <HandText>사용 후에 후기를 남겨주시면</HandText>
        </p>
        <p>
          <HandText>추후에 더 나은 서비스로 찾아뵙겠습니다 ^__^</HandText>
        </p>
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
