import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { enablePush, getPushState } from '../lib/push'
import DoodleButton from './DoodleButton'
import HandText from './HandText'
import { BellScene } from './GateScenes'

const key = (id: string) => `notifyAsked:${id}`

function asked(id: string): boolean {
  try {
    return localStorage.getItem(key(id)) === '1'
  } catch {
    return false
  }
}

function markAsked(id: string) {
  try {
    localStorage.setItem(key(id), '1')
  } catch {
    /* 저장 못 해도 이번 화면에서만 넘어간다 */
  }
}

// 아이폰은 사파리 탭에서는 알림이 안 되고, 홈 화면에 추가한 앱에서만 된다
const needsInstallOnIos = () => {
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua)
  const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  return ios && !installed
}

/**
 * 위치 허용 다음, 홈에 들어가기 전에 알림 허용을 한 번 묻는다. 허용하든 나중에 하든 홈으로 가며, 설정에서 언제든 바꿀 수 있다.
 * 이미 허용/차단했거나 알림을 쓸 수 없는 기기면 묻지 않고 넘어간다(아이폰 사파리는 홈 화면에 추가하라고 안내).
 */
export default function NotifyGate({ children }: { children: ReactNode }) {
  const { me } = useAuth()
  const [step, setStep] = useState<'checking' | 'ask' | 'ios' | 'done'>(() => (!me || asked(me.id) ? 'done' : 'checking'))
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (step !== 'checking') return
    let live = true
    void (async () => {
      // 서버에 알림 키가 없으면(알림을 끈 배포) 알림 허용 화면을 아예 보여주지 않는다
      const hasKey = await api<{ publicKey: string | null }>('GET', '/api/push/public-key').then((r) => !!r.publicKey, () => true)
      const s = await getPushState()
      if (!live) return
      if (!hasKey || s === 'on' || s === 'denied') setStep('done')
      else if (s === 'unsupported') setStep(needsInstallOnIos() ? 'ios' : 'done')
      else setStep('ask')
    })()
    return () => {
      live = false
    }
  }, [step])

  if (!me || step === 'done') return <>{children}</>
  if (step === 'checking') return null

  const pass = () => {
    markAsked(me.id)
    setStep('done')
  }

  const allow = async () => {
    setBusy(true)
    setNote('')
    const r = await enablePush() // 알림 허용 팝업
    if (r === 'enabled') {
      pass()
      return
    }
    setNote(
      r === 'denied'
        ? '알림이 허용되지 않았어요. 나중에 설정에서 켤 수 있어요.'
        : r === 'no-server-key'
          ? '서버에 알림 설정이 아직 없어요. 나중에 설정에서 켤 수 있어요.'
          : '알림을 켜지 못했어요. 나중에 설정에서 다시 시도해주세요.',
    )
    setBusy(false)
  }

  return (
    <main className="home location-gate">
      <div className="empty">
        <BellScene />
        {step === 'ios' ? (
          <>
            <h2>홈 화면에 추가하면 알림을 받을 수 있어요.</h2>
            <p className="tiny">사파리 아래의 공유 버튼을 누르고 "홈 화면에 추가"를 선택해주세요. 추가한 앱에서 알림을 켤 수 있어요.</p>
            <DoodleButton seed={1} className="block" onClick={pass}>
              <HandText>확인했어요</HandText>
            </DoodleButton>
          </>
        ) : (
          <>
            <h2>알림을 보내드릴게요.</h2>
            <p className="tiny">아침 옷차림, 비 올 때, 일정 날씨를 알려드려요. 설정에서 종류별로 끌 수 있어요.</p>
            <DoodleButton seed={1} className="block" disabled={busy} onClick={() => void allow()}>
              <HandText>{busy ? '잠시만요…' : '알림 허용하기'}</HandText>
            </DoodleButton>
            {note && (
              <p className="tiny" role="alert">
                {note}
              </p>
            )}
            <button type="button" className="guest-link" disabled={busy} onClick={pass}>
              <HandText>{note ? '알림은 나중에 켤게요' : '나중에 할게요'}</HandText>
            </button>
          </>
        )}
      </div>
    </main>
  )
}
