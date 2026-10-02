import { useState } from 'react'
import { api, errorMessage } from '../api'
import { useAuth } from '../auth'
import { GeoError, getPosition } from '../lib/geo'
import DoodleButton from './DoodleButton'
import HandText from './HandText'
import { MapScene } from './GateScenes'
import { Pin } from './icons'

interface Reverse {
  name: string
  sido: string
  district: string | null
  latitude: number
  longitude: number
}

const key = (id: string) => `locationAsked:${id}`

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

/**
 * 로그인(카카오/게스트) 직후 처음 홈에 들어올 때, 다른 화면보다 먼저 위치 허용을 묻는다.
 * 허용하면 현재 위치를 내 지역으로 저장하고 홈을 보여준다. 거절/건너뛰기해도 홈으로 가며, 설정에서 나중에 정할 수 있다.
 */
export default function LocationGate({ children }: { children: React.ReactNode }) {
  const { me } = useAuth()
  const [passed, setPassed] = useState(() => (me ? asked(me.id) : true))
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  if (!me || passed) return <>{children}</>

  const pass = () => {
    markAsked(me.id)
    setPassed(true)
  }

  const allow = async () => {
    setBusy(true)
    setNote('')
    try {
      const pos = await getPosition() // 위치 허용 팝업
      const r = await api<Reverse>('GET', `/api/places/reverse?lat=${pos.lat}&lng=${pos.lng}`)
      await api('PUT', '/api/settings', {
        location: r.name,
        place: { latitude: r.latitude, longitude: r.longitude, regionSido: r.sido, regionDistrict: r.district },
      })
      pass()
    } catch (e) {
      setNote(e instanceof GeoError ? `${e.message} (설정에서 나중에 정할 수 있어요)` : errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <main className="home location-gate">
      <div className="empty">
        <MapScene />
        <h2>내 위치의 날씨를 알려드릴게요.</h2>
        <p className="tiny">위치를 허용하면 지금 있는 곳의 날씨에 맞춰 옷을 추천해 드려요.</p>
        <DoodleButton seed={1} className="block" disabled={busy} onClick={() => void allow()}>
          <Pin />
          <HandText>{busy ? '위치 찾는 중…' : '위치 허용하기'}</HandText>
        </DoodleButton>
        {note && (
          <p className="tiny" role="alert">
            {note}
          </p>
        )}
        <button type="button" className="guest-link" disabled={busy} onClick={pass}>
          <HandText>{note ? '지역은 나중에 정할게요' : '나중에 할게요'}</HandText>
        </button>
      </div>
    </main>
  )
}
