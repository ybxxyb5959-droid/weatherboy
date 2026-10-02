import { useCallback, useEffect, useRef, useState } from 'react'

// 브라우저 내장 음성 인식(Web Speech API). 크롬/엣지/안드로이드 크롬에서 되고, 사파리(iPhone)는 불안정해서 지원하지 않으면 마이크를 숨긴다.
// 인식은 브라우저(구글 등) 서버에서 이루어진다. 개인정보처리방침에 적혀 있다.
interface RecognitionResultItem {
  0: { transcript: string }
  isFinal: boolean
  length: number
}
interface RecognitionEvent {
  results: ArrayLike<RecognitionResultItem>
}
interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionCtor = new () => Recognition

const ctor = (): RecognitionCtor | null => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const ERRORS: Record<string, string> = {
  'not-allowed': '마이크 권한이 필요해요. 브라우저 설정에서 허용해주세요.',
  'service-not-allowed': '이 브라우저에서는 음성 입력을 쓸 수 없어요.',
  'no-speech': '말소리가 들리지 않았어요. 다시 눌러서 말해주세요.',
  'audio-capture': '마이크를 찾지 못했어요.',
  network: '음성 인식 서버에 연결하지 못했어요.',
}

/** text 는 말하는 동안 계속 갱신되는 인식 결과(중간 결과 포함), final 이 true 면 한 문장이 끝난 것이다. */
export function useSpeech(onText: (text: string, final: boolean) => void) {
  const [supported] = useState(() => typeof window !== 'undefined' && ctor() !== null)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const rec = useRef<Recognition | null>(null)
  const cb = useRef(onText)
  useEffect(() => {
    cb.current = onText
  })
  useEffect(() => () => rec.current?.abort(), [])

  const stop = useCallback(() => rec.current?.stop(), [])
  const start = useCallback(() => {
    const C = ctor()
    if (!C || rec.current) return
    setError('')
    const r = new C()
    r.lang = 'ko-KR'
    r.interimResults = true
    r.continuous = false
    r.maxAlternatives = 1
    r.onresult = (e) => {
      let text = ''
      let final = false
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i]![0].transcript
        if (e.results[i]!.isFinal) final = true
      }
      cb.current(text.trim(), final)
    }
    r.onerror = (e) => setError(ERRORS[e.error] ?? '음성 입력에 실패했어요. 다시 시도해주세요.')
    r.onend = () => {
      rec.current = null
      setListening(false)
    }
    rec.current = r
    try {
      r.start()
      setListening(true)
    } catch {
      rec.current = null
      setError('음성 입력을 시작하지 못했어요.')
    }
  }, [])

  return { supported, listening, error, start, stop }
}
