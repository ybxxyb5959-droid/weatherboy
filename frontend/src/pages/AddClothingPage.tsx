import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ClothingDoodle from '../components/ClothingDoodle'
import { Clothespin } from '../components/Clothesline'
import DoodleButton from '../components/DoodleButton'
import Fields from '../components/ClothingFields'
import SayBox from '../components/SayBox'
import { api, errorMessage } from '../api'
import { resizeImageToDataUrl, type ClothingSuggestion } from '../lib/ai'
import { clothingLabel, parseClothing, type ParsedClothing } from '../lib/clothingParse'

type Draft = ParsedClothing

const blank: Draft = { type: '맨투맨', color: '회색', pattern: '무지', colorGuessed: false }

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
  const [done, setDone] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiNote, setAiNote] = useState('')
  const [aiMenu, setAiMenu] = useState(false) // 사진 자동 입력: 한 벌씩 / 여러 벌씩 선택 펼침

  // 문장을 옷 목록으로 바꾼다 (AI 없이 즉시). 제안일 뿐이라 사용자가 확인하고 저장한다.
  const fillFromText = (spoken?: string) => {
    const r = parseClothing(spoken ?? say)
    setError('')
    setDone('')
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
    setAiNote('')
    try {
      const image = await resizeImageToDataUrl(file)
      const s = await api<ClothingSuggestion>('POST', '/api/ai/clothing-from-photo', { image })
      setDrafts((d) => [...d, { type: s.type, color: s.color, pattern: s.pattern, colorGuessed: false }])
      setAiNote('AI가 종류·색·무늬를 채워 목록에 담았어요. 맞는지 확인하고 저장해주세요.')
      setAiMenu(false)
    } catch (e) {
      setError(e instanceof Error && !('status' in e) ? e.message : errorMessage(e))
    } finally {
      setAnalyzing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // 목록의 옷을 차례로 저장한다. 목록이 비어 있고 직접 고르는 칸이 열려 있으면 그 한 벌을 저장한다.
  const save = async (another: boolean) => {
    if (saving) return
    const queue = drafts.length > 0 ? drafts : showManual ? [manual] : []
    if (queue.length === 0) return
    setSaving(true)
    setError('')
    setDone('')
    let saved = 0
    const ids: string[] = []
    try {
      for (const d of queue) {
        const row = await api<{ id: string }>('POST', '/api/clothes', { type: d.type, color: d.color, pattern: d.pattern })
        ids.push(row.id)
        saved++
      }
    } catch (e) {
      // 저장된 것만 목록에서 빼고, 나머지는 그대로 둔다
      if (drafts.length > 0) setDrafts((d) => d.slice(saved))
      setError(`${saved ? `${saved}벌은 저장했고, ` : ''}${errorMessage(e)}`)
      setSaving(false)
      return
    }
    if (!another) {
      nav('/wardrobe', { state: { hung: ids } }) // 옷장에서 새 옷이 빨랫줄에 걸리는 모습을 보여준다
      return
    }
    setDrafts([])
    setEditing(null)
    setManual(blank)
    setDone(`${saved}벌 저장했어요. 이어서 추가해보세요.`)
    setSaving(false)
  }

  const head = drafts[0] ?? manual
  const count = drafts.length > 0 ? drafts.length : showManual ? 1 : 0

  return (
    <main>
      <div className="page-head">
        <h1>옷 추가</h1>
        <div style={{ position: 'relative', width: 70, height: 70, marginTop: 10 }}>
          <Clothespin style={{ left: 14, top: -14 }} />
          <Clothespin style={{ left: 40, top: -14 }} />
          <ClothingDoodle type={head.type} color={head.color} pattern={head.pattern} size={70} />
        </div>
      </div>

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

      {drafts.length > 0 && (
        <ul className="say-list" aria-label="추가할 옷 목록">
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
                <button type="button" className="dbtn w2 small" aria-label={`${clothingLabel(d)} 빼기`} onClick={() => { setDrafts((all) => all.filter((_, j) => j !== i)); setEditing(null) }}>
                  빼기
                </button>
              </div>
              {editing === i && <Fields value={d} onChange={(v) => setDrafts((all) => all.map((x, j) => (j === i ? v : x)))} />}
            </li>
          ))}
        </ul>
      )}

      <div className="field ai-box">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void fromPhoto(e.target.files?.[0])} />
        <DoodleButton seed={2} className="block sketchy" aria-expanded={aiMenu} onClick={() => setAiMenu((v) => !v)} disabled={analyzing}>
          {analyzing ? '옷을 살펴보는 중…' : '📸 사진으로 자동 입력'}
        </DoodleButton>
        {aiMenu && !analyzing && (
          <div className="ai-choice">
            <button type="button" className="ai-opt" onClick={() => fileRef.current?.click()}>
              <strong>한 벌씩</strong>
              <span className="tiny">옷 한 벌이 잘 보이게 찍어요</span>
            </button>
            <button type="button" className="ai-opt" onClick={() => nav('/wardrobe/scan')}>
              <strong>여러 벌씩</strong>
              <span className="tiny">행거·옷장 사진으로 한꺼번에</span>
            </button>
            <p className="tiny ai-warn">여러 벌은 가려지거나 겹친 옷을 놓치거나 잘못 알아볼 수 있어서 정확도가 떨어질 수 있어요. 목록을 꼭 확인해주세요.</p>
          </div>
        )}
        {aiNote && <p className="tiny ai-note">{aiNote}</p>}
      </div>

      <div className="field">
        <DoodleButton seed={3} className="block small" aria-expanded={showManual} onClick={() => setShowManual((v) => !v)}>
          {showManual ? '직접 고르기 접기' : '✋ 직접 고르기'}
        </DoodleButton>
      </div>
      {showManual && (
        <>
          <Fields value={manual} onChange={setManual} />
          {drafts.length > 0 && (
            <div className="field">
              <DoodleButton seed={1} className="block small" onClick={() => { setDrafts((d) => [...d, manual]); setManual(blank) }}>
                이 옷을 목록에 담기
              </DoodleButton>
            </div>
          )}
        </>
      )}

      {error && <p role="alert">{error}</p>}
      {done && <p role="status" className="tiny">{done}</p>}

      <div className="field save-bar">
        <div className="row stretch">
          <DoodleButton seed={1} className="block" onClick={() => void save(false)} disabled={saving || count === 0}>
            {saving ? '저장 중…' : count > 1 ? `${count}벌 저장` : '저장'}
          </DoodleButton>
          <DoodleButton seed={2} className="block" onClick={() => void save(true)} disabled={saving || count === 0}>
            저장하고 하나 더
          </DoodleButton>
        </div>
        {count === 0 && <p className="tiny">위에 말로 적거나, 사진·직접 고르기로 옷을 담아주세요.</p>}
      </div>
    </main>
  )
}
