// 실제 확보한 기상 데이터에서 근거가 있는 WeatherKind 만 산출한다.
// 단기예보에는 낙뢰/안개/자외선/태풍 정보가 없으므로 thunder, fog, uv, typhoon 은 생성하지 않는다.
import { toKstParts } from '../../utils/time.js'
import type { HourlyForecast } from './types.js'

export type WeatherKind =
  | 'clear' | 'cloudy' | 'partly' | 'rain' | 'thunder' | 'snow' | 'windy' | 'dust' | 'fog' | 'heat' | 'cold'
  | 'shower' | 'sleet' | 'range' | 'uv' | 'frost' | 'typhoon' | 'night'

// MVP Draft 임계값
export const conditionConfig = {
  heatFeels: 33, // 체감 33℃ 이상 폭염
  coldTemp: -12, // 기온 -12℃ 이하 한파
  windyMs: 9, // 풍속 9m/s 이상
  rangeDiff: 10, // 일교차 10℃ 이상
  frostTemp: 0, // 0℃ 이하(강수 없음)
  dustGrade: 3, // 나쁨 이상
}

export interface ConditionInput {
  now: Date
  current: HourlyForecast
  feels: number
  tempMin: number | null
  tempMax: number | null
  dustGrade: number | null
}

export function deriveCondition(i: ConditionInput): { condition: WeatherKind; flags: WeatherKind[] } {
  const c = conditionConfig
  const flags: WeatherKind[] = []
  const wet = i.current.precip !== 'none'
  if (i.feels >= c.heatFeels) flags.push('heat')
  if (i.current.temp <= c.coldTemp) flags.push('cold')
  if (i.current.wind >= c.windyMs) flags.push('windy')
  if (i.dustGrade != null && i.dustGrade >= c.dustGrade) flags.push('dust')
  if (!wet && i.current.temp <= c.frostTemp) flags.push('frost')
  if (i.tempMin != null && i.tempMax != null && i.tempMax - i.tempMin >= c.rangeDiff) flags.push('range')

  let condition: WeatherKind
  if (wet) condition = ({ rain: 'rain', snow: 'snow', sleet: 'sleet', shower: 'shower' } as const)[i.current.precip as 'rain' | 'snow' | 'sleet' | 'shower']
  else if (flags.some((f) => f !== 'range')) condition = flags.find((f) => f !== 'range')!
  else {
    const hour = toKstParts(i.now).hour
    const night = hour >= 20 || hour < 5
    if (i.current.sky === 'clear') condition = night ? 'night' : 'clear'
    else if (i.current.sky === 'partly') condition = 'partly'
    else if (i.current.sky === 'cloudy') condition = 'cloudy'
    else condition = flags.includes('range') ? 'range' : 'cloudy'
  }
  return { condition, flags: flags.filter((f) => f !== condition) }
}
