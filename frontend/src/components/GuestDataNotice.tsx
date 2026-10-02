import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const hasFlag = (search: string) => new URLSearchParams(search).get('guestData') === 'left'

/**
 * 카카오로 로그인했는데 이미 쓰던 카카오 계정이 있어서 그 계정으로 들어온 경우(주소에 ?guestData=left),
 * 직접 만든 게스트 옷장·일정이 이어지지 않았다는 걸 한 번 알려준다. 알려준 뒤 주소에서 표시는 지운다.
 */
export default function GuestDataNotice() {
  const location = useLocation()
  const nav = useNavigate()
  const [open, setOpen] = useState(() => hasFlag(location.search))

  useEffect(() => {
    if (!hasFlag(location.search)) return
    const q = new URLSearchParams(location.search)
    q.delete('guestData')
    const rest = q.toString()
    nav(`${location.pathname}${rest ? `?${rest}` : ''}`, { replace: true })
  }, [location.search, location.pathname, nav])

  if (!open) return null
  return (
    <div className="box w2 guest-notice" role="status">
      <p>이미 카카오로 쓰던 계정이 있어서 그 계정으로 로그인했어요. 방금까지 게스트로 만든 옷장·일정은 이 계정에 합쳐지지 않아요.</p>
      <button type="button" className="dbtn w1 small" onClick={() => setOpen(false)}>
        알겠어요
      </button>
    </div>
  )
}
