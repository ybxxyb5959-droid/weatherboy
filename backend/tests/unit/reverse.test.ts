import { describe, expect, it } from 'vitest'
import { canonicalRegion } from '../../src/services/kakao/kakaoLocal.js'

describe('canonicalRegion (카카오 행정구역 -> 서비스 지역 이름)', () => {
  it('서울 마포구', () => expect(canonicalRegion('서울특별시', '마포구')).toEqual({ name: '서울 마포구', sido: '서울', district: '마포구' }))
  it("'수원시 영통구' 는 시 단위로", () => expect(canonicalRegion('경기도', '수원시 영통구')).toEqual({ name: '경기 수원시', sido: '경기', district: '수원시' }))
  it('세종은 구 이름이 없다', () => expect(canonicalRegion('세종특별자치시', '')).toEqual({ name: '세종', sido: '세종', district: null }))
  it('제주', () => expect(canonicalRegion('제주특별자치도', '제주시')).toEqual({ name: '제주 제주시', sido: '제주', district: '제주시' }))
  it('통합특별시의 광주 구는 광주, 전남 시/군은 전남', () => {
    expect(canonicalRegion('전남광주통합특별시', '동구')).toMatchObject({ name: '광주 동구', sido: '광주' })
    expect(canonicalRegion('전남광주통합특별시', '목포시')).toMatchObject({ name: '전남 목포시', sido: '전남' })
  })
  it('빈 값/알 수 없는 시도는 null', () => {
    expect(canonicalRegion('', '')).toBeNull()
    expect(canonicalRegion('어딘가', '무슨구')).toBeNull()
  })
})
