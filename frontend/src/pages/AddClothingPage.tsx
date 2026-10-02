import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ClothingDoodle from '../components/ClothingDoodle'
import { Clothespin } from '../components/Clothesline'
import DoodleButton, { ChoiceRow } from '../components/DoodleButton'
import { clothingTypes, colorHex, colorNames, patternNames } from '../mocks/clothes'
import { api, errorMessage } from '../api'
import { resizeImageToDataUrl, type ClothingSuggestion } from '../lib/ai'

export default function AddClothingPage() {
  const nav = useNavigate()
  const [type, setType] = useState('맨투맨')
  const [color, setColor] = useState('회색')
  const [pattern, setPattern] = useState('무지')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiNote, setAiNote] = useState('')
  const [aiMenu, setAiMenu] = useState(false) // 사진 자동 입력: 한 벌씩 / 여러 벌씩 선택 펼침

  // 사진 한 장으로 종류와 색을 채운다. 제안일 뿐이라 사용자가 확인하고 저장한다. (두께·방풍·방수는 묻지 않는다: 옷 종류로 서버가 정한다)
  const fromPhoto = async (file: File | undefined) => {
    if (!file || analyzing) return
    setAnalyzing(true)
    setError('')
    setAiNote('')
    try {
      const image = await resizeImageToDataUrl(file)
      const s = await api<ClothingSuggestion>('POST', '/api/ai/clothing-from-photo', { image })
      setType(s.type)
      setColor(s.color)
      setPattern(s.pattern)
      setAiNote('AI가 종류·색·무늬를 채웠어요. 맞는지 확인하고 저장해주세요.')
      setAiMenu(false)
    } catch (e) {
      setError(e instanceof Error && !('status' in e) ? e.message : errorMessage(e))
    } finally {
      setAnalyzing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await api('POST', '/api/clothes', { type, color, pattern })
      nav('/wardrobe')
    } catch (e) {
      setError(errorMessage(e))
      setSaving(false)
    }
  }

  return (
    <main>
      <div className="page-head">
        <h1>옷 추가</h1>
        <div style={{ position: 'relative', width: 70, height: 70, marginTop: 10 }}>
          <Clothespin style={{ left: 14, top: -14 }} />
          <Clothespin style={{ left: 40, top: -14 }} />
          <ClothingDoodle type={type} color={color} pattern={pattern} size={70} />
        </div>
      </div>

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
        <div className="name">종류</div>
        <ChoiceRow options={clothingTypes} value={type} onChange={setType} />
      </div>
      <div className="field">
        <div className="name">색상</div>
        <div className="row wrap">
          {colorNames.map((c, i) => (
            <DoodleButton key={c} seed={i} selected={color === c} className="colorbtn" onClick={() => setColor(c)}>
              <span className="swatch" style={{ background: colorHex[c] }} />
              {c}
            </DoodleButton>
          ))}
        </div>
      </div>
      <div className="field">
        <div className="name">무늬</div>
        <ChoiceRow options={patternNames} value={pattern} onChange={setPattern} />
      </div>
      {error && <p role="alert">{error}</p>}

      <div className="field">
        <DoodleButton seed={1} className="block" onClick={() => void save()}>
          {saving ? '저장 중…' : '저장'}
        </DoodleButton>
      </div>
    </main>
  )
}
