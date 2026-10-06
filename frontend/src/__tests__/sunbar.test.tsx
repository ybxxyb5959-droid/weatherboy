import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SunBar from '../components/SunBar'

// 일출 06:40, 일몰 17:50. 시각은 한국 시각(KST)으로 넘긴다(UTC 에서 9시간을 뺀 Date)
const at = (h: number, m: number) => new Date(Date.UTC(2026, 9, 6, h - 9, m))
const view = (h: number, m: number) => renderToStaticMarkup(createElement(SunBar, { rise: '06:40', set: '17:50', now: at(h, m) }))
const status = (html: string) => (html.match(/act-status">([^<]*)</)?.[1] ?? '').replace(/ /g, ' ')

describe('홈 일출·일몰 카드의 때별 장면', () => {
  it('상태 문구가 때에 맞다', () => {
    expect(status(view(3, 0))).toBe('아직 해가 뜨기 전이에요')
    expect(status(view(6, 20))).toBe('곧  해가 떠요 · 일출 06:40')
    expect(status(view(6, 41))).toBe('해가 떠오르고 있어요')
    expect(status(view(12, 0))).toContain('해가 떠 있어요')
    expect(status(view(17, 30))).toBe('곧  해가 져요 · 일몰 17:50')
    expect(status(view(17, 52))).toBe('해가 지고 있어요')
    expect(status(view(18, 30))).toBe('오늘은 해가 졌어요')
  })

  it('낮에는 호와 끝 점, 해가 지나온 길이 있고 빌딩은 없다', () => {
    const html = view(12, 0)
    expect(html).toContain('stroke-dasharray="0.5 8"') // 해가 지나갈 점선 호
    expect(html).toContain('#e8a24a') // 지나온 길(주황 실선)
    expect(html).not.toContain('sb-ray') // 햇살 연출 없음
    expect(html).not.toContain('M14 58 L14 40') // 빌딩 없음
  })

  it('밤·새벽에는 빌딩이 있고, 일출·일몰 직후에는 해가 움직이는 연출 클래스가 붙는다', () => {
    expect(view(3, 0)).toContain('M14 58 L14 40') // 밤 빌딩
    expect(view(6, 41)).toContain('sb-rise-in')
    expect(view(17, 52)).toContain('sb-set-in')
    expect(view(17, 58)).toContain('sb-moon-in') // 밤에 열면 달이 떠오른다
  })

  it('일출 후 5~8분, 노을 시작 3분 동안은 낮 그림과 장면이 서로 겹쳐 바뀐다', () => {
    const morning = view(6, 46)
    expect(morning).toContain('sb-fx-out') // 일출 장면은 사라지고
    expect(morning).toContain('sb-fx-in') // 낮 그림이 나타난다
    const dusk = view(17, 21)
    expect(dusk).toContain('sb-fx-in') // 노을이 나타나고
    expect(dusk).toContain('sb-fx-out') // 낮 그림은 사라진다
    expect(view(10, 0)).not.toContain('sb-fx-') // 평소에는 없다
    expect(view(17, 40)).not.toContain('sb-fx-')
  })

  it('일정 화면(eventTime)은 일정 시각 기준: 일몰 뒤 일정이면 밤 그림', () => {
    const html = renderToStaticMarkup(createElement(SunBar, { rise: '06:40', set: '17:50', eventTime: { start: '20:00', end: '22:00' } }))
    expect(status(html)).toBe('일몰 후 일정이에요 · 일몰 17:50')
    expect(html).not.toContain('sb-moon-in') // 일정 화면에서는 달 연출 없음
  })

  it('시각 없는 하루 종일 일정은 지나온 길 없이 낮 그림', () => {
    const html = renderToStaticMarkup(createElement(SunBar, { rise: '06:40', set: '17:50', eventTime: { start: '00:00', end: '23:59' } }))
    expect(html).not.toContain('#e8a24a" stroke-width="3.2"')
  })
})
