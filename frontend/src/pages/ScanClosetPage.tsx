import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ClothingDoodle from '../components/ClothingDoodle'
import DoodleButton, { ChoiceRow } from '../components/DoodleButton'
import { clothingTypes, colorNames, patternNames } from '../mocks/clothes'
import { api, errorMessage } from '../api'
import { splitForScan, type ClothingSuggestion } from '../lib/ai'

type Found = ClothingSuggestion & { label: string; key: number; checked: boolean; dup?: boolean }
let nextKey = 1

/** 옷장/행거 사진으로 옷을 한꺼번에 찾아서, 골라서 등록한다. AI 는 제안만 하고 사용자가 확인한다. */
export default function ScanClosetPage() {
  const nav = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Found[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [progress, setProgress] = useState('')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const analyze = async (files: FileList | null) => {
    if (!files || files.length === 0 || busy) return
    setBusy(true)
    setError('')
    const failed: string[] = []
    try {
      const list = Array.from(files).slice(0, 4)
      for (let i = 0; i < list.length; i++) {
        try {
          const tiles = await splitForScan(list[i]!)
          // 같은 사진의 바로 앞 조각에서 찾은 옷 (겹치는 구간의 같은 옷을 가려내기 위해)
          let prevTile: Found[] = []
          for (let t = 0; t < tiles.length; t++) {
            setProgress(`${i + 1}/${list.length}번째 사진 ${tiles.length > 1 ? `(${t + 1}/${tiles.length}구간) ` : ''}살펴보는 중…`)
            const r = await api<{ items: (ClothingSuggestion & { label: string })[] }>('POST', '/api/ai/clothes-from-photo', { image: tiles[t] })
            const sameAsBefore = (it: ClothingSuggestion & { label: string }) => prevTile.some((p) => p.type === it.type && p.color === it.color && p.pattern === it.pattern && p.label === it.label)
            const found: Found[] = r.items.map((it) => {
              const dup = sameAsBefore(it)
              return { ...it, key: nextKey++, checked: !dup, dup }
            })
            setItems((prev) => [...prev, ...found])
            prevTile = found
          }
        } catch (e) {
          failed.push(e instanceof Error && !('status' in e) ? e.message : errorMessage(e))
        }
      }
      if (failed.length > 0) setError(failed[0]!)
    } finally {
      setBusy(false)
      setProgress('')
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const patch = (key: number, p: Partial<Found>) => setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...p } : it)))
  const chosen = items.filter((it) => it.checked)

  const saveAll = async () => {
    if (saving || chosen.length === 0) return
    setSaving(true)
    setError('')
    try {
      for (const it of chosen) {
        // 두께·방풍·방수는 보내지 않는다. 서버가 옷 종류로 정한다.
        await api('POST', '/api/clothes', { type: it.type, color: it.color, pattern: it.pattern })
        setItems((prev) => prev.filter((x) => x.key !== it.key)) // 등록한 건 목록에서 지운다 (중간에 실패해도 중복 등록 방지)
      }
      nav('/wardrobe')
    } catch (e) {
      setError(errorMessage(e))
      setSaving(false)
    }
  }

  return (
    <main>
      <div className="page-head">
        <h1>옷장 사진으로 등록</h1>
      </div>

      <div className="field ai-box" style={{ marginTop: 0 }}>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void analyze(e.target.files)} />
        <DoodleButton seed={2} className="block sketchy" onClick={() => fileRef.current?.click()} disabled={busy || saving}>
          {busy ? progress || '살펴보는 중…' : '📸 옷장·행거 사진 고르기'}
        </DoodleButton>
        <p className="tiny ai-warn">⚠ 여러 벌 인식은 가려지거나 겹친 옷을 놓치거나 잘못 알아볼 수 있어서 <b>정확도가 떨어질 수 있어요.</b> 목록을 꼭 확인하고, 틀린 옷은 수정하거나 체크를 풀어주세요.</p>
        <p className="tiny ai-note">행거 사진은 가로로 길면 자동으로 3구간으로 나눠 찾아요(최대 4장). 종류·색·무늬만 찾아요.</p>
      </div>

      {error && <p role="alert">{error}</p>}

      {items.length > 0 && (
        <>
          <p className="scan-count">
            {items.length}벌을 찾았어요. 등록할 옷만 남겨주세요.
          </p>
          <ul className="scan-list">
            {items.map((it) => (
              <li key={it.key} className={`scan-item${it.checked ? '' : ' off'}`}>
                <div className="scan-row">
                  <button type="button" className={`scan-check${it.checked ? ' on' : ''}`} aria-pressed={it.checked} aria-label={`${it.label} 등록`} onClick={() => patch(it.key, { checked: !it.checked })}>
                    {it.checked ? '✓' : ''}
                  </button>
                  <ClothingDoodle type={it.type} color={it.color} pattern={it.pattern} size={48} />
                  <div className="scan-info">
                    <strong>{it.label}</strong>
                    {it.dup && <span className="tiny"> · 겹쳐 찍힌 옷일 수 있어요</span>}
                    <div className="tiny">
                      {it.type} · {it.color}
                      {it.pattern !== '무지' ? ` · ${it.pattern}` : ''}
                    </div>
                  </div>
                  <button type="button" className="mini" onClick={() => setEditing(editing === it.key ? null : it.key)}>
                    {editing === it.key ? '닫기' : '수정'}
                  </button>
                </div>
                {editing === it.key && (
                  <div className="scan-edit">
                    <div className="name">종류</div>
                    <ChoiceRow options={clothingTypes} value={it.type} onChange={(v) => patch(it.key, { type: v })} />
                    <div className="name">색상</div>
                    <ChoiceRow options={colorNames} value={it.color} onChange={(v) => patch(it.key, { color: v })} />
                    <div className="name">무늬</div>
                    <ChoiceRow options={patternNames} value={it.pattern} onChange={(v) => patch(it.key, { pattern: v })} />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="field">
            <DoodleButton seed={1} className="block" onClick={() => void saveAll()} disabled={saving || chosen.length === 0}>
              {saving ? '등록 중…' : `선택한 ${chosen.length}벌 옷장에 등록`}
            </DoodleButton>
          </div>
        </>
      )}
    </main>
  )
}
