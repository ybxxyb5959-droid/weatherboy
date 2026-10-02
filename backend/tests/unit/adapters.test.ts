import { describe, expect, it } from 'vitest'
import { latestMidTmFc, latestShortBase, midRegIds, parseMid, parseShortItems } from '../../src/services/weather/kma.js'
import { pickReading, pm10GradeOf, pm25GradeOf } from '../../src/services/airQuality/airkorea.js'
import { deriveCondition } from '../../src/services/weather/conditions.js'
import { decideNotification } from '../../src/jobs/pushNotificationJob.js'
import { normalizeSido } from '../../src/services/kakao/kakaoLocal.js'
import { isQuietHoursKst, fromKst, kstDate } from '../../src/utils/time.js'
import { templateExplanation, aiInput } from '../../src/services/ai/explain.js'
import { recommend } from '../../src/rules/outfitEngine.js'

describe('KMA 단기예보 발표시각', () => {
  it('12:05 KST -> 1100', () => expect(latestShortBase(new Date('2026-10-01T03:05:00Z'))).toMatchObject({ baseDate: '20261001', baseTime: '1100' }))
  it('12:05 KST 이전 10분 규칙: 11:05 KST -> 0800 (1100 은 11:10 부터)', () =>
    expect(latestShortBase(new Date('2026-10-01T02:05:00Z'))).toMatchObject({ baseDate: '20261001', baseTime: '0800' }))
  it('01:30 KST -> 전날 2300', () => expect(latestShortBase(new Date('2026-09-30T16:30:00Z'))).toMatchObject({ baseDate: '20260930', baseTime: '2300' }))
  it('02:10 KST -> 0200', () => expect(latestShortBase(new Date('2026-09-30T17:10:00Z'))).toMatchObject({ baseDate: '20261001', baseTime: '0200' }))
})

describe('KMA 중기예보', () => {
  it('tmFc 06/18시', () => {
    expect(latestMidTmFc(new Date('2026-10-01T03:00:00Z')).tmFc).toBe('202610010600') // 12:00 KST
    expect(latestMidTmFc(new Date('2026-10-01T10:00:00Z')).tmFc).toBe('202610011800') // 19:00 KST
    expect(latestMidTmFc(new Date('2026-09-30T20:00:00Z')).tmFc).toBe('202609301800') // 05:00 KST
  })
  it('regId 매핑', () => {
    expect(midRegIds('서울', '마포구')).toEqual({ land: '11B00000', temp: '11B10101' })
    expect(midRegIds('제주', '제주시')).toEqual({ land: '11G00000', temp: '11G00201' })
    expect(midRegIds('강원', '강릉시')?.land).toBe('11D20000')
    expect(midRegIds('강원', '춘천시')?.land).toBe('11D10000')
    expect(midRegIds('없음', null)).toBeNull()
  })
  it('응답 -> 일별 DTO', () => {
    const issuedAt = fromKst('2026-10-01', '06:00')
    const d = parseMid({ taMin3: 8, taMax3: 18, taMin4: 9, taMax4: 19 }, { rnSt3Am: 10, rnSt3Pm: 70, wf3Am: '맑음', wf3Pm: '흐리고 비', rnSt4Am: 0, rnSt4Pm: 0 }, issuedAt)
    expect(d).toHaveLength(2)
    expect(d[0]).toMatchObject({ date: '2026-10-04', tempMin: 8, tempMax: 18, pop: 70, precip: 'rain' })
    expect(d[1]).toMatchObject({ date: '2026-10-05', precip: 'none' })
  })
})

