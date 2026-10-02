import { useState } from 'react'
import DoodleButton from './DoodleButton'
import HandText from './HandText'
import { api, errorMessage } from '../api'

export interface CalendarConn {
  id: string
  provider: 'GOOGLE' | 'APPLE' | 'SAMSUNG' | 'OTHER'
  lastSyncedAt: string | null
  lastError: string | null
  eventCount?: number
}

type Provider = 'GOOGLE' | 'APPLE' | 'SAMSUNG'

const providerName: Record<CalendarConn['provider'], string> = {
  GOOGLE: '구글 캘린더',
  APPLE: '애플 캘린더',
  SAMSUNG: '삼성 캘린더',
  OTHER: '캘린더',
}

const guides: Record<Provider, { title: string; steps: string[]; note?: string }> = {
  GOOGLE: {
    title: '구글 캘린더',
    steps: [
      '컴퓨터에서 구글 캘린더(calendar.google.com)를 열어요',
      '왼쪽 내 캘린더 옆 ⋮ → 설정 및 공유',
      '맨 아래 "iCal 형식의 비공개 주소"를 복사해요',
    ],
    note: '이 주소는 비밀번호와 같아요. 남에게 알려주지 마세요.',
  },
  APPLE: {
    title: '애플 캘린더',
    steps: [
      '캘린더 앱에서 연동할 캘린더 옆 (i)를 눌러요',
      '"공개 캘린더"를 켜요',
      '"링크 공유"로 나온 주소(webcal://…)를 복사해요',
    ],
    note: '공개 캘린더는 링크를 아는 사람이 일정을 볼 수 있어요. 연동 뒤 끄면 연결이 끊겨요.',
  },
  SAMSUNG: {
    title: '삼성 캘린더',
    steps: [
      '삼성 캘린더 앱은 주소를 직접 내주지 않아요. 구글 계정과 동기화해 두면 구글 캘린더에 같이 보여요',
      '컴퓨터에서 구글 캘린더 → 내 캘린더 옆 ⋮ → 설정 및 공유',
      '"iCal 형식의 비공개 주소"를 복사해요',
    ],
    note: '삼성 캘린더 → 설정 → 계정에서 구글 동기화가 켜져 있어야 해요.',
  },
}

interface Props {
  onClose: () => void
  onConnected: () => void
}

/** 캘린더 연동: 1) 가져오는 정보에 동의 -> 2) 어떤 캘린더인지 고르고 주소 붙여넣기 */
export default function CalendarConnectDialog({ onClose, onConnected }: Props) {
  const [step, setStep] = useState<'consent' | 'pick'>('consent')
  const [provider, setProvider] = useState<Provider>('GOOGLE')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const connect = async () => {
    setBusy(true)
    setError('')
    try {
      await api('POST', '/api/calendar', { provider, url, consent: true })
      onConnected()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const g = guides[provider]
  return (
    <div className="modal-back" role="presentation" onClick={onClose}>
      <div className="modal box w1" role="dialog" aria-modal="true" aria-label="캘린더 연동" onClick={(e) => e.stopPropagation()}>
        {step === 'consent' ? (
          <>
            <h2>캘린더를 연동할까요?</h2>
            <p>일정에 맞춰 날씨와 옷차림을 미리 알려드리려고 해요.</p>
            <ul className="consent-list">
              <li>
                <b>가져오는 것</b> 일정 제목 · 시간 · 장소 (읽기만 해요)
              </li>
              <li>
                <b>기간</b> 어제부터 90일 뒤까지
              </li>
              <li>
                <b>원본은 그대로</b> 여기서 바꿔도 내 캘린더는 바뀌지 않아요
              </li>
              <li>
                <b>언제든 해제</b> 해제하면 가져온 일정은 함께 지워져요
              </li>
            </ul>
            <div className="row stretch" style={{ marginTop: 14 }}>
              <DoodleButton seed={0} onClick={onClose}>
                취소
              </DoodleButton>
              <DoodleButton seed={2} className="sketchy" onClick={() => setStep('pick')}>
                허용하고 계속
              </DoodleButton>
            </div>
          </>
        ) : (
          <>
            <h2>어떤 캘린더인가요?</h2>
            <div className="row stretch">
              {(['GOOGLE', 'APPLE', 'SAMSUNG'] as const).map((p, i) => (
                <DoodleButton key={p} seed={i + 1} selected={provider === p} onClick={() => { setProvider(p); setError('') }}>
                  {p === 'GOOGLE' ? '구글' : p === 'APPLE' ? '애플' : '삼성'}
                </DoodleButton>
              ))}
            </div>
            <ol className="guide">
              {g.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {g.note && <p className="tiny">{g.note}</p>}
            <input
              className="cal-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="복사한 캘린더 주소를 붙여넣어요"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-label="캘린더 주소"
            />
            {error && <p role="alert" className="tiny">{error}</p>}
            <div className="row stretch" style={{ marginTop: 12 }}>
              <DoodleButton seed={0} onClick={() => setStep('consent')} disabled={busy}>
                이전
              </DoodleButton>
              <DoodleButton seed={2} className="sketchy" onClick={() => void connect()} disabled={busy || url.trim().length < 8}>
                {busy ? '가져오는 중…' : '연동하기'}
              </DoodleButton>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** 연동된 캘린더 한 줄: 마지막 동기화 시각, 지금 동기화, 해제 */
export function ConnectionRow({ c, onSync, onRemove }: { c: CalendarConn; onSync: () => void; onRemove: () => void }) {
  const when = c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '아직 안 가져왔어요'
  return (
    <li className="conn-row">
      <div>
        <strong>
          <HandText>{providerName[c.provider]}</HandText>
        </strong>
        <div className="tiny">
          {c.eventCount ?? 0}개 · {when}
          {c.lastError ? ` · 문제: ${c.lastError}` : ''}
        </div>
      </div>
      <span className="row">
        <button type="button" className="mini" onClick={onSync}>
          새로고침
        </button>
        <button type="button" className="mini" onClick={onRemove}>
          해제
        </button>
      </span>
    </li>
  )
}
