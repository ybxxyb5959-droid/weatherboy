import { describe, expect, it } from 'vitest'
import { josa, withJosa } from '../../src/utils/josa.js'

describe('받침에 맞는 조사', () => {
  it('은/는: 받침이 있으면 은, 없으면 는', () => {
    expect(withJosa('검정 후드티', '은', '는')).toBe('검정 후드티는')
    expect(withJosa('베이지 바지', '은', '는')).toBe('베이지 바지는')
    expect(withJosa('검정 맨투맨', '은', '는')).toBe('검정 맨투맨은')
    expect(withJosa('흰색 셔츠', '은', '는')).toBe('흰색 셔츠는')
    expect(withJosa('검정 정장 자켓', '은', '는')).toBe('검정 정장 자켓은')
  })
  it('을/를, 이/가', () => {
    expect(withJosa('코트', '을', '를')).toBe('코트를')
    expect(withJosa('가디건', '이', '가')).toBe('가디건이')
  })
  it('으로/로: ㄹ 받침은 로(서울로), 그 외 받침은 으로, 받침 없음은 로', () => {
    expect(josa('서울', '으로', '로')).toBe('로')
    expect(josa('느낌', '으로', '로')).toBe('으로')
    expect(josa('바지', '으로', '로')).toBe('로')
  })
  it('한글이 아니거나 비어 있으면 받침 없는 쪽', () => {
    expect(josa('ABC', '은', '는')).toBe('는')
    expect(josa('', '은', '는')).toBe('는')
  })
  it('뒤 공백은 무시한다', () => expect(withJosa('후드티 ', '은', '는')).toBe('후드티 는'))
})
