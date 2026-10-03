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

// 먼저 GPS 로 정확하게 찾고(동네가 엉뚱하게 잡히는 걸 줄인다), 시간이 걸리거나 실내라 못 찾으면 기지국·와이파이 위치로 다시 찾는다.
export async function getPosition(): Promise<Position> {
  try {
    return await locate(true, 8_000)
  } catch (e) {
    if (e instanceof GeoError && (e.reason === 'denied' || e.reason === 'unsupported')) throw e
    return locate(false, 10_000)
  }
}

function locate(precise: boolean, timeout: number): Promise<Position> {
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
      // 정확하게 찾을 땐 1분 안의 위치만 다시 쓴다(이동 중이면 예전 위치가 남지 않게)
      { enableHighAccuracy: precise, timeout, maximumAge: precise ? 60_000 : 5 * 60_000 },
    )
  })
}
