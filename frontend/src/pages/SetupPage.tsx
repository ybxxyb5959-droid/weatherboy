import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StickPerson from '../components/StickPerson'
import RoutineEditor from '../components/RoutineEditor'
import DoodleButton, { ChoiceRow } from '../components/DoodleButton'
import LocationPicker from '../components/LocationPicker'
import type { PickedPlace } from '../components/LocationPicker'
import PushToggle from '../components/PushToggle'
import { OnOff } from './SettingsPage'
import { api, errorMessage } from '../api'
import { useAuth } from '../auth'
import { enablePush, pushSupported } from '../lib/push'
import { defaultRoutine, defaultSettings } from '../store'
import type { Routine, Sensitivity } from '../store'

const sensOptions: Sensitivity[] = ['추위 많이 탐', '보통', '더위 많이 탐']
const closetOptions = ['예시 옷으로 시작', '빈 옷장으로 시작'] as const

export default function SetupPage() {
  const nav = useNavigate()
  const { refresh } = useAuth()
  const [picked, setPicked] = useState<PickedPlace | null>(null)
  const [routine, setRoutine] = useState<Routine>(defaultRoutine)
  const [sens, setSens] = useState<Sensitivity>('보통')
  const [notifyEvent, setNotifyEvent] = useState(true)
  const [notifyChange, setNotifyChange] = useState(true)
  const [pushKey, setPushKey] = useState(0) // 알림 허용 결과를 PushToggle 에 다시 반영하기 위한 키
  const [closet, setCloset] = useState<(typeof closetOptions)[number]>('예시 옷으로 시작')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 알림을 "켜기"로 바꾸는 순간(사용자의 클릭) 아직 안 물어봤다면 알림 허용 팝업을 띄운다
  const askPushIfNeeded = async (on: boolean) => {
    if (!on || !pushSupported() || Notification.permission !== 'default') return
    await enablePush()
    setPushKey((k) => k + 1)
  }

  // skip: "나중에 할게" -> 서버가 기본 설정 + 예시 옷장으로 완료 처리
  const finish = async (skip: boolean) => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await api(
        'POST',
        '/api/onboarding/complete',
        skip
          ? { skip: true }
          : {
              sensitivity: sens,
              location: picked?.name ?? defaultSettings.location,
              ...(picked?.place ? { place: picked.place } : {}),
              notifyEvent,
              notifyChange,
              routine,
              closetMode: closet === '예시 옷으로 시작' ? 'sample' : 'empty',
            },
      )
      await refresh()
      nav('/home', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <StickPerson mood="wave" size={110} />
        <div className="box w1 setup-say">처음이라 몇 가지만 알려줘!</div>
      </div>

      <div className="field">
        <div className="name">어디서 입어?</div>
        <LocationPicker onPick={setPicked} />
        <p className="picker-now">
          {picked ? (
            <>
              📍 <b>{picked.name}</b>
              {picked.fromGps ? ' (현재 위치)' : ''}
            </>
          ) : (
            <span className="tiny">정하지 않으면 {defaultSettings.location}로 시작해요</span>
          )}
        </p>
      </div>

      <div className="field">
        <ChoiceRow options={sensOptions} value={sens} onChange={setSens} />
      </div>

      <div className="field">
        <div className="name">하루 패턴</div>
        <RoutineEditor value={routine} onChange={setRoutine} />
      </div>

      <div className="field">
        <div className="name">알림</div>
        <div className="col">
          <div>
            <p className="tiny" style={{ marginBottom: 4 }}>일정 알림</p>
            <OnOff
              value={notifyEvent}
              onChange={(v) => {
                setNotifyEvent(v)
                void askPushIfNeeded(v)
              }}
            />
          </div>
          <div>
            <p className="tiny" style={{ marginBottom: 4 }}>예보 변경 알림</p>
            <OnOff
              value={notifyChange}
              onChange={(v) => {
                setNotifyChange(v)
                void askPushIfNeeded(v)
              }}
            />
          </div>
          <PushToggle key={pushKey} />
        </div>
      </div>

      <div className="field">
        <div className="name">내 옷장</div>
        <ChoiceRow options={closetOptions} value={closet} onChange={setCloset} />
      </div>

      {error && (
        <p role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}

      <div className="field">
        <DoodleButton seed={1} className="block" onClick={() => void finish(false)}>
          {saving ? '저장 중…' : '시작하기'}
        </DoodleButton>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button type="button" className="guest-link" onClick={() => void finish(true)}>
            나중에 할게
          </button>
        </div>
      </div>
    </main>
  )
}
