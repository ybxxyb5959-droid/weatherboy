import { useEffect, useRef, useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import ClothingDoodle from '../components/ClothingDoodle'
import DoodleButton, { ChoiceRow } from '../components/DoodleButton'
import { categories, clothingTypes, colorNames, patternNames } from '../mocks/clothes'
import { api, ApiError, errorMessage } from '../api'
import { useAsync } from '../hooks'
import type { Clothing } from '../mocks/clothes'
import LimitNotice from '../components/LimitNotice'
import AiUsageBar from '../components/AiUsageBar'
import HangLoader from '../components/HangLoader'
import { CameraIcon } from '../components/ToolIcons'
import { photoBlocked, useAiUsage } from '../lib/useAiUsage'
import { isPhotoLimit, splitForScan, type ClothingSuggestion } from '../lib/ai'

type Found = ClothingSuggestion & { label: string; key: number; checked: boolean; dup?: boolean }
let nextKey = 1

// 사진에 어떤 옷만 있는지 알려 주면 AI 가 상의·하의를 헷갈리지 않는다(같은 호출 수, 더 정확)
const PART_LABELS = ['섞여 있어요', '상의·겉옷만', '하의만'] as const
const PART_VALUE = { '섞여 있어요': 'all', '상의·겉옷만': 'top', '하의만': 'bottom' } as const

// 종류·색·무늬가 같으면 같은 옷으로 본다(같은 옷을 여러 벌 담지 않는다)
const sameKey = (c: { type: string; color: string; pattern?: string }) => `${c.type}|${c.color}|${c.pattern ?? '무지'}`

/** 이미 옷장에 있다는 초록 체크 표시 */
function OwnedCheck() {
  return (
    <span className="scan-owned-mark" role="img" aria-label="이미 등록되어 있어요">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="#4fae6a" stroke="#222" strokeWidth="1.6" />
        <path d="M7 12.5 L10.5 16 L17 8.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

// 한 번에 상의/하의/겉옷을 바꾸는 줄: 바꾸면 그 구분의 대표 종류로 놓고, 자세한 종류는 "수정"에서 고른다
const CAT_DEFAULT = ['긴팔', '바지', '자켓']
const categoryIndex = (type: string) => categories.findIndex((c) => c.types.includes(type))

/** 옷장/행거 사진으로 옷을 한꺼번에 찾아서, 골라서 등록한다. AI 는 제안만 하고 사용자가 확인한다. */
export default function ScanClosetPage() {
  const nav = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Found[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [progress, setProgress] = useState('')
  const [busy, setBusy] = useState(false)
  const [part, setPart] = useState<(typeof PART_LABELS)[number]>('섞여 있어요')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [limited, setLimited] = useState(false) // 사진 인식 한도에 걸림: 직접 등록으로 안내한다
  const [merged, setMerged] = useState(0) // 같은 옷이라 하나로 합친 수
  // 내 옷장에 이미 있는 옷(예시 옷은 진짜 내 옷이 아니라서 뺀다)
  const closet = useAsync(() => api<Clothing[]>('GET', '/api/clothes'))
  const ownedKeys = new Set((closet.data ?? []).filter((c) => !c.isSample).map(sameKey))
  // 사진 분석 도중(비동기)에 최신 목록·내 옷을 읽기 위한 사본
  const itemsRef = useRef(items)
  const ownedRef = useRef(ownedKeys)
  useEffect(() => {
    itemsRef.current = items
    ownedRef.current = ownedKeys
  })
  const usage = useAiUsage(true, busy) // 오늘 남은 양(스캔이 끝날 때마다 다시 읽는다)
  const blocked = photoBlocked(usage)

  const analyze = async (files: FileList | null) => {
    if (!files || files.length === 0 || busy) return
    setBusy(true)
    setError('')
    setLimited(false)
    const failed: string[] = []
    const seen = new Set(itemsRef.current.map(sameKey)) // 지금까지 목록에 있는 옷(같은 옷은 한 벌로 합친다)
    let dropped = 0
    setMerged(0)
    let stop = false // 한도에 걸리면 남은 조각/사진은 더 부르지 않는다
    try {
      const list = Array.from(files).slice(0, 4)
      for (let i = 0; i < list.length && !stop; i++) {
        try {
          const tiles = await splitForScan(list[i]!)
          setProgress(`${i + 1}/${list.length}번째 사진 살펴보는 중…`)
          // 한 사진의 구간들은 동시에 보낸다(차례로 기다리지 않아 빨라진다). 결과는 구간 순서대로 합친다.
          const settled = await Promise.allSettled(tiles.map((tile) => api<{ items: (ClothingSuggestion & { label: string })[] }>('POST', '/api/ai/clothes-from-photo', { image: tile, part: PART_VALUE[part] })))
          // 같은 사진의 바로 앞 조각에서 찾은 옷 (겹치는 구간의 같은 옷을 가려내기 위해)
          let prevTile: Found[] = []
          let firstError: unknown = null
          for (const res of settled) {
            if (res.status === 'rejected') {
              firstError ??= res.reason
              prevTile = []
              continue
            }
            const sameAsBefore = (it: ClothingSuggestion & { label: string }) => prevTile.some((p) => p.type === it.type && p.color === it.color && p.pattern === it.pattern && p.label === it.label)
            const found: Found[] = res.value.items.map((it) => {
              const dup = sameAsBefore(it)
              // 종류가 헷갈린다고 한 옷은 체크를 풀어 둔다(틀린 옷이 그대로 등록되지 않게)
              return { ...it, key: nextKey++, checked: !dup && it.confidence !== '헷갈림', dup }
            })
            // 같은 옷(종류·색·무늬)은 한 벌로 합친다. 이미 옷장에 있는 옷도 한 줄만 남겨 "이미 등록"으로 보여준다.
            const add: Found[] = []
            for (const f of found) {
              const k = sameKey(f)
              if (seen.has(k)) {
                dropped++
                continue
              }
              seen.add(k)
              add.push(ownedRef.current.has(k) ? { ...f, checked: false } : f)
            }
            if (add.length > 0) setItems((prev) => [...prev, ...add])
            if (dropped > 0) setMerged(dropped)
            prevTile = found
          }
          if (firstError) throw firstError
        } catch (e) {
          if (e instanceof ApiError && isPhotoLimit(e)) {
            setLimited(true)
            stop = true
          }
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
  const isOwned = (it: Found) => ownedKeys.has(sameKey(it))
  // 등록할 옷: 체크된 것 중 이미 옷장에 있는 옷은 빼고, 고치다가 같아진 옷은 한 벌만
  const chosen = (() => {
    const seen = new Set<string>()
    return items.filter((it) => {
      if (!it.checked || isOwned(it) || seen.has(sameKey(it))) return false
      seen.add(sameKey(it))
      return true
    })
  })()

  const saveAll = async () => {
    if (saving || chosen.length === 0) return
    setSaving(true)
    setError('')
    const ids: string[] = []
    try {
      // 한 번의 요청에 최대 40벌씩 묶어서 보낸다(한 벌씩 기다리지 않는다). 묶음 안에서는 전부 담기거나 하나도 안 담긴다.
      for (let at = 0; at < chosen.length; at += 40) {
        const batch = chosen.slice(at, at + 40)
        // 두께·방풍·방수는 보내지 않는다. 서버가 옷 종류로 정한다.
        const rows = await api<{ id: string }[]>('POST', '/api/clothes/bulk', { items: batch.map((it) => ({ type: it.type, color: it.color, pattern: it.pattern })) })
        ids.push(...rows.map((r) => r.id))
        const done = new Set(batch.map((it) => it.key))
        setItems((prev) => prev.filter((x) => !done.has(x.key))) // 등록한 건 목록에서 지운다 (다음 묶음이 실패해도 중복 등록 방지)
      }
      nav('/wardrobe', { state: { hung: ids } }) // 저장한 옷이 빨랫줄에 걸리는 모습을 보여준다
    } catch (e) {
      setError(errorMessage(e))
      setSaving(false)
    }
  }

  return (
    <main>
      <div className="page-head">
        <div className="row"><BackButton /><h1>옷장 사진으로 등록</h1></div>
      </div>

      <div className="field ai-box" style={{ marginTop: 0 }}>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void analyze(e.target.files)} />
        <AiUsageBar usage={usage} />
        <div className="name">사진 속 옷</div>
        <ChoiceRow options={[...PART_LABELS]} value={part} onChange={setPart} />
        <p className="tiny ai-note">상의만, 하의만 찍었다면 골라 주세요. 상의와 하의를 헷갈리는 실수가 크게 줄어요.</p>
        <DoodleButton seed={2} className="block sketchy" icon={<CameraIcon />} onClick={() => fileRef.current?.click()} disabled={busy || saving || blocked}>
          {busy ? progress || '살펴보는 중…' : '옷장·행거 사진 고르기'}
        </DoodleButton>
        <p className="tiny ai-warn">⚠ 여러 벌 인식은 가려지거나 겹친 옷을 놓치거나 잘못 알아볼 수 있어서 <b>정확도가 떨어질 수 있어요.</b> 목록을 꼭 확인하고, 틀린 옷은 수정하거나 체크를 풀어주세요.</p>
        <p className="tiny ai-note">행거 사진은 가로로 길면 자동으로 3구간으로 나눠 찾아요(최대 4장). 종류·색·무늬만 찾아요.</p>
      </div>

      {limited ? (
        <LimitNotice message={error}>
          <DoodleButton seed={1} className="small" onClick={() => nav('/wardrobe/add')}>
            직접 골라서 넣기
          </DoodleButton>
        </LimitNotice>
      ) : (
        error && <p role="alert">{error}</p>
      )}

      {busy && <HangLoader label={progress || '살펴보는 중…'} sub={items.length > 0 ? `지금까지 ${items.length}벌 찾았어요` : '사진 속 옷을 하나씩 찾고 있어요'} pieces={items} />}
      {saving && <HangLoader label="옷을 걸어두는 중이에요" sub={`${chosen.length}벌을 옷장에 넣고 있어요`} pieces={chosen} />}

      {items.length > 0 && (
        <>
          <p className="scan-count">
            {items.length}벌을 찾았어요. 등록할 옷만 남겨주세요.
          </p>
          {(merged > 0 || items.some(isOwned)) && (
            <p className="tiny">
              {merged > 0 ? `똑같은 옷 ${merged}벌은 하나로 합쳤어요. ` : ''}
              {items.some(isOwned) ? '초록 체크는 이미 옷장에 있는 옷이라 등록하지 않아요.' : ''}
            </p>
          )}
          <ul className="scan-list">
            {items.map((it) => (
              <li key={it.key} className={`scan-item${isOwned(it) ? ' owned' : it.checked ? '' : ' off'}`}>
                <div className="scan-row">
                  {isOwned(it) ? (
                    <OwnedCheck />
                  ) : (
                    <button type="button" className={`scan-check${it.checked ? ' on' : ''}`} aria-pressed={it.checked} aria-label={`${it.label} 등록`} onClick={() => patch(it.key, { checked: !it.checked })}>
                      {it.checked ? '✓' : ''}
                    </button>
                  )}
                  <ClothingDoodle type={it.type} color={it.color} pattern={it.pattern} size={48} />
                  <div className="scan-info">
                    <strong>{it.label}</strong>
                    {isOwned(it) && <span className="tiny scan-owned"> · 이미 등록되어 있어요</span>}
                    {!isOwned(it) && it.dup && <span className="tiny"> · 겹쳐 찍힌 옷일 수 있어요</span>}
                    {it.confidence === '헷갈림' && <div className="tiny unsure">종류를 확인해 주세요</div>}
                    <div className="tiny">
                      {it.type} · {it.color}
                      {it.pattern !== '무지' ? ` · ${it.pattern}` : ''}
                    </div>
                    <div className="scan-cats" role="group" aria-label="종류 구분">
                      {categories.map((c, ci) => (
                        <button
                          key={c.name}
                          type="button"
                          className={`mini${categoryIndex(it.type) === ci ? ' on' : ''}`}
                          aria-pressed={categoryIndex(it.type) === ci}
                          onClick={() => categoryIndex(it.type) !== ci && patch(it.key, { type: CAT_DEFAULT[ci]!, label: `${it.color} ${CAT_DEFAULT[ci]!}`, confidence: '확실', checked: true })}
                        >
                          {c.name}
                        </button>
                      ))}
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