describe('KMA 단기예보 파싱', () => {
  it('카테고리별로 시간별 DTO 생성', () => {
    const mk = (category: string, fcstValue: string, fcstTime = '0900') => ({ category, fcstDate: '20261001', fcstTime, fcstValue })
    const r = parseShortItems([mk('TMP', '12'), mk('POP', '30'), mk('PTY', '1'), mk('WSD', '4.2'), mk('REH', '60'), mk('SKY', '4'), mk('TMN', '8.0', '0600'), mk('TMX', '19.0', '1500')])
    expect(r.hourly).toHaveLength(1)
    expect(r.hourly[0]).toMatchObject({ temp: 12, pop: 30, precip: 'rain', wind: 4.2, humidity: 60, sky: 'cloudy' })
    expect(r.hourly[0]!.targetAt.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(r.dailyMin.get('2026-10-01')).toBe(8)
    expect(r.dailyMax.get('2026-10-01')).toBe(19)
  })
})

describe('AirKorea', () => {
  it('통합 등급 기준', () => {
    expect([pm10GradeOf(30), pm10GradeOf(31), pm10GradeOf(81), pm10GradeOf(151)]).toEqual([1, 2, 3, 4])
    expect([pm25GradeOf(15), pm25GradeOf(16), pm25GradeOf(36), pm25GradeOf(76)]).toEqual([1, 2, 3, 4])
  })
  it('구 이름과 일치하는 측정소 우선, 없으면 시도 중앙값', () => {
    const rows = [
      { stationName: '마포구', pm10Value: '40', pm25Value: '20', pm10Grade: '2', pm25Grade: '2' },
      { stationName: '강남구', pm10Value: '100', pm25Value: '60', pm10Grade: '3', pm25Grade: '3' },
    ]
    expect(pickReading(rows, '서울', '마포구')).toMatchObject({ stationName: '마포구', pm10: 40, pm10Grade: 2 })
    const med = pickReading(rows, '서울', '없는구')
    expect(med.stationName).toBeNull()
    expect(med.pm10Grade).toBe(3)
  })
  it('결측("-")은 null, 등급이 없으면 값으로 계산', () => {
    const r = pickReading([{ stationName: 'a', pm10Value: '90', pm25Value: '-', pm10Grade: null, pm25Grade: null }], '서울', null)
    expect(r).toMatchObject({ pm10: 90, pm25: null, pm10Grade: 3, pm25Grade: null })
  })
})

describe('WeatherKind 산출', () => {
  const now = new Date('2026-10-01T03:00:00Z')
  const cur = { targetAt: now, temp: 12, pop: 0, precip: 'none' as const, wind: 2, humidity: 50, sky: 'cloudy' as const }
  it('흐림', () => expect(deriveCondition({ now, current: cur, feels: 10, tempMin: 8, tempMax: 15, dustGrade: 2 }).condition).toBe('cloudy'))
  it('비가 오면 rain 이 우선', () => expect(deriveCondition({ now, current: { ...cur, precip: 'rain' }, feels: 10, tempMin: null, tempMax: null, dustGrade: 4 }).condition).toBe('rain'))
  it('미세먼지 나쁨 -> dust', () => expect(deriveCondition({ now, current: cur, feels: 10, tempMin: null, tempMax: null, dustGrade: 3 }).condition).toBe('dust'))
  it('일교차가 크면 flags 에 range, 대표는 하늘상태', () => {
    const r = deriveCondition({ now, current: cur, feels: 10, tempMin: 5, tempMax: 18, dustGrade: 2 })
    expect(r.condition).toBe('cloudy')
    expect(r.flags).toContain('range')
  })
  it('데이터 근거가 없는 thunder/fog/uv/typhoon 은 만들지 않는다', () => {
    const r = deriveCondition({ now, current: { ...cur, wind: 12 }, feels: 10, tempMin: null, tempMax: null, dustGrade: null })
    expect(['thunder', 'fog', 'uv', 'typhoon']).not.toContain(r.condition)
    expect(r.condition).toBe('windy')
  })
  it('밤 + 맑음 -> night', () =>
    expect(deriveCondition({ now: new Date('2026-10-01T14:00:00Z'), current: { ...cur, sky: 'clear' }, feels: 10, tempMin: null, tempMax: null, dustGrade: null }).condition).toBe('night'))
})

describe('Push 판단', () => {
  const base = { notificationCount: 0, notifyEvent: true, notifyChange: true }
  it('최초 생성', () => expect(decideNotification({ ...base, lastDecisionKey: null, currentKey: 'A' })).toBe('FIRST'))
  it('같은 판단이면 보내지 않음', () => expect(decideNotification({ ...base, lastDecisionKey: 'A', currentKey: 'A' })).toBe('NONE'))
  it('판단 변경', () => expect(decideNotification({ ...base, lastDecisionKey: 'A', currentKey: 'B' })).toBe('CHANGE'))
  it('알림 꺼짐/횟수 초과는 기록만', () => {
    expect(decideNotification({ ...base, notifyChange: false, lastDecisionKey: 'A', currentKey: 'B' })).toBe('RECORD_ONLY')
    expect(decideNotification({ ...base, notificationCount: 3, lastDecisionKey: 'A', currentKey: 'B' })).toBe('RECORD_ONLY')
  })
})

describe('시간/위치 유틸', () => {
  it('야간 금지 시간 (KST 23~07)', () => {
    expect(isQuietHoursKst(new Date('2026-10-01T14:00:00Z'))).toBe(true) // 23:00
    expect(isQuietHoursKst(new Date('2026-10-01T21:59:00Z'))).toBe(true) // 06:59
    expect(isQuietHoursKst(new Date('2026-10-01T22:00:00Z'))).toBe(false) // 07:00
    expect(isQuietHoursKst(new Date('2026-10-01T13:59:00Z'))).toBe(false) // 22:59
  })
  it('KST <-> UTC', () => {
    expect(fromKst('2026-10-18', '09:00').toISOString()).toBe('2026-10-18T00:00:00.000Z')
    expect(kstDate(new Date('2026-10-17T16:00:00Z'))).toBe('2026-10-18')
  })
  it('시도 정규화', () => {
    expect(normalizeSido('서울특별시')).toBe('서울')
    expect(normalizeSido('경기도')).toBe('경기')
    expect(normalizeSido('제주특별자치도')).toBe('제주')
    expect(normalizeSido('충청남도')).toBe('충남')
    expect(normalizeSido('모름')).toBeNull()
  })
})

describe('AI 설명', () => {
  it('AI 입력은 Rule Engine 결과의 사실만 담고, 템플릿 fallback 이 있다', () => {
    const r = recommend({
      points: [{ at: new Date(), temp: 12, feels: 12, pop: 0, precip: 'none', wind: 1 }],
      sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: null, clothes: [], airGrade: 2,
    })
    expect(Object.keys(aiInput(r)).sort()).toEqual(['headline', 'items', 'needMask', 'needOuter', 'needUmbrella', 'reasons', 'sub'])
    expect(templateExplanation(r)).toContain(r.headline)
  })
})

describe('AirKorea 1시간 등급 우선', () => {
  it('1시간 등급이 있으면 24시간 등급보다 우선한다', () => {
    const r = pickReading([{ stationName: '마포구', pm10Value: '90', pm25Value: '10', pm10Grade: '2', pm25Grade: '1', pm10Grade1h: '3', pm25Grade1h: '1' }], '서울', '마포구')
    expect(r.pm10Grade).toBe(3)
  })
  it('1시간 등급이 없으면 24시간 등급을 쓴다', () => {
    const r = pickReading([{ stationName: '마포구', pm10Value: '40', pm25Value: '10', pm10Grade: '2', pm25Grade: '1', pm10Grade1h: null, pm25Grade1h: undefined }], '서울', '마포구')
    expect(r.pm10Grade).toBe(2)
  })
})
