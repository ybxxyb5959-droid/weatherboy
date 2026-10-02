import { useState } from 'react'
import { api, errorMessage } from '../api'
import { getPosition, GeoError } from '../lib/geo'
import DoodleButton from './DoodleButton'
import HandText from './HandText'
import { Pin } from './icons'
import PlaceInput from './PlaceInput'

export interface PickedPlace {
  name: string
  /** 현재 위치로 찾은 경우의 좌표/지역 (서버가 다시 검색하지 않고 그대로 쓴다) */
  place?: { latitude: number; longitude: number; regionSido: string; regionDistrict: string | null }
  fromGps?: boolean
}

interface Reverse {
  name: string
  sido: string
  district: string | null
  latitude: number
  longitude: number
}

/**
 * 위치 정하기: [현재 위치로 찾기] 누르면 위치 허용 팝업 -> 좌표 -> 지역 이름.
 * 허용하지 않거나 실패하면 아래 검색창으로 직접 고를 수 있다.
 */
export default function LocationPicker({ onPick }: { onPick: (p: PickedPlace) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const useCurrent = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const pos = await getPosition() // <- 여기서 위치 허용 팝업이 뜬다
      const r = await api<Reverse>('GET', `/api/places/reverse?lat=${pos.lat}&lng=${pos.lng}`)
      onPick({ name: r.name, fromGps: true, place: { latitude: r.latitude, longitude: r.longitude, regionSido: r.sido, regionDistrict: r.district } })
    } catch (e) {
      setError(e instanceof GeoError ? e.message : errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="picker">
      <DoodleButton seed={1} className="block picker-gps" disabled={busy} onClick={() => void useCurrent()}>
        <Pin />
        <HandText>{busy ? '위치 찾는 중…' : '현재 위치로 찾기'}</HandText>
      </DoodleButton>
      {error && (
        <p className="tiny" role="alert" style={{ marginTop: 6 }}>
          {error}
        </p>
      )}
      <div className="picker-or tiny">또는 직접 검색</div>
      <PlaceInput onSelect={(name) => onPick({ name })} />
    </div>
  )
}
