import { useRef, useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import ClothingDoodle from '../components/ClothingDoodle'
import DoodleButton from '../components/DoodleButton'
import Fields from '../components/ClothingFields'
import SayBox from '../components/SayBox'
import { api, ApiError, errorMessage } from '../api'
import LimitNotice from '../components/LimitNotice'
import AiUsageBar from '../components/AiUsageBar'
import { photoBlocked, useAiUsage } from '../lib/useAiUsage'
import { isPhotoLimit, resizeImageToDataUrl, type ClothingSuggestion } from '../lib/ai'
import { clothingLabel, parseClothing, type ParsedClothing } from '../lib/clothingParse'

type Draft = ParsedClothing

const blank: Draft = { type: '맨투맨', color: '회색', pattern: '무지', colorGuessed: false }

/**
 * 옷 추가: 말로 적기가 주인공이고, 사진/직접 고르기는 그 아래 보조 수단이다.
 * 어떤 방법으로 넣든 '담은 옷' 목록에 쌓이고, 목록에서 확인·수정한 뒤 한 번에 저장한다.
 */
export default function AddClothingPage() {
  const nav = useNavigate()
  const [say, setSay] = useState('')
  const [sayNote, setSayNote] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [manual, setManual] = useState<Draft>(blank)
  const [showManual, setShowManual] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [limited, setLimited] = useState(false) // 사진 인식 한도에 걸림
  const fileRef = useRef<HTMLInputElement>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiNote, setAiNote] = useState('')
  const [aiMenu, setAiMenu] = useState(false) // 사진: 한 벌씩 / 여러 벌씩 선택 펼침
  const usage = useAiUsage(aiMenu, analyzing) // "사진으로"를 누르면 오늘 남은 양을 막대로 보여준다(사진을 한 번 올린 뒤에는 다시 읽는다)
  const blocked = photoBlocked(usage)

  // 문장을 옷 목록으로 바꾼다 (AI 없이 즉시). 제안일 뿐이라 사용자가 확인하고 저장한다.
  const fillFromText = (spoken?: string) => {
    const r = parseClothing(spoken ?? say)
    setError('')
    setEditing(null)
    if (r.items.length === 0) {
      setSayNote('옷 종류를 못 알아들었어요. 예: "검정 체크 맨투맨" · "흰 반팔이랑 청바지"')
      return
    }
    setDrafts((d) => [...d, ...r.items])
    setSay('')
    setSayNote(r.unknown.length ? `"${r.unknown.join('", "')}"은(는) 옷 종류를 찾지 못해 뺐어요.` : '')
  }

  // 사진 한 장으로 종류와 색을 채운다. 제안일 뿐이라 사용자가 확인하고 저장한다. (두께·방풍·방수는 묻지 않는다: 옷 종류로 서버가 정한다)
  const fromPhoto = async (file: File | undefined) => {
    if (!file || analyzing) return
    setAnalyzing(true)
    setError('')
    setLimited(false)
    setAiNote('')
    try {
      const image = await resizeImageToDataUrl(file)
      const s = await api<ClothingSuggestion>('POST', '/api/ai/clothing-from-photo', { image })
      setDrafts((d) => [...d, { type: s.type, color: s.color, pattern: s.pattern, colorGuessed: false }])
      setAiNote('AI가 종류·색·무늬를 채워 목록에 담았어요. 맞는지 확인하고 저장해주세요.')
      setAiMenu(false)
    } catch (e) {
      setLimited(e instanceof ApiError && isPhotoLimit(e))
      setError(e instanceof Error && !('status' in e) ? e.message : errorMessage(e))
    } finally {
      setAnalyzing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // 담은 옷을 차례로 저장한다. 저장하면 옷장으로 가서 새 옷이 빨랫줄에 걸린다.
  const save = async () => {
    if (saving || drafts.length === 0) return
    setSaving(true)
    setError('')
    let saved = 0
    const ids: string[] = []
    try {
      for (const d of drafts) {
        const row = await api<{ id: string }>('POST', '/api/clothes', { type: d.type, color: d.color, pattern: d.pattern })
        ids.push(row.id)
        saved++
      }
    } catch (e) {
      // 저장된 것만 목록에서 빼고, 나머지는 그대로 둔다
      setDrafts((d) => d.slice(saved))
      setError(`${saved ? `${saved}벌은 저장했고, ` : ''}${errorMessage(e)}`)
      setSaving(false)
      return
    }
    nav('/wardrobe', { state: { hung: ids } })
  }

  return (
    <main>
      <div className="page-head">
        <div className="row"><BackButton /><h1>옷 추가</h1></div>
      </div>

      <p className="add-lead">어떤 옷을 넣을까요?</p>
      <SayBox
        id="say-clothes"
        label="말로 적기"
        placeholder="예: 검정 체크 맨투맨, 흰 반팔이랑 청바지"
        value={say}
        onChange={setSay}
        onSubmit={fillFromText}
        busy={false}
        busyLabel=""
        submitLabel="담기"
        submitOnVoice
        note={sayNote}
      />

      <p className="tiny add-or">또는</p>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void fromPhoto(e.target.files?.[0])} />
      <div className="row stretch add-alt">
        <DoodleButton seed={2} className="sketchy" aria-expanded={aiMenu} onClick={() => setAiMenu((v) => !v)} disabled={analyzing}>
          {analyzing ? '살펴보는 중…' : '📸 사진으로'}
        </DoodleButton>
        <DoodleButton seed={3} className="sketchy" aria-expanded={showManual} onClick={() => setShowManual((v) => !v)}>
          ✋ 직접 고르기
        </DoodleButton>
      </div>

      {aiMenu && !analyzing && (
        <div className="ai-choice">
          <AiUsageBar usage={usage} />
          <button type="button" className="ai-opt" disabled={blocked} onClick={() => fileRef.current?.click()}>
            <strong>한 벌씩</strong>
            <span className="tiny">옷 한 벌이 잘 보이게 찍어요</span>
          </button>
          <button type="button" className="ai-opt" disabled={blocked} onClick={() => nav('/wardrobe/scan')}>
            <strong>여러 벌씩</strong>
            <span className="tiny">행거·옷장 사진으로 한꺼번에</span>
          </button>
          <p className="tiny ai-warn">여러 벌은 가려지거나 겹친 옷을 놓치거나 잘못 알아볼 수 있어서 정확도가 떨어질 수 있어요. 목록을 꼭 확인해주세요.</p>
        </div>
      )}
      {aiNote && <p className="tiny ai-note">{aiNote}</p>}

      {showManual && (
        <div className="add-manual">
          <Fields value={manual} onChange={setManual} />
          <div className="field">
            <DoodleButton
              seed={1}
              className="block small"
              onClick={() => {
                setDrafts((d) => [...d, manual])
                setManual(blank)
                setShowManual(false)
              }}
            >
              이 옷 담기
            </DoodleButton>
          </div>
        </div>
      )}

      {limited ? <LimitNotice message={error} /> : error && <p role="alert">{error}</p>}

      {drafts.length > 0 && (
        <section className="add-list" aria-label="담은 옷">
          <hr className="scribble" />
          <h2>담은 옷 ({drafts.length})</h2>
          <ul className="say-list">
            {drafts.map((d, i) => (
              <li key={`${i}-${clothingLabel(d)}`}>
                <div className="say-item">
                  <ClothingDoodle type={d.type} color={d.color} pattern={d.pattern} size={48} />
                  <div className="nm">
                    {clothingLabel(d) || d.type}
                    {d.colorGuessed && <span className="tiny">색을 못 알아봐서 기타로 뒀어요. 고쳐주세요.</span>}
                  </div>
                  <button type="button" className="dbtn w1 small" aria-expanded={editing === i} onClick={() => setEditing(editing === i ? null : i)}>
                    {editing === i ? '닫기' : '고치기'}
                  </button>
                  <button
                    type="button"
                    className="dbtn w2 small"
                    aria-label={`${clothingLabel(d)} 빼기`}
                    onClick={() => {
                      setDrafts((all) => all.filter((_, j) => j !== i))
                      setEditing(null)
                    }}
                  >
                    빼기
                  </button>
                </div>
                {editing === i && <Fields value={d} onChange={(v) => setDrafts((all) => all.map((x, j) => (j === i ? v : x)))} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {drafts.length > 0 && (
        <div className="field save-bar">
          <DoodleButton seed={1} className="block" onClick={() => void save()} disabled={saving}>
            {saving ? '저장 중…' : drafts.length > 1 ? `${drafts.length}벌 저장` : '저장'}
          </DoodleButton>
        </div>
      )}
    </main>
  )
}
