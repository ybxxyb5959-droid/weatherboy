import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Legal from '../components/Legal'
import { deleteAccountSections, faqGroups, LEGAL_EFFECTIVE, MIN_AGE, OPERATOR, privacySections, termsSections } from '../pages/legalText'

describe('약관·방침 문구', () => {
  it('항목마다 제목과 본문이 있고, 번호가 1부터 이어진다', () => {
    for (const secs of [termsSections, privacySections, deleteAccountSections]) {
      secs.forEach((s, i) => {
        expect(s.title.startsWith(`${i + 1}. `)).toBe(true)
        expect(s.body.length).toBeGreaterThan(0)
        s.body.forEach((p) => expect(p.trim().length).toBeGreaterThan(0))
      })
    }
  })
  it('운영자 연락처·시행일·이용 연령이 약관과 방침에 같이 들어 있다', () => {
    const all = [...termsSections, ...privacySections].flatMap((s) => s.body).join('\n')
    expect(all).toContain(OPERATOR.contact)
    expect(all).toContain(LEGAL_EFFECTIVE)
    expect(all).toContain(`만 ${MIN_AGE}세`)
    expect(LEGAL_EFFECTIVE).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('개인정보 방침이 실제 처리(국외 이전·탈퇴 삭제·세션)를 설명한다', () => {
    const p = privacySections.flatMap((s) => s.body).join('\n')
    for (const word of ['Google', '국외', '탈퇴', '쿠키', '디스코드']) expect(p).toContain(word)
  })
  it('렌더링: 안내 줄과 모든 항목 제목이 나온다', () => {
    const html = renderToStaticMarkup(createElement(Legal, { sections: termsSections }))
    expect(html).toContain('legal-meta')
    expect(html).toContain(OPERATOR.contact)
    for (const s of termsSections) expect(html).toContain(s.title)
    expect(renderToStaticMarkup(createElement(Legal, { sections: deleteAccountSections, showEffective: false }))).not.toContain('시행일')
  })
  it('FAQ 질문·답변이 비어 있지 않고 질문이 겹치지 않는다', () => {
    const qs = faqGroups.flatMap((g) => g.items.map((i) => i.q))
    expect(new Set(qs).size).toBe(qs.length)
    faqGroups.forEach((g) => g.items.forEach((i) => expect(i.a.length).toBeGreaterThan(10)))
  })
})
