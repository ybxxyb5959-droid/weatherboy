import { useEffect, useState } from 'react'
import { api, errorMessage } from '../api'
import { GeoError, getPosition } from '../lib/geo'
import { enablePush, getPushState, pushSupported } from '../lib/push'
import DoodleButton from './DoodleButton'
import HandText from './HandText'
import { Pin } from './icons'

const DONE_KEY = 'firstRunPromptDone'
const LOC_KEY = 'firstRunLocationDone'

// 위치를 정하면 홈이 다시 불러와지며 이 카드도 새로 그려지므로, 진행 상태를 저장해 둔다
function flag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function setFlag(key: string) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* 저장 못 해도 이번 화면에서만 반영한다 */
  }
}

interface Reverse {
  name: string
  sido: string
  district: string | null
  latitude: number
  longitude: number
}

/**
 * 처음 홈에 들어왔을 때 한 번 보이는 안내: 위치 허용 / 알림 허용.
 * 허용하지 않아도 되고, 나중에 설정 화면에서 언제든 정할 수 있다.
 */
export default function FirstRunPrompt({ onLocationSet }: { onLocationSet: () => void }) {
  const [hidden, setHidden] = useState(() => flag(DONE_KEY))
  const [locDone, setLocDone] = useState(() => flag(LOC_KEY))
  const [pushDone, setPushDone] = useState(false)
  const [busy, setBusy] = useState<'' | 'loc' | 'push'>('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (hidden) return
    void getPushState().then((s) => setPushDone(s === 'on' || s === 'unsupported'))
  }, [hidden])

  const close = () => {
    setFlag(DONE_KEY)
    setHidden(true)
  }

  const askLocation = async () => {
    setBusy('loc')
    setNote('')
    try {
      const pos = await getPosition() // 위치 허용 팝업
      const r = await api<Reverse>('GET', `/api/places/reverse?lat=${pos.lat}&lng=${pos.lng}`)
      await api('PUT', '/api/settings', {
        location: r.name,
        place: { latitude: r.latitude, longitude: r.longitude, regionSido: r.sido, regionDistrict: r.district },
      })
      setFlag(LOC_KEY)
      setLocDone(true)
      onLocationSet()
    } catch (e) {
      setNote(e instanceof GeoError ? `${e.message} (설정에서 나중에 정할 수 있어요)` : errorMessage(e))
    } finally {
      setBusy('')
    }
  }

  const askPush = async () => {
    setBusy('push')
    setNote('')
    const r = await enablePush() // 알림 허용 팝업
    if (r === 'enabled') setPushDone(true)
    else if (r === 'denied') setNote('알림을 허용하지 않았어요. 설정에서 나중에 켤 수 있어요.')
    else if (r === 'no-server-key') setNote('서버에 알림 설정이 아직 없어요.')
    else setNote('알림을 켜지 못했어요. 설정에서 다시 시도해주세요.')
    setBusy('')
  }

  if (hidden) return null
  const allDone = locDone && (pushDone || !pushSupported())

  return (
    <section className="section first-run">
      <h2>처음 오셨네요!</h2>
      <p className="tiny">허용하면 더 정확해져요. 지금 안 해도 설정에서 언제든 할 수 있어요.</p>
      <div className="col" style={{ marginTop: 10 }}>
        {!locDone && (
          <DoodleButton seed={1} className="block" disabled={busy !== ''} onClick={() => void askLocation()}>
            <Pin />
            <HandText>{busy === 'loc' ? '위치 찾는 중…' : '내 위치로 날씨 보기'}</HandText>
          </DoodleButton>
        )}
        {!pushDone && pushSupported() && (
          <DoodleButton seed={2} className="block" disabled={busy !== ''} onClick={() => void askPush()}>
            <HandText>{busy === 'push' ? '잠시만요…' : '휴대폰 알림 받기'}</HandText>
          </DoodleButton>
        )}
        {note && (
          <p className="tiny" role="alert">
            {note}
          </p>
        )}
        <div style={{ textAlign: 'center' }}>
          <button type="button" className="guest-link" onClick={close}>
            {allDone ? '닫기' : '나중에 할게'}
          </button>
        </div>
      </div>
    </section>
  )
}
