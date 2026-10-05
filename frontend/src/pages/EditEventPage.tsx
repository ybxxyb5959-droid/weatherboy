import { Link, useParams } from 'react-router-dom'
import { Loading } from '../components/LoadingScene'
import HandText from '../components/HandText'
import StickPerson from '../components/StickPerson'
import { EventForm } from './NewEventPage'
import { api } from '../api'
import { useAsync } from '../hooks'
import type { PlanEvent } from '../mocks/events'

/** 일정 수정: 등록 화면과 같은 입력 칸에 지금 값을 채워서 보여준다 */
export default function EditEventPage() {
  const { id = '' } = useParams()
  const ev = useAsync(() => api<PlanEvent>('GET', `/api/events/${id}`), id)

  if (ev.loading) return <main><Loading kind="edit" label="일정 가져오는 중…" /></main>
  if (!ev.data) {
    return (
      <main className="empty">
        <StickPerson mood="empty" size={140} />
        <p>{ev.error && !ev.error.includes('찾을 수') ? ev.error : '그런 일정은 없어요'}</p>
        <Link to="/events" className="dbtn w1" style={{ marginTop: 12 }}>
          <HandText>일정으로</HandText>
        </Link>
      </main>
    )
  }
  return <EventForm key={ev.data.id} event={ev.data} />
}
