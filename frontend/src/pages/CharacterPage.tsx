import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import StickPerson from '../components/StickPerson'
import { ItemThumb, type Accessories, type Slot } from '../components/CharacterDecor'
import { colorHex } from '../mocks/clothes'
import { BASIC_WEAR, PERSONA_WEAR, useCharacter, type Share } from '../lib/character'
import { buildCharacterCard, shareImage } from '../lib/shareCard'
import { useAuth } from '../auth'
import { errorMessage } from '../api'

const pct = (s: number) => `${Math.round(s * 100)}%`
const sameConfig = (a: Accessories, b: Accessories) => JSON.stringify(Object.entries(a).filter(([, v]) => v).sort()) === JSON.stringify(Object.entries(b).filter(([, v]) => v).sort())

/** 공유 아이콘 (상자에서 위로 나가는 화살표) */
function ShareIcon() {
  return (
    <svg viewBox="0 0 28 28" width="26" height="26" fill="none" stroke="#222" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 18 V4 M9 9 L14 4 L19 9 M6 13 V23 H22 V13" />
    </svg>
  )
}

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
  const { me } = useAuth()
  const [local, setLocal] = useState<Accessories | null>(null) // 고르는 즉시 보이는 값 (서버에는 잠깐 뒤 자동 저장)
  const [slot, setSlot] = useState<Slot>('hat')
  const [preview, setPreview] = useState<string | null>(null) // 칭호 도감에서 눌러 본 다른 칭호의 모습 (내 칭호는 그대로)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [note, setNote] = useState('')
  const [sharing, setSharing] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latest = useRef<Accessories | null>(null)

  useEffect(() => () => clearTimeout(timer.current), [])

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

  // 옷장을 채우기 전: 캐릭터는 잠겨 있다. 얼마나 남았는지와 옷 등록으로 가는 길을 보여주고, 받을 수 있는 칭호는 미리 볼 수 있다.
  if (!data.unlocked) {
    const shownLocked = preview ? data.titles.find((t) => t.key === preview) : null
    const left = Math.max(0, data.minClothes - a.count)
    return (
      <main className="character">
        <div className="page-head">
          <h1>내 캐릭터</h1>
        </div>
        <section className="char-hero">
          <StickPerson mood="stand" size={200} wear={(shownLocked && PERSONA_WEAR[shownLocked.key]) || BASIC_WEAR} persona={shownLocked?.key ?? null} />
          {shownLocked ? (
            <>
              <h2 className="char-title">{shownLocked.name}</h2>
              <p className="char-tag">{shownLocked.tagline}</p>
              <p className="tiny">미리보기예요 · {shownLocked.rule}</p>
              <button type="button" className="dbtn small" onClick={() => setPreview(null)}>
                닫기
              </button>
            </>
          ) : (
            <>
              <h2 className="char-title">옷장을 채우면 열려요</h2>
              <p className="char-tag">
                옷을 {data.minClothes}벌 이상 등록하면 내 옷장을 분석해서 <b>칭호</b>를 드리고, 캐릭터를 <b>꾸밀 수</b> 있어요.
              </p>
            </>
          )}
        </section>

        <div className="char-lock box w2">
          <div className="row between">
            <b>
              내 옷 {Math.min(a.count, data.minClothes)} / {data.minClothes}벌
            </b>
            <span className="tiny">{left > 0 ? `${left}벌 더 등록하면 열려요` : ''}</span>
          </div>
          <div className="char-bar">
            <span />
            <span className="track">
              <i style={{ width: `${Math.max(4, (Math.min(a.count, data.minClothes) / data.minClothes) * 100)}%` }} />
            </span>
            <span />
          </div>
          <Link to="/wardrobe/add" className="dbtn w1 block">
            + 옷 등록하러 가기
          </Link>
          <p className="tiny">말로 "검정 후드티, 청바지"라고 적거나 사진으로 한 번에 등록할 수 있어요.</p>
        </div>

        <hr className="scribble" />
        <section>
          <h2>받을 수 있는 칭호 ({data.titles.length})</h2>
          <p className="tiny">눌러 보면 그 칭호의 캐릭터를 미리 볼 수 있어요.</p>
          <ul className="char-dex">
            {data.titles.map((t) => (
              <li key={t.key}>
                <button
                  type="button"
                  className="dex-btn"
                  aria-label={`${t.name} 모습 미리보기`}
                  onClick={() => {
                    setPreview(t.key)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  <b>{t.name}</b>
                  <div className="tiny">{t.rule}</div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    )
  }

  const title = a.title
  const config = local ?? data.config
  const shown = preview ? (data.titles.find((t) => t.key === preview) ?? title) : title
  const wear = (shown && PERSONA_WEAR[shown.key]) || BASIC_WEAR
  const current = data.catalog.find((c) => c.slot === slot)!
  const equippedCount = Object.values(config).filter(Boolean).length

  // 고르면 바로 보이고, 0.5초 뒤에 저장한다 (빠르게 여러 개 골라도 한 번만 저장)
  const change = (next: Accessories) => {
    setLocal(next)
    latest.current = next
    setState('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await saveConfig(next)
        if (latest.current && sameConfig(latest.current, next)) setLocal(null)
        setState('saved')
      } catch (e) {
        setState('error')
        setNote(errorMessage(e))
      }
    }, 500)
  }
  const pick = (id: string) => {
    const next = { ...config }
    if (next[slot] === id) delete next[slot] // 입고 있는 걸 다시 누르면 벗는다
    else next[slot] = id
    change(next)
  }

  const share = async () => {
    if (sharing) return
    setSharing(true)
    setNote('')
    try {
      const card = await buildCharacterCard({
        title: shown?.name ?? '내 캐릭터',
        tagline: shown?.tagline ?? '옷장을 채우면 칭호를 드려요',
        persona: shown?.key ?? null,
        wear,
        accessories: config,
        colors: a.colors,
        count: a.count,
        code: (me?.id ?? '').slice(0, 8).toUpperCase(),
        origin: window.location.origin,
      })
      const text = `내 옷장 칭호는 "${shown?.name ?? '???'}"! 너는 어떤 칭호야? ${window.location.origin}`
      const r = await shareImage(card, text)
      if (r === 'downloaded') setNote('이미지로 저장했어요. 카카오톡에서 사진으로 보내 보세요.')
    } catch (e) {
      setNote(errorMessage(e))
    } finally {
      setSharing(false)
    }
  }

  return (
    <main className="character">
      <div className="page-head">
        <h1>내 캐릭터</h1>
        <button type="button" className="share-btn" onClick={() => void share()} disabled={sharing} aria-label="공유하기">
          <ShareIcon />
        </button>
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

      {note && (
        <p role="status" className="set-msg set-saved">
          {note}
        </p>
      )}

      <hr className="scribble" />

      <section>
        <div className="char-head">
          <h2>꾸미기</h2>
          <span className="tiny save-state" role="status">
            {state === 'saving' ? '저장 중…' : state === 'saved' ? '저장됨 ✓' : state === 'error' ? '저장 실패' : ''}
          </span>
          {equippedCount > 0 && (
            <button type="button" className="text-btn" onClick={() => change({})}>
              모두 벗기
            </button>
          )}
        </div>

        <div className="char-slots" role="tablist" aria-label="꾸미기 종류">
          {data.catalog.map((c) => (
            <button key={c.slot} type="button" role="tab" aria-selected={slot === c.slot} className={`char-tab${slot === c.slot ? ' on' : ''}`} onClick={() => setSlot(c.slot)}>
              {c.label}
              {config[c.slot] && <i aria-label="착용 중" />}
            </button>
          ))}
        </div>

        <div className="char-grid" role="group" aria-label={`${current.label} 고르기`}>
          {current.items.map((it) => (
            <button key={it.id} type="button" className={`item-tile${config[slot] === it.id ? ' on' : ''}`} aria-pressed={config[slot] === it.id} aria-label={it.label} onClick={() => pick(it.id)}>
              <ItemThumb slot={slot} id={it.id} />
              <span>{it.label}</span>
            </button>
          ))}
        </div>
        <p className="tiny">누르면 바로 입혀지고 자동으로 저장돼요. 다시 누르면 벗어요.</p>
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
        <h2>칭호 도감 ({data.titles.length})</h2>
        <p className="tiny">눌러 보면 그 칭호의 캐릭터를 미리 볼 수 있어요.</p>
        <ul className="char-dex">
          {data.titles.map((t) => (
            <li key={t.key} className={title?.key === t.key ? 'mine' : undefined}>
              <button
                type="button"
                className="dex-btn"
                aria-label={`${t.name} 모습 미리보기`}
                onClick={() => {
                  setPreview(t.key)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
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
