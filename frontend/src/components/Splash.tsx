import { useEffect, useState } from 'react'
import WakeScene from './WakeScene'

/**
 * 첫 로딩 화면. 서버가 잠들어 있다 깨어나는 동안(최대 1분) 빈 화면 대신 보여준다.
 * 몇 초가 지나도 안 열리면 "서버가 깨어나는 중"이라고 알려 줘서 고장으로 오해하지 않게 한다.
 */
export default function Splash() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 3500)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <main className="splash" role="status" aria-live="polite">
      <WakeScene />
      <p className="tiny splash-note">{slow ? '서버가 잠에서 깨어나는 중이에요. 처음에는 조금 걸릴 수 있어요 (최대 1분).' : '불러오는 중…'}</p>
    </main>
  )
}
