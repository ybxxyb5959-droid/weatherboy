import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/db.js', () => ({ prisma: {} }))

import { conditionOfDay } from '../../src/api/routes/events.js'
import { skyOfText } from '../../src/services/weather/weatherService.js'
import type { OutingPoint } from '../../src/rules/outfitEngine.js'

// KST 기준 시각(UTC 에서 9시간 뺀 값)으로 점을 만든다
const pt = (kstHour: number, extra: Partial<OutingPoint> = {}): OutingPoint => ({ at: new Date(Date.UTC(2026, 9, 9, kstHour - 9, 0, 0)), temp: 18, feels: 18, pop: 10, precip: 'none', wind: 2, ...extra })

describe('일정 날씨 카드의 대표 날씨 그림', () => {
  it('비가 오는 시각이 있으면 비(가장 많은 종류)', () => {
    expect(conditionOfDay([pt(9), pt(15, { precip: 'rain', pop: 70 }), pt(18, { precip: 'rain' })])).toBe('rain')
    expect(conditionOfDay([pt(9, { precip: 'snow' }), pt(12, { precip: 'snow' }), pt(15, { precip: 'rain' })])).toBe('snow')
  })
  it('비가 없으면 낮(6~18시)의 가장 흔한 하늘 상태', () => {
    expect(conditionOfDay([pt(3, { sky: 'clear' }), pt(9, { sky: 'cloudy' }), pt(12, { sky: 'cloudy' }), pt(15, { sky: 'partly' }), pt(21, { sky: 'clear' })])).toBe('cloudy')
  })
  it('하늘 상태가 없으면(먼 날짜) 강수확률로 짐작', () => {
    expect(conditionOfDay([pt(12, { pop: 10 })])).toBe('clear')
    expect(conditionOfDay([pt(12, { pop: 30 })])).toBe('partly')
    expect(conditionOfDay([pt(12, { pop: 60 })])).toBe('cloudy')
  })
  it('중기예보 문구를 하늘 상태로', () => {
    expect(skyOfText('맑음')).toBe('clear')
    expect(skyOfText('구름많음')).toBe('partly')
    expect(skyOfText('흐림 / 흐리고 비')).toBe('cloudy')
    expect(skyOfText(null)).toBeNull()
  })
})
