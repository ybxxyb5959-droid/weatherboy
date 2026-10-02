import { useCallback, useEffect, useRef, useState } from 'react'

/** 잠깐 떴다 사라지는 안내(토스트). show('문구') 를 부르면 2.2초 동안 하단 메뉴 위에 뜬다. */
export function useToast() {
  const [message, setMessage] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const show = useCallback((m: string) => {
    setMessage(m)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(''), 2200)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return { message, show }
}

export default function Toast({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  )
}
