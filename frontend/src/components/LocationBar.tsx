import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import DoodleButton from './DoodleButton'
import HandText from './HandText'
import { Pin } from './icons'
import type { Favorite, Suggestion, Target } from '../types'

interface Props {
  /** 내 기본 위치 이름 (설정의 위치) */
  homeName: string
  target: Target
  favorites: Favorite[]
  onHome: () => void
  onFavorite: (f: Favorite) => void
  onPlace: (name: string) => void
  /** 지금 보는 지역을 즐겨찾기에 담기/빼기 */
  onToggleSaved: () => void
  onRemoveFavorite: (f: Favorite) => void
  saving: boolean
}

function Magnifier() {
  return (
    <svg className="doodle" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 3.5 C15 3 18.5 7 17.5 11.5 C16.5 15.5 11 17 7.5 14.5 C4 12 4.5 5.5 10 3.5Z" />
      <path d="M16 15.5 L21 21" />
    </svg>
  )
}

function Star({ filled, size = 22 }: { filled: boolean; size?: number }) {
  return (
    <svg className="doodle" width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#f2cf4a' : 'none'} stroke="#222" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 L14.5 9 L21 9.6 L16 13.8 L17.6 20.5 L12 17 L6.4 20.5 L8 13.8 L3 9.6 L9.5 9Z" />
    </svg>
  )
}

export default function LocationBar({ homeName, target, favorites, onHome, onFavorite, onPlace, onToggleSaved, onRemoveFavorite, saving }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Suggestion[]>([])
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const currentName = target.kind === 'home' ? homeName : target.name
  const saved = target.kind === 'fav' || (target.kind === 'place' && favorites.some((f) => f.name === target.name))

  // 글자를 칠 때마다(조금 기다렸다가) 연관 지역을 불러온다. 늦게 온 이전 응답은 무시.
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

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const choose = (name: string) => {
    onPlace(name)
    setQ('')
    setItems([])
    setOpen(false)
  }

  const text = q.trim()
  // 목록에 없는 말(홍대, 가평 …)도 그대로 검색할 수 있게 마지막 줄을 하나 둔다
  const rows: { name: string; label: string }[] = [
    ...items.map((s) => ({ name: s.name, label: s.name })),
    ...(text && !items.some((s) => s.name === text) ? [{ name: text, label: `"${text}" 검색` }] : []),
  ]

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
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="loc">
      <div className="loc-head">
        <DoodleButton seed={1} selected={open} className="loc-toggle" aria-expanded={open} aria-label="지역 검색 열기" onClick={() => setOpen((o) => !o)}>
          <Magnifier />
          <span className="loc-name">
            <HandText>{currentName}</HandText>
          </span>
        </DoodleButton>
        {target.kind !== 'home' && (
          <DoodleButton seed={2} className="small loc-home" aria-label="내 위치로 돌아가기" onClick={() => { onHome(); setOpen(false) }}>
            <Pin />
            <HandText>내 위치</HandText>
          </DoodleButton>
        )}
        {target.kind !== 'home' && (
          <button type="button" className="loc-star" aria-pressed={saved} aria-label={saved ? '즐겨찾기에서 빼기' : '즐겨찾기에 담기'} disabled={saving} onClick={onToggleSaved}>
            <Star filled={saved} />
          </button>
        )}
      </div>

      {open && (
        <div className="box w2 loc-panel">
          <input
            ref={inputRef}
            className="loc-input"
            type="text"
            value={q}
            placeholder="지역을 입력하세요."
            aria-label="지역 검색"
            aria-autocomplete="list"
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

          <div className="loc-fav-title">
            <HandText>즐겨찾기</HandText>
            <span className="tiny"> {favorites.length}/10</span>
          </div>
          <div className="loc-chips" aria-label="즐겨찾기 목록 (옆으로 넘겨보세요)">
            {favorites.map((f, i) => (
              <span key={f.id} className="loc-chip">
                <DoodleButton seed={i + 1} className="small" selected={target.kind === 'fav' && target.id === f.id} onClick={() => { onFavorite(f); setOpen(false) }}>
                  <Star filled size={16} />
                  <HandText>{f.name}</HandText>
                </DoodleButton>
                <button type="button" className="loc-x" aria-label={`${f.name} 즐겨찾기 삭제`} onClick={() => onRemoveFavorite(f)}>
                  ×
                </button>
              </span>
            ))}
          </div>
          {favorites.length === 0 && <p className="tiny">지역을 검색한 뒤 별을 누르면 여기에 담겨요 (최대 10곳)</p>}
        </div>
      )}
    </div>
  )
}
