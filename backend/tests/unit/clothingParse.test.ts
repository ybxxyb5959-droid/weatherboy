import { describe, expect, it } from 'vitest'
// 프런트의 순수 함수(문장 -> 옷 목록)를 같은 저장소에서 바로 검증한다.
import { clothingLabel, parseClothing } from '../../../frontend/src/lib/clothingParse.js'

const labels = (s: string) => parseClothing(s).items.map(clothingLabel)

describe('옷 문장 해석', () => {
  it('종류·색·무늬를 찾는다', () => {
    expect(parseClothing('검정 체크 맨투맨').items).toEqual([{ type: '맨투맨', color: '검정', pattern: '체크', colorGuessed: false }])
  })
  it('순서가 달라도, 동의어도 알아본다', () => {
    expect(labels('맨투맨 체크 까만')).toEqual(['검정 체크 맨투맨'])
    expect(labels('핑크 스트라이프 티셔츠')).toEqual(['분홍 줄무늬 반팔'])
    expect(labels('까만 롱패딩')).toEqual(['검정 패딩'])
  })
  it('여러 벌을 나눈다', () => {
    expect(labels('검정 후드티랑 청바지랑 흰 반팔')).toEqual(['검정 후드티', '파랑 바지', '흰색 반팔'])
    expect(labels('연청 반바지, 베이지 스커트')).toEqual(['하늘색 반바지', '베이지 치마'])
    expect(labels('회색 후드 집업\n흰색 도트 치마')).toEqual(['회색 후드티', '흰색 도트 치마'])
  })
  it('반바지는 바지가 아니라 반바지, 와이드의 와는 나누지 않는다', () => {
    expect(parseClothing('반바지').items[0]!.type).toBe('반바지')
    expect(labels('베이지 와이드 슬랙스')).toEqual(['베이지 바지'])
  })
  it('청바지는 색을 따로 말하면 그 색을 쓴다', () => {
    expect(parseClothing('청바지').items[0]).toMatchObject({ color: '파랑', colorGuessed: false })
    expect(parseClothing('검정 청바지').items[0]!.color).toBe('검정')
  })
  it('색을 못 찾으면 기타로 두고 알려준다', () => {
    expect(parseClothing('패딩').items[0]).toMatchObject({ type: '패딩', color: '기타', colorGuessed: true })
  })
  it('종류를 못 찾은 조각은 unknown 으로 돌려준다', () => {
    const r = parseClothing('이상한 말, 검정 코트')
    expect(r.items).toHaveLength(1)
    expect(r.unknown).toEqual(['이상한 말'])
  })
})
