import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import IntroFigure from '../components/IntroFigure'
import { errorMessage } from '../api'
import { useAuth } from '../auth'
import HandText from '../components/HandText'
import KakaoLoginButton from '../components/KakaoLoginButton'
import { Bee, Cloud, Flower, Sun } from '../components/DoodleWeather'

type Provider = 'kakao' | 'guest'

export default function IntroPage() {
  const nav = useNavigate()
  const [beeMood, setBeeMood] = useState<'idle' | 'angry' | 'flee'>('idle')
  const taps = useRef(0)
  const { startGuest } = useAuth()
  const [starting, setStarting] = useState(false) // 게스트 시작 중에는 버튼을 눌러도 계정이 또 만들어지지 않게 잠근다
  const [error, setError] = useState(() => (new URLSearchParams(window.location.search).get('login') === 'failed' ? '로그인에 실패했어요. 다시 시도해주세요.' : ''))

  // 이스터에그: 벌을 누르면 화내거나 도망감
  const poke = () => {
    if (beeMood !== 'idle') return
    const next = taps.current++ % 2 === 0 ? 'angry' : 'flee'
    setBeeMood(next)
    window.setTimeout(() => setBeeMood('idle'), next === 'angry' ? 1600 : 3300)
  }

  // 카카오: 백엔드가 카카오 로그인 후 /home 으로 돌려보낸다. 게스트: 서버에 임시 계정을 만든다.
  const enter = async (provider: Provider) => {
    setError('')
    if (provider === 'kakao') {
      window.location.href = '/api/auth/kakao'
      return
    }
    if (starting) return
    setStarting(true)
    try {
      await startGuest()
      nav('/home')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setStarting(false)
    }
  }

  return (
    <main className="intro">
      <span className="corner" style={{ top: 6, right: 4 }}>
        <Sun />
      </span>
      <span className="corner" style={{ top: 60, left: 0 }}>
        <Cloud />
      </span>

      <div style={{ marginTop: 40 }}>
        <h1 className="hello">
          <HandText>뭐입을옷?</HandText>
        </h1>
        <IntroFigure size={200} />
      </div>

      <div className="login-list ready">
        <KakaoLoginButton onClick={() => void enter('kakao')} />
        <button type="button" className="guest-link" disabled={starting} onClick={() => void enter('guest')}>
          <HandText>{starting ? '시작하는 중…' : '로그인 없이 둘러보기'}</HandText>
        </button>
        {error && <p className="tiny" role="alert">{error}</p>}
        <p className="tiny consent-note">
          시작하면 <Link to="/terms">이용약관</Link>과 <Link to="/privacy">개인정보처리방침</Link>에 동의한 것으로 봐요. 만 14세 이상만 쓸 수 있어요.
        </p>
      </div>

      <div className="bee-lane" aria-hidden="true">
        <div className="bee-fly">
          <div className="bee-flip">
            <div className="bee-wob">
              <button type="button" className="bee-hit" onClick={poke} aria-label="벌">
                <span className={`bee-react ${beeMood}`}>
                  <Bee size={34} />
                </span>
              </button>
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
