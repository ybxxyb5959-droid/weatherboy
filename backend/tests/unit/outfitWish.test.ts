import { describe, expect, it } from 'vitest'
import type { OutfitItem } from '../../src/rules/outfitEngine.js'
import { applySuit, applyWish, parseWish } from '../../src/rules/outfitWish.js'

const own = (type: string, color: string): OutfitItem => ({ clothingId: `id-${type}`, type, color, pattern: '무지', label: `${color} ${type}`, owned: true })

describe('parseWish: 말에서 원하는 옷 찾기', () => {
  it('"검정색 상의를 입고 싶은데" -> 상의, 검정', () => {
    expect(parseWish('검정색 상의를 입고 싶은데')).toEqual({ suit: false, pieces: [{ role: 'top', type: undefined, color: '검정' }] })
  })
  it('색과 옷이 여러 개: 각 옷 앞의 색이 그 옷의 색', () => {
    const w = parseWish('흰 셔츠에 네이비 바지 입을래')!
    expect(w.pieces).toEqual(expect.arrayContaining([{ role: 'top', type: '셔츠', color: '흰색' }, { role: 'bottom', type: '바지', color: '네이비' }]))
  })
  it('반바지는 바지보다, 티셔츠는 셔츠보다 먼저 잡는다', () => {
    expect(parseWish('파란 반바지')!.pieces[0]).toMatchObject({ role: 'bottom', type: '반바지', color: '파랑' })
    expect(parseWish('검정 티셔츠')!.pieces[0]).toMatchObject({ role: 'top', type: '반팔', color: '검정' })
  })
  it('남색은 네이비, 하늘은 하늘색', () => {
    expect(parseWish('남색 자켓')!.pieces[0]).toMatchObject({ role: 'outer', type: '자켓', color: '네이비' })
    expect(parseWish('하늘색 셔츠')!.pieces[0]).toMatchObject({ role: 'top', color: '하늘색' })
  })
  it('옷 낱말 없이 색만 말하면 상의의 색', () => {
    expect(parseWish('검정색으로 입고 싶어')).toEqual({ suit: false, pieces: [{ role: 'top', color: '검정' }] })
  })
  it('정장은 정장 세트', () => expect(parseWish('검정 정장 입을래')?.suit).toBe(true))
  it('모르는 말이면 null', () => {
    expect(parseWish('아무거나 추천해줘')).toBeNull()
    expect(parseWish('편하게 입고 싶어')).toBeNull()
  })
})

describe('applyWish: 옷장에 없어도 예시로 입힌다', () => {
  const items = [own('맨투맨', '회색'), own('바지', '파랑')]
  it('색만 말하면 코디가 고른 종류는 두고 색만 예시로 바꾼다', () => {
    const r = applyWish(items, parseWish('검정색 상의 입고 싶어')!)
    expect(r.items[0]).toMatchObject({ type: '맨투맨', color: '검정', owned: false, example: true, clothingId: null })
    expect(r.items[1]).toBe(items[1])
    expect(r.applied).toEqual(['검정 맨투맨(예시)'])
  })
  it('말한 자리가 비어 있으면 새로 입힌다(겉옷)', () => {
    const r = applyWish(items, parseWish('베이지 코트 입을래')!)
    expect(r.items).toHaveLength(3)
    expect(r.items[2]).toMatchObject({ type: '코트', color: '베이지', example: true })
  })
  it('이미 그 옷을 입고 있으면 예시로 바꾸지 않는다', () => {
    const r = applyWish(items, parseWish('회색 맨투맨')!)
    expect(r.items[0]).toBe(items[0])
    expect(r.applied).toEqual([])
  })
})

describe('applySuit: 정장 세트(셔츠 + 자켓 + 바지)', () => {
  it('옷장에 정장이 없으면 셔츠·슬랙스·자켓을 예시로 채운다', () => {
    const r = applySuit([own('후드티', '회색'), own('바지', '파랑')])
    expect(r.items.map((i) => i.type)).toEqual(['셔츠', '바지', '자켓'])
    expect(r.items.every((i) => i.example)).toBe(false) // 바지는 이미 바지라서 그대로 둔다
    expect(r.items[0]).toMatchObject({ example: true, owned: false })
    expect(r.items[2]).toMatchObject({ type: '자켓', color: '검정', example: true })
  })
  it('이미 단정한 옷이 있으면 그 옷을 쓰고 없는 것만 채운다', () => {
    const shirt = own('셔츠', '흰색')
    const pants = own('바지', '검정')
    const r = applySuit([shirt, pants])
    expect(r.items[0]).toBe(shirt)
    expect(r.items[1]).toBe(pants)
    expect(r.items[2]).toMatchObject({ type: '자켓', example: true })
    expect(r.filled).toEqual(['검정 정장 자켓(예시)'])
  })
  it('정장 세트가 이미 갖춰져 있으면 아무것도 바꾸지 않는다', () => {
    const set = [own('셔츠', '흰색'), own('바지', '검정'), own('자켓', '네이비')]
    const r = applySuit(set)
    expect(r.items).toEqual(set)
    expect(r.filled).toEqual([])
  })
})
