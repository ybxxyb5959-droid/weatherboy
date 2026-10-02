import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ClothingDoodle from '../components/ClothingDoodle'
import { Clothespin } from '../components/Clothesline'
import DoodleButton from '../components/DoodleButton'
import Fields from '../components/ClothingFields'
import type { Clothing } from '../mocks/clothes'
import type { ParsedClothing } from '../lib/clothingParse'
import { api, errorMessage } from '../api'
import { useAsync } from '../hooks'

/** 잘못 등록한 옷의 종류·색·무늬를 고친다. 저장하면 예시 옷도 '내 옷'이 된다. */
export default function EditClothingPage() {
  const { id = '' } = useParams()
  const { data, error, loading } = useAsync(() => api<Clothing[]>('GET', '/api/clothes'), id)
  const cloth = data?.find((c) => c.id === id)
  if (loading) return <main><p>불러오는 중…</p></main>
  if (error || !cloth) {
    return (
      <main>
        <div className="empty">
          <p role="alert">{error ?? '옷을 찾을 수 없어요. 이미 지웠을 수 있어요.'}</p>
          <Link to="/wardrobe" className="dbtn w1">옷장으로</Link>
        </div>
      </main>
    )
  }
  return <Editor cloth={cloth} />
}

function Editor({ cloth }: { cloth: Clothing }) {
  const nav = useNavigate()
  const [v, setV] = useState<ParsedClothing>({ type: cloth.type, color: cloth.color, pattern: cloth.pattern ?? '무지', colorGuessed: false })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    if (saving) return
    setSaving(true)
    setErr('')
    try {
      await api('PATCH', `/api/clothes/${cloth.id}`, { type: v.type, color: v.color, pattern: v.pattern })
      nav('/wardrobe')
    } catch (e) {
      setErr(errorMessage(e))
      setSaving(false)
    }
  }

  return (
    <main>
      <div className="page-head">
        <h1>옷 고치기</h1>
        <div style={{ position: 'relative', width: 70, height: 70, marginTop: 10 }}>
          <Clothespin style={{ left: 14, top: -14 }} />
          <Clothespin style={{ left: 40, top: -14 }} />
          <ClothingDoodle type={v.type} color={v.color} pattern={v.pattern} size={70} />
        </div>
      </div>
      {cloth.isSample && <p className="tiny">예시 옷이에요. 저장하면 내 옷으로 확인돼요.</p>}
      <Fields value={v} onChange={setV} />
      {err && <p role="alert">{err}</p>}
      <div className="field save-bar">
        <div className="row stretch">
          <DoodleButton seed={1} className="block" onClick={() => void save()} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </DoodleButton>
          <DoodleButton seed={2} className="block" onClick={() => nav('/wardrobe')} disabled={saving}>
            취소
          </DoodleButton>
        </div>
      </div>
    </main>
  )
}
