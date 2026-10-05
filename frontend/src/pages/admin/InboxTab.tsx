import { useState } from 'react'
import DoodleCheck from '../../components/DoodleCheck'
import { Card } from './common'
import { KIND_LABEL, stars, fmtDate } from './format'
import type { ReviewRow, SupportRow } from './types'

interface Props {
  reviews: ReviewRow[]
  support: SupportRow[]
  markRead: (id: string) => void
  markSupportRead: (id: string) => void
}

/** 후기·의견: PC 에서는 나란히 보고, 안 읽은 것만 걸러서 읽음 처리할 수 있다 */
export default function InboxTab({ reviews, support, markRead, markSupportRead }: Props) {
  const [onlyUnread, setOnlyUnread] = useState(false)
  const rv = onlyUnread ? reviews.filter((r) => !r.read) : reviews
  const sp = onlyUnread ? support.filter((r) => !r.read) : support
  return (
    <>
      <div className="adm-toolbar">
        <DoodleCheck checked={onlyUnread} onChange={setOnlyUnread}>
          안 읽은 것만
        </DoodleCheck>
        <span className="tiny">
          후기 {reviews.filter((r) => !r.read).length}건 · 의견 {support.filter((r) => !r.read).length}건 안 읽음
        </span>
      </div>
      <div className="adm-grid">
        <Card title={`후기 (${rv.length})`} className="span-6">
          {rv.length === 0 && <p className="tiny">{reviews.length === 0 ? '아직 후기가 없어요.' : '안 읽은 후기가 없어요.'}</p>}
          <ul className="admin-reviews">
            {rv.map((r) => (
              <li key={r.id} className={`box w${(r.rating % 3) + 1}${r.read ? ' read' : ''}`}>
                <div className="row between">
                  <b className="admin-stars">{stars(r.rating)}</b>
                  <span className="tiny">{fmtDate(r.createdAt)}</span>
                </div>
                <p className="admin-msg">{r.message || '(별점만 남겼어요)'}</p>
                <div className="row between">
                  <span className="tiny">
                    사용자 {r.code} · {r.provider === 'KAKAO' ? '카카오' : '게스트'} · 접속 {r.activeDays}일
                  </span>
                  {!r.read && (
                    <button type="button" className="dbtn small" onClick={() => markRead(r.id)}>
                      읽음
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={`의견·제보 (${sp.length})`} className="span-6">
          {sp.length === 0 && <p className="tiny">{support.length === 0 ? '아직 의견이 없어요.' : '안 읽은 의견이 없어요.'}</p>}
          <ul className="admin-reviews">
            {sp.map((r) => (
              <li key={r.id} className={`box w${(r.message.length % 3) + 1}${r.read ? ' read' : ''}`}>
                <div className="row between">
                  <span className="admin-kind">{KIND_LABEL[r.kind]}</span>
                  <span className="tiny">{fmtDate(r.createdAt)}</span>
                </div>
                <p className="admin-msg">{r.message}</p>
                <div className="row between">
                  <span className="tiny">
                    사용자 {r.code} · {r.provider === 'KAKAO' ? '카카오' : '게스트'}
                  </span>
                  {!r.read && (
                    <button type="button" className="dbtn small" onClick={() => markSupportRead(r.id)}>
                      읽음
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
