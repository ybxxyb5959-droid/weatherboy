import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DoodleButton, { ChoiceRow } from '../components/DoodleButton'
import HandText from '../components/HandText'
import LocationPicker from '../components/LocationPicker'
import KakaoLoginButton from '../components/KakaoLoginButton'
import RoutineEditor from '../components/RoutineEditor'
import PushToggle from '../components/PushToggle'
import { api, errorMessage } from '../api'
import { useAuth } from '../auth'
import { useAsync } from '../hooks'
import { faqs, OPERATOR, privacySections, termsSections } from './legalText'
import type { LegalSection } from './legalText'
import { defaultRoutine } from '../store'
import type { Routine, Sensitivity, Settings } from '../store'

const sensOptions: Sensitivity[] = ['추위 많이 탐', '보통', '더위 많이 탐']
const APP_VERSION = '0.1.0'

function routineLabel(r?: Routine) {
  if (!r || (!r.outAt && !r.homeAt)) return '정하지 않음'
  return [r.outAt && `외출 ${r.outAt}`, r.homeAt && `귀가 ${r.homeAt}`].filter(Boolean).join(' · ')
}

export function OnOff({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="row">
      <DoodleButton seed={0} selected={value} onClick={() => onChange(true)}>
        켜기
      </DoodleButton>
      <DoodleButton seed={1} selected={!value} onClick={() => onChange(false)}>
        끄기
      </DoodleButton>
    </div>
  )
}

type ServerSettings = Settings & { locationResolved: boolean }

function Chevron() {
  return (
    <svg className="doodle" width="14" height="18" viewBox="0 0 14 18" fill="none" stroke="#555" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 2.5 L10.5 9 L3.2 15.5" />
    </svg>
  )
}

/** 메뉴 한 줄: 왼쪽 이름, 오른쪽 현재 값과 화살표 */
function Row({ label, value, onClick, danger }: { label: string; value?: string; onClick?: () => void; danger?: boolean }) {
  const inner = (
    <>
      <span className={`set-label ${danger ? 'danger' : ''}`}>
        <HandText>{label}</HandText>
      </span>
      {value !== undefined && <span className="set-value">{value}</span>}
      {onClick && <Chevron />}
    </>
  )
  return onClick ? (
    <button type="button" className="set-row" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="set-row static">{inner}</div>
  )
}

function Group({ seed, children }: { seed: number; children: ReactNode }) {
  return <section className={`box w${seed % 4} set-group`}>{children}</section>
}

