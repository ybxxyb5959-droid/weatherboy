// 내 캐릭터 꾸미기: 슬롯마다 하나씩 고른다. 그림은 프런트의 캐릭터 컴포넌트가 아이템 id 로 그린다.
export type Slot = 'hat' | 'hairpin' | 'glasses' | 'neck' | 'face' | 'extra'

export interface CatalogItem {
  id: string
  label: string
}
export interface CatalogSlot {
  slot: Slot
  label: string
  items: CatalogItem[]
}

export const CATALOG: CatalogSlot[] = [
  {
    slot: 'hat',
    label: '모자',
    items: [
      { id: 'beanie', label: '비니' },
      { id: 'cap', label: '야구모자' },
      { id: 'bucket', label: '벙거지' },
      { id: 'beret', label: '베레모' },
      { id: 'straw', label: '밀짚모자' },
      { id: 'crown', label: '왕관' },
      { id: 'flower-crown', label: '꽃관' },
      { id: 'witch', label: '마녀 모자' },
      { id: 'santa', label: '산타 모자' },
      { id: 'bear-ears', label: '곰 귀' },
      { id: 'cat-ears', label: '고양이 귀' },
      { id: 'bunny-ears', label: '토끼 귀' },
    ],
  },
  {
    slot: 'hairpin',
    label: '헤어핀',
    items: [
      { id: 'star', label: '별 핀' },
      { id: 'ribbon', label: '리본' },
      { id: 'flower', label: '꽃 핀' },
      { id: 'heart', label: '하트 핀' },
      { id: 'butterfly', label: '나비 핀' },
      { id: 'cloud', label: '구름 핀' },
      { id: 'lightning', label: '번개 핀' },
      { id: 'cherry', label: '체리 핀' },
    ],
  },
  {
    slot: 'glasses',
    label: '안경',
    items: [
      { id: 'round', label: '동그란 안경' },
      { id: 'square', label: '네모 안경' },
      { id: 'sun', label: '선글라스' },
      { id: 'heart', label: '하트 안경' },
      { id: 'star', label: '별 안경' },
      { id: 'cat-eye', label: '캣아이 안경' },
    ],
  },
  {
    slot: 'neck',
    label: '목',
    items: [
      { id: 'scarf', label: '목도리' },
      { id: 'striped-scarf', label: '줄무늬 목도리' },
      { id: 'bowtie', label: '나비넥타이' },
      { id: 'tie', label: '넥타이' },
      { id: 'necklace', label: '목걸이' },
      { id: 'bell', label: '방울' },
    ],
  },
  {
    slot: 'face',
    label: '얼굴',
    items: [
      { id: 'blush', label: '볼터치' },
      { id: 'freckles', label: '주근깨' },
      { id: 'mustache', label: '콧수염' },
      { id: 'bandaid', label: '반창고' },
      { id: 'star-sticker', label: '별 스티커' },
    ],
  },
  {
    slot: 'extra',
    label: '기타',
    items: [
      { id: 'headphones', label: '헤드폰' },
      { id: 'wings', label: '작은 날개' },
      { id: 'sparkle', label: '반짝이' },
      { id: 'moon', label: '달' },
      { id: 'balloon', label: '풍선' },
      { id: 'snow', label: '눈송이' },
      { id: 'butterflies', label: '나비들' },
      { id: 'rainbow', label: '무지개' },
    ],
  },
]

export type CharacterConfig = Partial<Record<Slot, string>>

/** 저장된 값을 걸러서 카탈로그에 있는 것만 남긴다 (옛 값이나 이상한 값이 있어도 화면이 깨지지 않게) */
export function cleanConfig(raw: unknown): CharacterConfig {
  const out: CharacterConfig = {}
  if (!raw || typeof raw !== 'object') return out
  for (const s of CATALOG) {
    const v = (raw as Record<string, unknown>)[s.slot]
    if (typeof v === 'string' && s.items.some((i) => i.id === v)) out[s.slot] = v
  }
  return out
}
