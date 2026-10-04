import { useEffect, useState } from 'react'
import { api, errorMessage } from '../api'
import { disablePush, enablePush, getPushState } from '../lib/push'
import type { PushState } from '../lib/push'
import DoodleButton from './DoodleButton'

const MESSAGES: Record<PushState, string> = {
  unsupported: '이 기기(브라우저)는 알림을 지원하지 않아요. iPhone은 홈 화면에 추가한 뒤에 사용할 수 있어요.',
  denied: '알림이 차단돼 있어요. 기기(브라우저) 설정에서 이 앱의 알림을 허용해주세요.',
  ask: '휴대폰 알림을 받으려면 허용이 필요해요.',
  off: '알림은 허용했지만 아직 받도록 설정하지 않았어요.',
  on: '휴대폰 알림이 켜져 있어요.',
}

/** 휴대폰 알림 허용 상태 + 허용/해제 버튼. 허용하기를 누르면 알림 허용 팝업이 뜬다. */
export default function PushToggle({ onChange }: { onChange?: (s: PushState) => void }) {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const refresh = async () => {
    const s = await getPushState()
    setState(s)
    onChange?.(s)
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const turnOn = async () => {
    setBusy(true)
    setNote('')
    const r = await enablePush()
    if (r === 'no-server-key') setNote('서버에 알림 설정이 아직 없어요.')
    else if (r === 'failed') setNote('알림을 켜지 못했어요. 잠시 뒤 다시 시도해주세요.')
    await refresh()
    setBusy(false)
  }

  const turnOff = async () => {
    setBusy(true)
    await disablePush()
    await refresh()
    setBusy(false)
  }

  // 내 기기로 시험 알림 1건을 바로 보낸다
  const sendTest = async () => {
    setBusy(true)
    setNote('')
    try {
      const r = await api<{ outcome: string }>('POST', '/api/push/test')
      if (r.outcome === 'SENT') setNote('시험 알림을 보냈어요. 잠시 뒤 알림이 오는지 확인해주세요.')
      else if (r.outcome === 'NOT_CONFIGURED') setNote('서버에 알림 설정이 아직 없어요.')
      else if (r.outcome === 'NO_SUBSCRIPTION') setNote('이 계정에 등록된 기기가 없어요. 알림을 껐다가 다시 허용해주세요.')
      else setNote('알림을 보내지 못했어요. 잠시 뒤 다시 시도해주세요.')
    } catch (e) {
      setNote(errorMessage(e))
    }
    setBusy(false)
  }

  if (!state) return null
  return (
    <div className="push-toggle">
      <p className="tiny">{MESSAGES[state]}</p>
      {(state === 'ask' || state === 'off') && (
        <DoodleButton seed={2} className="small" disabled={busy} onClick={() => void turnOn()}>
          {busy ? '잠시만요…' : '휴대폰 알림 허용하기'}
        </DoodleButton>
      )}
      {state === 'on' && (
        <div className="row wrap">
          <DoodleButton seed={1} className="small" disabled={busy} onClick={() => void sendTest()}>
            {busy ? '잠시만요…' : '알림 시험 보내기'}
          </DoodleButton>
          <DoodleButton seed={0} className="small" disabled={busy} onClick={() => void turnOff()}>
            휴대폰 알림 끄기
          </DoodleButton>
        </div>
      )}
      {note && <p className="tiny" role="alert">{note}</p>}
    </div>
  )
}
