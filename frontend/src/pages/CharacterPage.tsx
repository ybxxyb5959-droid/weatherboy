import { useState } from 'react'
import DoodleButton from '../components/DoodleButton'
import StickPerson from '../components/StickPerson'
import type { Accessories } from '../components/CharacterDecor'
import { colorHex } from '../mocks/clothes'
import { BASIC_WEAR, PERSONA_WEAR, useCharacter, type Share } from '../lib/character'
import { errorMessage } from '../api'

type Slot = keyof Accessories

const pct = (s: number) => `${Math.round(s * 100)}%`

/** 비중 막대. 색 비중은 그 옷 색으로 칠한다. */
function Bars({ title, rows, colored = false, max = 5 }: { title: string; rows: Share[]; colored?: boolean; max?: number }) {
  if (rows.length === 0) return null
  return (
    <div className="char-bars">
      <div className="name">{title}</div>
      {rows.slice(0, max).map((r) => (
        <div key={r.name} className="char-bar">
          <span className="lbl">{r.name}</span>
          <span className="track">
            <i style={{ width: `${Math.max(4, r.share * 100)}%`, background: colored ? (colorHex[r.name] ?? '#ccc') : undefined }} />
          </span>
          <span className="val">{pct(r.share)}</span>
        </div>
      ))}
    </div>
  )
}

export default function CharacterPage() {
  const { data, error, saveConfig } = useCharacter()
  const [draft, setDraft] = useState<Accessories | null>(null) // 꾸미는 중인 값 (저장 누르면 반영)
  const [slot, setSlot] = useState<Slot>('hat')
  const [preview, setPreview] = useState<string | null>(null) // 칭호 도감에서 눌러 본 다른 칭호의 모습 (내 칭호는 그대로)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [fail, setFail] = useState('')

  if (!data) {
    return (
      <main>
        <div className="page-head">
          <h1>내 캐릭터</h1>
        </div>
        {error ? <p role="alert">{error}</p> : <p>불러오는 중…</p>}
      </main>
    )
  }

  const a = data.analysis
  const title = a.title
  const config = draft ?? data.config
  const shown = preview ? (data.titles.find((t) => t.key === preview) ?? title) : title
  const wear = (shown && PERSONA_WEAR[shown.key]) || BASIC_WEAR
  const changed = draft !== null && JSON.stringify(normalize(draft)) !== JSON.stringify(normalize(data.config))
  const current = data.catalog.find((c) => c.slot === slot)!

  const pick = (id: string | null) => {
    setMsg('')
    const next = { ...config }
    if (id === null) delete next[slot]
    else next[slot] = id
    setDraft(next)
  }
  const save = async () => {
    if (!changed || saving) return
    setSaving(true)
    setFail('')
    try {
      await saveConfig(config)
      setDraft(null)
      setMsg('캐릭터를 저장했어요. 홈의 캐릭터도 똑같이 꾸며졌어요.')
    } catch (e) {
      setFail(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="character">
      <div className="page-head">
        <h1>내 캐릭터</h1>
      </div>

      <section className="char-hero">
        <StickPerson mood="stand" size={200} wear={wear} persona={shown?.key ?? null} accessories={config} />
        {preview && shown ? (
          <>
            <h2 className="char-title">{shown.name}</h2>
            <p className="char-tag">{shown.tagline}</p>
            <p className="tiny">미리보기예요 · {shown.rule}</p>
            <button type="button" className="dbtn small" onClick={() => setPreview(null)}>
              내 칭호로 돌아가기
            </button>
          </>
        ) : title ? (
          <>
            <h2 className="char-title">{title.name}</h2>
            <p className="char-tag">{title.tagline}</p>
          </>
        ) : (
          <>
            <h2 className="char-title">아직 칭호가 없어요</h2>
            <p className="char-tag">{a.count === 0 ? '옷장에 옷을 담으면 내 옷장을 분석해서 칭호를 드려요.' : `옷을 ${a.need}벌 더 담으면 칭호를 드려요. (지금 ${a.count}벌)`}</p>
          </>
        )}
      </section>

      {msg && <p role="status" className="set-msg set-saved">✓ {msg}</p>}
      {fail && <p role="alert">{fail}</p>}

      <hr className="scribble" />

      <section>
        <h2>꾸미기</h2>
        <div className="char-slots" role="tablist" aria-label="꾸미기 칸">
          {data.catalog.map((c) => (
            <button key={c.slot} type="button" role="tab" aria-selected={slot === c.slot} className={`dbtn small${slot === c.slot ? ' on' : ''}`} onClick={() => setSlot(c.slot)}>
              {c.label}
              {config[c.slot] ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <div className="char-items" role="group" aria-label={`${current.label} 고르기`}>
          <button type="button" className={`dbtn small${config[slot] ? '' : ' on'}`} aria-pressed={!config[slot]} onClick={() => pick(null)}>
            벗기
          </button>
          {current.items.map((it) => (
            <button key={it.id} type="button" className={`dbtn small${config[slot] === it.id ? ' on' : ''}`} aria-pressed={config[slot] === it.id} onClick={() => pick(it.id)}>
              {it.label}
            </button>
          ))}
        </div>
        <div className="field">
          <DoodleButton seed={1} className="block" onClick={() => void save()} disabled={!changed || saving}>
            {saving ? '저장 중…' : '저장'}
          </DoodleButton>
        </div>
      </section>

      <hr className="scribble" />

      <section>
        <h2>내 옷장 분석</h2>
        {a.count === 0 ? (
          <p className="tiny">아직 담은 옷이 없어요. 옷장에서 옷을 추가해 보세요. (예시 옷은 분석하지 않아요)</p>
        ) : (
          <>
            <p className="tiny">직접 담은 옷 {a.count}벌을 분석했어요.</p>
            <Bars title="색상" rows={a.colors} colored />
            <Bars title="종류" rows={a.types} />
            <Bars title="무늬" rows={a.patterns} max={3} />
          </>
        )}
      </section>

      <hr className="scribble" />

      <section>
        <h2>칭호 도감</h2>
        <p className="tiny">눌러 보면 그 칭호의 캐릭터를 미리 볼 수 있어요.</p>
        <ul className="char-dex">
          {data.titles.map((t) => (
            <li key={t.key} className={title?.key === t.key ? 'mine' : undefined}>
              <button type="button" className="dex-btn" aria-label={`${t.name} 모습 미리보기`} onClick={() => { setPreview(t.key); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                <b>{t.name}</b>
                {title?.key === t.key && <span className="tiny"> · 내 칭호</span>}
                <div className="tiny">{t.rule}</div>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

const normalize = (c: Accessories) => Object.fromEntries(Object.entries(c).filter(([, v]) => v).sort())
