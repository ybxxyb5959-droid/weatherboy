import { useEffect, useState } from 'react'
import { api } from '../api'
import HandText from './HandText'
import type { Suggestion } from '../types'

interface Props {
  onSelect: (name: string) => void
  placeholder?: string
  autoFocus?: boolean
}

/** 지역 입력 + 연관 지역 자동완성. 목록에 없는 말(홍대 등)도 그대로 검색할 수 있다. */
export default function PlaceInput({ onSelect, placeholder = '지역을 입력하세요.', autoFocus }: Props) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Suggestion[]>([])
  const [active, setActive] = useState(-1)

  useEffect(() => {
    const text = q.trim()
    if (!text) {
      setItems([])
      return
    }
    let stale = false
    const t = window.setTimeout(() => {
      api<Suggestion[]>('GET', `/api/places/suggest?q=${encodeURIComponent(text)}`)
        .then((r) => {
          if (!stale) {
            setItems(r)
            setActive(-1)
          }
        })
        .catch(() => {
          if (!stale) setItems([])
        })
    }, 120)
    return () => {
      stale = true
      window.clearTimeout(t)
    }
  }, [q])

  const text = q.trim()
  const rows = [
    ...items.map((s) => ({ name: s.name, label: s.name })),
    ...(text && !items.some((s) => s.name === text) ? [{ name: text, label: `"${text}" 검색` }] : []),
  ]

  const choose = (name: string) => {
    setQ('')
    setItems([])
    onSelect(name)
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(rows.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(-1, i - 1))
    } else if (e.key === 'Enter') {
      const pick = rows[active] ?? rows[0]
      if (pick) choose(pick.name)
    }
  }

  return (
    <div>
      <input
        className="loc-input"
        type="text"
        value={q}
        placeholder={placeholder}
        aria-label="지역 검색"
        aria-autocomplete="list"
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKey}
      />
      {rows.length > 0 && (
        <ul className="loc-list" role="listbox" aria-label="연관 지역">
          {rows.map((r, i) => (
            <li key={r.name} role="option" aria-selected={i === active}>
              <button type="button" className={`loc-item ${i === active ? 'on' : ''}`} onClick={() => choose(r.name)}>
                <HandText>{r.label}</HandText>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
