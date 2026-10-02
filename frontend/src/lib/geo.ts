// 현재 위치 받기. 호출하면 브라우저/앱이 "위치 사용을 허용할까요?" 팝업을 띄운다(사용자의 클릭 안에서 호출).
export interface Position {
  lat: number
  lng: number
}

export class GeoError extends Error {
  reason: 'unsupported' | 'denied' | 'unavailable' | 'timeout'
  constructor(reason: GeoError['reason'], message: string) {
    super(message)
    this.reason = reason
  }
}

export function getPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new GeoError('unsupported', '이 기기에서는 현재 위치를 사용할 수 없어요.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => {
        if (e.code === e.PERMISSION_DENIED) reject(new GeoError('denied', '위치 사용이 허용되지 않았어요. 기기(브라우저) 설정에서 위치를 허용하거나, 지역을 직접 검색해주세요.'))
        else if (e.code === e.TIMEOUT) reject(new GeoError('timeout', '위치를 찾는 데 시간이 너무 오래 걸려요. 잠시 뒤 다시 시도해주세요.'))
        else reject(new GeoError('unavailable', '현재 위치를 알 수 없어요. 지역을 직접 검색해주세요.'))
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    )
  })
}
