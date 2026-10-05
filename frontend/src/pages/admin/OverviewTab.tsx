import { Stat, Card, Bars, DayBars, LineChart, Dot } from './common'
import { KIND_LABEL, stars, fmtDate, pct, padDays } from './format'
import type { Dashboard, ReviewRow, SupportRow, Health, Insights } from './types'

interface Props {
  dash: Dashboard
  health: Health | null
  insights: Insights | null
  reviews: ReviewRow[]
  support: SupportRow[]
  go: (tab: 'ops' | 'inbox' | 'users' | 'insights') => void
}

/** 개요: 오늘 꼭 봐야 하는 숫자와 문제 신호를 한 화면에 */
export default function OverviewTab({ dash, health, insights, reviews, support, go }: Props) {
  const total = dash.users.total
  const f = (name: string) => dash.funnel.find((x) => x.step.startsWith(name))?.count ?? 0
  const closet10 = dash.funnel.find((x) => /10벌/.test(x.step))?.count ?? 0
  const today = insights?.daily14.at(-1)
  const problems = health?.checks.filter((c) => !c.ok && !c.optional) ?? []
  const d1 = insights?.retention.d1
  const unreadReviews = reviews.filter((r) => !r.read)
  const unreadSupport = support.filter((r) => !r.read)

  return (
    <>
      <div className="adm-stats">
        <Stat label="전체 가입자" value={total} sub={`카카오 ${dash.users.kakao} · 게스트 ${dash.users.guest}`} />
        <Stat label="최근 24시간 접속" value={dash.users.active24h} sub={`7일 ${dash.users.active7d}명 (${pct(dash.users.active7d, total)})`} />
        <Stat label="오늘 추천 본 사용자" value={today?.users ?? 0} sub={`추천 ${today?.recs ?? 0}건 생성`} />
        <Stat label="재방문율 D1 (근사)" value={d1?.rate == null ? '-' : `${d1.rate}%`} sub={d1 ? `가입 1일 지난 ${d1.eligible}명 중 ${d1.returned}명` : '불러오는 중'} />
        <Stat label={`옷 ${closet10 ? '10벌 이상' : ''} 등록`} value={closet10} sub={`전체의 ${pct(closet10, total)}`} />
        <Stat label="알림 켠 사용자" value={health?.push.usersWithPush ?? '-'} sub={health ? `전체의 ${pct(health.push.usersWithPush, health.push.users)}` : '불러오는 중'} />
        <Stat label="후기" value={dash.reviews.total} sub={dash.reviews.average ? `평균 ★${dash.reviews.average} · 안 읽음 ${dash.reviews.unread}` : '아직 없어요'} tone={dash.reviews.unread ? 'warn' : undefined} />
        <Stat label="의견·제보" value={dash.support.total} sub={dash.support.total ? `안 읽음 ${dash.support.unread}` : '아직 없어요'} tone={dash.support.unread ? 'warn' : undefined} />
        <Stat label="시스템 점검" value={health ? (problems.length ? `${problems.length}건 확인` : '정상') : '-'} sub={problems.length ? problems.map((p) => p.label).slice(0, 2).join(', ') : '설정·예약 작업 이상 없음'} tone={health ? (problems.length ? 'warn' : 'good') : undefined} />
      </div>

      <div className="adm-grid">
        <Card title="사용 단계 (어디서 떠나요?)" className="span-6">
          <Bars rows={dash.funnel.map((x) => ({ label: x.step, value: x.count }))} total={total} />
          <p className="tiny adm-note">
            위치 설정 {pct(f('내 지역'), total)} → 옷 1벌 {pct(f('옷 1벌'), total)} → 옷 10벌 {pct(closet10, total)} → 일정 {pct(f('일정'), total)}. 비율은 전체 가입자 기준이에요.
          </p>
        </Card>

        <Card title="최근 7일 신규 가입" className="span-6">
          <LineChart rows={dash.daily} days={7} label="최근 7일 신규 가입" />
        </Card>

        <Card title="하루 추천 조회 사용자 (14일)" className="span-6">
          {insights ? (
            <>
              <DayBars rows={padDays(insights.daily14.map((d) => ({ d: d.d, v: d.users })), 14)} label="하루 추천 조회 사용자" />
              <p className="tiny adm-note">그날 홈 추천을 만든 서로 다른 사용자 수예요. 앱을 연 사람 수의 근사값으로 보세요.</p>
            </>
          ) : (
            <p className="tiny">불러오는 중…</p>
          )}
        </Card>

        <Card title="확인이 필요한 것" className="span-6" right={<button type="button" className="dbtn small" onClick={() => go('ops')}>시스템 보기</button>}>
          {!health ? (
            <p className="tiny">불러오는 중…</p>
          ) : problems.length === 0 && unreadReviews.length === 0 && unreadSupport.length === 0 ? (
            <p className="adm-ok">
              <Dot ok /> 지금 확인할 게 없어요.
            </p>
          ) : (
            <ul className="adm-todo">
              {problems.map((p) => (
                <li key={p.key}>
                  <Dot ok={false} />
                  <span>
                    <b>{p.label}</b> · {p.note}
                  </span>
                </li>
              ))}
              {unreadReviews.length > 0 && (
                <li>
                  <Dot ok={false} />
                  <span>
                    안 읽은 후기 {unreadReviews.length}건 · <button type="button" className="linkbtn" onClick={() => go('inbox')}>보러 가기</button>
                  </span>
                </li>
              )}
              {unreadSupport.length > 0 && (
                <li>
                  <Dot ok={false} />
                  <span>
                    안 읽은 의견 {unreadSupport.length}건 · <button type="button" className="linkbtn" onClick={() => go('inbox')}>보러 가기</button>
                  </span>
                </li>
              )}
            </ul>
          )}
        </Card>

        <Card title="최근 후기" className="span-6" right={<button type="button" className="dbtn small" onClick={() => go('inbox')}>전체 보기</button>}>
          {reviews.length === 0 ? (
            <p className="tiny">아직 후기가 없어요.</p>
          ) : (
            <ul className="adm-mini">
              {reviews.slice(0, 4).map((r) => (
                <li key={r.id} className={r.read ? 'read' : ''}>
                  <div className="row between">
                    <b className="admin-stars">{stars(r.rating)}</b>
                    <span className="tiny">{fmtDate(r.createdAt)}</span>
                  </div>
                  <p>{r.message || '(별점만 남겼어요)'}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="최근 의견·제보" className="span-6" right={<button type="button" className="dbtn small" onClick={() => go('inbox')}>전체 보기</button>}>
          {support.length === 0 ? (
            <p className="tiny">아직 의견이 없어요.</p>
          ) : (
            <ul className="adm-mini">
              {support.slice(0, 4).map((r) => (
                <li key={r.id} className={r.read ? 'read' : ''}>
                  <div className="row between">
                    <span className="admin-kind">{KIND_LABEL[r.kind]}</span>
                    <span className="tiny">{fmtDate(r.createdAt)}</span>
                  </div>
                  <p>{r.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