function Legal({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="legal">
      <p className="tiny">초안 · 운영자: {OPERATOR.name}</p>
      {sections.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          {s.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
    </div>
  )
}

const TITLES: Record<string, string> = {
  location: '내 위치 설정',
  routine: '하루 패턴',
  sensitivity: '개인 체감',
  notify: '알림 설정',
  account: '계정',
  faq: '자주 묻는 질문',
  terms: '이용약관',
  privacy: '개인정보처리방침',
  about: '앱 정보',
}

export default function SettingsPage() {
  const { section } = useParams()
  const nav = useNavigate()
  const { me, logout, deleteAccount } = useAuth()
  const { data: s, error: loadError, loading, setData } = useAsync(() => api<ServerSettings>('GET', '/api/settings'))
  const [message, setMessage] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [routineDraft, setRoutineDraft] = useState<Routine | null>(null) // 하루 패턴 편집 중인 값 (저장 누를 때 반영)

  const patch = async (p: Partial<Settings>, okMessage = '') => {
    setMessage('')
    try {
      setData(await api<ServerSettings>('PUT', '/api/settings', p))
      if (okMessage) setMessage(okMessage)
      return true
    } catch (e) {
      setMessage(errorMessage(e))
      return false
    }
  }

  const doLogout = async () => {
    setBusy(true)
    try {
      await logout()
      nav('/', { replace: true })
    } catch (e) {
      setMessage(errorMessage(e))
      setBusy(false)
    }
  }

  const doDelete = async () => {
    setBusy(true)
    try {
      await deleteAccount()
      nav('/', { replace: true })
    } catch (e) {
      setMessage(errorMessage(e))
      setBusy(false)
    }
  }

  if (loading) return <main><p>불러오는 중…</p></main>
  if (!s || !me) return <main><p role="alert">{loadError ?? '설정을 불러오지 못했어요.'}</p></main>

  const isGuest = me.provider !== 'KAKAO'
  const customerNo = me.id.slice(0, 8).toUpperCase()
  const providerLabel = isGuest ? '아직 회원이 아니에요' : `카카오 · ${me.nickname ?? ''}`
  const notifyLabel = s.notifyEvent && s.notifyChange ? '켜짐' : !s.notifyEvent && !s.notifyChange ? '꺼짐' : '일부 켜짐'
  const go = (to: string) => () => {
    setMessage('')
    setConfirmDelete(false)
    nav(`/settings/${to}`)
  }

  // ───── 하위 화면 ─────
  if (section && TITLES[section]) {
    const back = (
      <div className="page-head">
        <div className="row">
          <DoodleButton seed={1} className="small" aria-label="설정으로 돌아가기" onClick={() => nav('/settings')}>
            ‹
          </DoodleButton>
          <h1>{TITLES[section]}</h1>
        </div>
      </div>
    )
    return (
      <main>
        {back}
        {message && <p role="status" className="set-msg">{message}</p>}

        {section === 'location' && (
          <>
            <Group seed={1}>
              <Row label="지금 위치" value={s.location} />
            </Group>
            {!s.locationResolved && <p className="tiny">위치를 정확히 찾지 못했어요. 다른 이름으로 다시 입력해보세요.</p>}
            <div className="field">
              <div className="name">위치 바꾸기</div>
              <LocationPicker onPick={(p) => void patch({ location: p.name, ...(p.place ? { place: p.place } : {}) } as Partial<Settings>, `내 위치를 "${p.name}"(으)로 바꿨어요.`)} />
            </div>
          </>
        )}

        {section === 'routine' && (
          <>
            <RoutineEditor value={routineDraft ?? s.routine ?? defaultRoutine} onChange={setRoutineDraft} />
            <div className="field">
              <DoodleButton
                seed={1}
                className="block"
                onClick={() => {
                  if (!routineDraft) return
                  void patch({ routine: routineDraft }, '하루 패턴을 저장했어요.').then((ok) => ok && setRoutineDraft(null))
                }}
                disabled={!routineDraft}
              >
                저장
              </DoodleButton>
            </div>
          </>
        )}

        {section === 'sensitivity' && (
          <>
            <p>나는…</p>
            <ChoiceRow options={sensOptions} value={s.sensitivity} onChange={(v) => void patch({ sensitivity: v })} />
            <p className="tiny" style={{ marginTop: 12 }}>
              추위를 많이 타면 같은 날씨에도 한 겹 더 따뜻하게, 더위를 많이 타면 조금 가볍게 추천해요.
            </p>
          </>
        )}

        {section === 'notify' && (
          <>
            <div className="col">
              <div>
                <p style={{ marginBottom: 6 }}>일정 알림</p>
                <OnOff value={s.notifyEvent} onChange={(v) => void patch({ notifyEvent: v })} />
                <p className="tiny">일정 날씨가 열려서 옷차림이 만들어지면 알려줘요.</p>
              </div>
              <div>
                <p style={{ marginBottom: 6 }}>예보 변경 알림</p>
                <OnOff value={s.notifyChange} onChange={(v) => void patch({ notifyChange: v })} />
                <p className="tiny">예보가 바뀌어서 추천이 달라지면 알려줘요.</p>
              </div>
            </div>
            <PushToggle />
            <Group seed={2}>
              <Row label="방해금지 시간" value="밤 11시 ~ 아침 7시" />
            </Group>
            <p className="tiny">알림은 일정당 최대 3번까지, 방해금지 시간에는 보내지 않아요.</p>
          </>
        )}

        {section === 'account' && (
          <>
            <Group seed={1}>
              <Row label="가입계정" value={providerLabel} />
              <Row label="이용 중인 요금제" value={me.plan === 'PREMIUM' ? '프리미엄' : '무료'} />
              <Row label="고객번호" value={customerNo} />
            </Group>

            {isGuest && (
              <div className="field">
                <p>카카오 계정을 연결하면 지금까지 만든 옷장과 일정을 그대로 이어서 쓸 수 있어요.</p>
                <KakaoLoginButton onClick={() => { window.location.href = '/api/auth/kakao' }} />
              </div>
            )}

            <div className="field">
              <DoodleButton seed={3} className="block" onClick={() => void doLogout()}>
                {busy ? '잠시만요…' : '로그아웃'}
              </DoodleButton>
              {isGuest && <p className="tiny">게스트는 로그아웃하면 지금 데이터를 다시 찾을 수 없어요. 먼저 카카오를 연결해주세요.</p>}
            </div>

            <hr className="scribble" />

            {!confirmDelete ? (
              <button type="button" className="set-danger" onClick={() => setConfirmDelete(true)}>
                <HandText>회원 탈퇴</HandText>
              </button>
            ) : (
              <div className="box w2 set-confirm" role="alertdialog" aria-label="회원 탈퇴 확인">
                <h2>정말 탈퇴할까요?</h2>
                <p>옷장, 일정, 즐겨찾기, 후기 등 저장된 모든 데이터가 삭제되고 되돌릴 수 없어요.</p>
                <div className="row stretch" style={{ marginTop: 10 }}>
                  <DoodleButton seed={0} onClick={() => setConfirmDelete(false)}>
                    취소
                  </DoodleButton>
                  <DoodleButton seed={2} className="danger-btn" onClick={() => void doDelete()}>
                    {busy ? '삭제 중…' : '삭제하고 탈퇴'}
                  </DoodleButton>
                </div>
              </div>
            )}
          </>
        )}

        {section === 'faq' && (
          <div className="faq">
            {faqs.map((f, i) => (
              <details key={f.q} className={`box w${i % 4}`}>
                <summary>
                  <HandText>{f.q}</HandText>
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        )}

        {section === 'terms' && <Legal sections={termsSections} />}
        {section === 'privacy' && <Legal sections={privacySections} />}

        {section === 'about' && (
          <>
            <Group seed={1}>
              <Row label="버전" value={`v${APP_VERSION}`} />
            </Group>
            <div className="field">
              <div className="name">데이터 출처</div>
              <ul className="about-list">
                <li>날씨 예보: 기상청 (공공데이터포털)</li>
                <li>미세먼지: 한국환경공단 에어코리아 (공공데이터포털)</li>
                <li>지역 검색: 카카오 Local, 로그인: 카카오</li>
              </ul>
            </div>
            <p className="tiny">문의: {OPERATOR.contact}</p>
          </>
        )}
      </main>
    )
  }

  // ───── 설정 메인 (메뉴 목록) ─────
  return (
    <main>
      <div className="page-head">
        <h1>설정</h1>
      </div>

      <Group seed={1}>
        <Row label="내 위치 설정" value={s.location} onClick={go('location')} />
        <Row label="하루 패턴" value={routineLabel(s.routine)} onClick={go('routine')} />
        <Row label="개인 체감" value={s.sensitivity} onClick={go('sensitivity')} />
        <Row label="알림 설정" value={notifyLabel} onClick={go('notify')} />
      </Group>

      <Group seed={2}>
        <Row label="계정" value={providerLabel} onClick={go('account')} />
        <Row label="고객번호" value={customerNo} />
      </Group>

      <Group seed={3}>
        <Row label="자주 묻는 질문" onClick={go('faq')} />
      </Group>

      <Group seed={0}>
        <Row label="앱 정보" value={`v${APP_VERSION}`} onClick={go('about')} />
        <Row label="이용약관" onClick={go('terms')} />
        <Row label="개인정보처리방침" onClick={go('privacy')} />
      </Group>

      <Group seed={1}>
        <Row label={busy ? '잠시만요…' : '로그아웃'} onClick={() => void doLogout()} />
      </Group>
      {message && <p role="alert">{message}</p>}
    </main>
  )
}
