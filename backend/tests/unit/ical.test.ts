import { describe, expect, it } from 'vitest'
import { fetchIcal, guessKind, normalizeIcalUrl, parseIcs } from '../../src/services/calendar/ical.js'

const ics = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:a1',
  'SUMMARY:제주 여행\\, 3박',
  'DTSTART;TZID=Asia/Seoul:20261018T090000',
  'DTEND;TZID=Asia/Seoul:20261020T200000',
  'LOCATION:제주도',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:a2',
  'SUMMARY:종일 일정',
  'DTSTART;VALUE=DATE:20261026',
  'DTEND;VALUE=DATE:20261027',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:a3',
  'SUMMARY:UTC 회의 줄바꿈',
  ' 이어짐',
  'DTSTART:20261001T000000Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:a4',
  'SUMMARY:취소됨',
  'STATUS:CANCELLED',
  'DTSTART:20261001T000000Z',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('iCal 파싱', () => {
  const events = parseIcs(ics)
  it('취소된 일정은 건너뛴다', () => expect(events.map((e) => e.uid)).toEqual(['a1', 'a2', 'a3']))
  it('TZID=Asia/Seoul 은 한국 시간으로 읽는다', () => {
    expect(events[0]!.startAt.toISOString()).toBe('2026-10-18T00:00:00.000Z')
    expect(events[0]!.endAt.toISOString()).toBe('2026-10-20T11:00:00.000Z')
  })
  it('이스케이프와 장소를 푼다', () => {
    expect(events[0]!.title).toBe('제주 여행, 3박')
    expect(events[0]!.location).toBe('제주도')
  })
  it('종일 일정은 그 날 하루로 끝난다 (DTEND 는 다음 날 0시)', () => {
    expect(events[1]!.startAt.toISOString()).toBe('2026-10-25T15:00:00.000Z')
    expect(events[1]!.endAt.toISOString()).toBe('2026-10-26T14:59:00.000Z')
  })
  it('접힌 줄(줄바꿈+공백)을 이어 붙이고, 종료가 없으면 1시간', () => {
    expect(events[2]!.title).toBe('UTC 회의 줄바꿈이어짐')
    expect(events[2]!.endAt.getTime() - events[2]!.startAt.getTime()).toBe(3600_000)
  })
})

describe('일정 종류 짐작', () => {
  it('키워드로 나눈다', () => {
    expect(guessKind('제주 여행')).toBe('TRAVEL')
    expect(guessKind('가평 캠핑')).toBe('CAMPING')
    expect(guessKind('북한산 등산')).toBe('HIKING')
    expect(guessKind('한강 피크닉')).toBe('OUTDOOR')
    expect(guessKind('불꽃 페스티벌')).toBe('OUTDOOR')
    expect(guessKind('저녁 러닝')).toBe('OTHER')
    expect(guessKind('팀 회의')).toBe('OTHER')
  })
})

describe('캘린더 주소 안전장치', () => {
  it('webcal:// 은 https:// 로 바꾼다', () => expect(normalizeIcalUrl('webcal://p01-caldav.icloud.com/x.ics').protocol).toBe('https:'))
  it('http, 아이디/비밀번호가 든 주소는 거절한다', () => {
    expect(() => normalizeIcalUrl('http://example.com/a.ics')).toThrow()
    expect(() => normalizeIcalUrl('https://user:pw@example.com/a.ics')).toThrow()
  })
  it('내부망/루프백 주소는 열지 않는다', async () => {
    await expect(fetchIcal(new URL('https://127.0.0.1/a.ics'))).rejects.toThrow()
    await expect(fetchIcal(new URL('https://192.168.0.1/a.ics'))).rejects.toThrow()
    await expect(fetchIcal(new URL('https://[::1]/a.ics'))).rejects.toThrow()
    await expect(fetchIcal(new URL('https://169.254.169.254/latest/meta-data'))).rejects.toThrow()
  })
})
