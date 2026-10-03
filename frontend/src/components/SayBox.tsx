import { useEffect, useRef } from 'react'
import DoodleButton from './DoodleButton'
import { useSpeech } from '../lib/speech'

interface Props {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  /** text 는 음성으로 막 끝난 문장까지 포함한 최신 글. 직접 누를 때는 비어 있다(value 를 쓰면 된다). */
  onSubmit: (text?: string) => void
  busy: boolean
  busyLabel: string
  submitLabel: string
  /** 말하기가 끝나면 '채워줘'를 따로 누르지 않아도 바로 실행 */
  submitOnVoice?: boolean
  note?: string
}

/** 마이크 그림 (우리 낙서 스타일) */
function MicIcon() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" className="mic-icon">
      <path d="M12 6 Q12 3 16 3 Q20 3 20 6 L20 15 Q20 19 16 19 Q12 19 12 15 Z" />
      <path d="M7 14 Q7 24 16 24 Q25 24 25 14" />
      <path d="M16 24 L16 29 M11 29 L21 29" />
    </svg>
  )
}

/** "말로 적기" 입력: 글자로 쓰거나 마이크로 말해서 넣는다. 말하는 동안 인식된 글이 입력창에 그대로 채워진다. */
export default function SayBox({ id, label, placeholder, value, onChange, onSubmit, busy, busyLabel, submitLabel, submitOnVoice, note }: Props) {
  const base = useRef('')
  // 이번 말하기에서 들은 글과, 그걸로 이미 실행했는지. 한 번 말한 걸로 두 번 실행되지 않게 한다.
  const heard = useRef('')
  const sent = useRef(false)

  const speech = useSpeech((text, final) => {
    const next = base.current + text
    onChange(next)
    if (text) heard.current = next
    if (final && submitOnVoice && text && !sent.current) {
      sent.current = true
      onSubmit(next)
    }
  })

  // 브라우저에 따라 '문장 끝(final)' 없이 듣기가 끝나기도 한다. 그때도 들은 글이 있으면 바로 실행한다.
  const wasListening = useRef(false)
  const submitRef = useRef(onSubmit)
  useEffect(() => {
    submitRef.current = onSubmit
  })
  useEffect(() => {
    if (wasListening.current && !speech.listening && submitOnVoice && !sent.current && heard.current.trim().length >= 2) {
      sent.current = true
      submitRef.current(heard.current)
    }
    wasListening.current = speech.listening
  }, [speech.listening, submitOnVoice])

  const toggleMic = () => {
    if (speech.listening) {
      speech.stop()
      return
    }
    base.current = value.trim() ? `${value.trim()} ` : ''
    heard.current = ''
    sent.current = false
    speech.start()
  }

  return (
    <div className="field say-box" style={{ marginTop: 0 }}>
      <label className="sr-only" htmlFor={id}>{label}</label>
      <div className="row">
        <input
          id={id}
          type="text"
          value={value}
          maxLength={200}
          placeholder={speech.listening ? '듣고 있어요… 말해주세요' : placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        />
        {speech.supported && (
          <button type="button" className={`dbtn w3 mic-btn${speech.listening ? ' on listening' : ''}`} aria-pressed={speech.listening} aria-label={speech.listening ? '음성 입력 끝내기' : '말로 입력하기'} onClick={toggleMic} disabled={busy}>
            <MicIcon />
          </button>
        )}
        <DoodleButton seed={2} className="small" onClick={() => onSubmit()} disabled={busy || value.trim().length < 2}>
          {busy ? busyLabel : submitLabel}
        </DoodleButton>
      </div>
      <p className="tiny say-status" role="status" aria-live="polite">
        {speech.error || (speech.listening ? (submitOnVoice ? '듣는 중이에요. 말을 마치면 바로 채워드려요.' : '듣는 중이에요. 다 말했으면 마이크를 한 번 더 눌러주세요.') : '')}
      </p>
      {note && <p className="tiny ai-note">{note}</p>}
      <hr className="scribble" />
    </div>
  )
}
