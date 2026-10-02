import { useCallback, useState } from 'react'

export type BlockId = 'weather' | 'recommend' | 'hourly' | 'daily'

export const blockLabels: Record<BlockId, string> = {
  weather: '현재 날씨',
  recommend: '오늘 추천',
  hourly: '시간대별 날씨',
  daily: '앞으로의 날씨',
}

const DEFAULT_ORDER: BlockId[] = ['weather', 'recommend', 'hourly', 'daily']
const KEY = 'wb.homeLayout'

interface Layout {
  order: BlockId[]
  hidden: BlockId[]
}

function load(): Layout {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Layout> | null
    const saved = (raw?.order ?? []).filter((id): id is BlockId => DEFAULT_ORDER.includes(id as BlockId))
    // 나중에 카드가 추가돼도 사라지지 않게, 저장에 없는 카드는 기본 순서상 바로 앞 카드 뒤에 끼워 넣는다
    const order = [...saved]
    DEFAULT_ORDER.forEach((id, i) => {
      if (order.includes(id)) return
      const prev = DEFAULT_ORDER.slice(0, i).reverse().find((x) => order.includes(x))
      order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, id)
    })
    const hidden = (raw?.hidden ?? []).filter((id): id is BlockId => DEFAULT_ORDER.includes(id as BlockId))
    return { order, hidden }
  } catch {
    return { order: DEFAULT_ORDER, hidden: [] }
  }
}

/** 홈 카드 순서/숨김. 지금은 이 기기(브라우저)에만 저장한다. */
export function useHomeLayout() {
  const [layout, setLayout] = useState<Layout>(load)

  const update = useCallback((next: Layout) => {
    setLayout(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* 저장 불가면 이번 방문에서만 적용 */
    }
  }, [])

  const move = (id: BlockId, dir: -1 | 1) => {
    const i = layout.order.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= layout.order.length) return
    const order = [...layout.order]
    ;[order[i], order[j]] = [order[j]!, order[i]!]
    update({ ...layout, order })
  }
  const toggleHidden = (id: BlockId) =>
    update({ ...layout, hidden: layout.hidden.includes(id) ? layout.hidden.filter((h) => h !== id) : [...layout.hidden, id] })
  const reset = () => update({ order: DEFAULT_ORDER, hidden: [] })

  return { order: layout.order, hidden: layout.hidden, move, toggleHidden, reset }
}
