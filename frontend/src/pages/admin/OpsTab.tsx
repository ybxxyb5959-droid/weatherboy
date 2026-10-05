import { Stat, Card, Bars, Dot } from './common'
import { fmtDate, ago, pct, uptime, KIND_NAME } from './format'
import type { Health } from './types'

/** 시스템: 환경설정이 맞는지, 예약 작업이 도는지, 알림이 잘 나가는지 */
export default function OpsTab({ data }: { data: Health }) {
  const bad = data.checks.filter((c) => !c.ok && !c.optional)
  const p = data.push
  const optTotal = p.usersWithPush
  const OPT: [string, number][] = [
    ['아침 옷차림', p.optOut.morning],
    ['비·우산', p.optOut.rain],
    ['귀가 추위', p.optOut.coldReturn],
    ['미세먼지', p.optOut.dust],
    ['후기 요청', p.optOut.feedback],
    ['옷장 리마인드', p.optOut.closet],
  ]
  return (
    <>
      <div className="adm-stats">
        <Stat label="시스템 점검" value={bad.length ? `${bad.length}건 확인` : '정상'} sub={bad.length ? bad.map((b) => b.label).join(', ') : '필수 설정 이상 없음'} tone={bad.length ? 'warn' : 'good'} />
        <Stat label="알림 구독" value={p.subscriptions} sub={`${p.usersWithPush}명 / 전체 ${p.users}명 (${pct(p.usersWithPush, p.users)})`} />
        <Stat label="서버 가동" value={uptime(data.server.uptimeSec)} sub={`${data.server.node} · 메모리 ${data.server.rssMb}MB`} />
        <Stat label="DB 응답" value={`${data.server.dbMs}ms`} sub="점검 때 한 번 잰 값" />
      </div>

      <div className="adm-grid">
        <Card title="설정 점검" className="span-6">
          <ul className="adm-checks">
            {data.checks.map((c) => (
              <li key={c.key} className={c.ok || c.optional ? '' : 'bad'}>
                <Dot ok={c.ok} optional={c.optional} />
                <span>
                  <b>{c.label}</b>
                  <small>{c.note}</small>
                </span>
              </li>
            ))}
          </ul>
          <p className="tiny adm-note">키나 비밀번호 값은 보여주지 않고, 설정돼 있는지만 알려줘요.</p>
        </Card>

        <Card title="예약 작업 (날씨·대기질·일정 예보 수집)" className="span-6">
          {data.jobs.length === 0 ? (
            <p className="tiny">수집 기록이 아직 없어요. 서버가 쉬고 있었거나 작업이 아직 한 번도 안 돈 거예요.</p>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>작업</th>
                    <th>마지막 성공</th>
                    <th>마지막 실패</th>
                    <th className="num">24시간 성공</th>
                    <th className="num">실패</th>
                  </tr>
                </thead>
                <tbody>
                  {data.jobs.map((j) => (
                    <tr key={j.job}>
                      <td>{j.job}</td>
                      <td>{ago(j.lastOkAt)}</td>
                      <td>{j.lastFailAt ? ago(j.lastFailAt) : '-'}</td>
                      <td className="num">{j.ok24}</td>
                      <td className={`num${j.fail24 ? ' warn' : ''}`}>{j.fail24}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="알림 발송 (최근 7일)" className="span-6">
          {p.kinds.length === 0 ? (
            <p className="tiny">최근 7일 동안 발송 기록이 없어요.</p>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>종류</th>
                    <th className="num">보냄</th>
                    <th className="num">실패</th>
                    <th className="num">건너뜀</th>
                  </tr>
                </thead>
                <tbody>
                  {p.kinds.map((k) => (
                    <tr key={k.kind}>
                      <td>{KIND_NAME[k.kind] ?? k.kind}</td>
                      <td className="num">{k.sent}</td>
                      <td className={`num${k.failed ? ' warn' : ''}`}>{k.failed}</td>
                      <td className="num">{k.skipped}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="tiny adm-note">건너뜀은 방해금지 시간, 구독 없음, 하루 상한 같은 이유로 일부러 안 보낸 경우예요.</p>
        </Card>

        <Card title="알림 종류별로 끈 사용자 (알림 켠 사람 중)" className="span-6">
          {optTotal === 0 ? <p className="tiny">알림을 켠 사용자가 아직 없어요.</p> : <Bars rows={OPT.map(([label, value]) => ({ label, value }))} total={optTotal} />}
          <p className="tiny adm-note">끈 비율이 높은 종류는 너무 자주 오거나 필요 없다는 신호예요.</p>
        </Card>

        <Card title="최근 알림 발송 실패" className="span-6">
          {p.failures.length === 0 ? (
            <p className="adm-ok">
              <Dot ok /> 실패한 발송이 없어요.
            </p>
          ) : (
            <ul className="adm-log">
              {p.failures.map((f, i) => (
                <li key={i}>
                  <span className="tiny">{fmtDate(f.createdAt)}</span> <b>{KIND_NAME[f.kind] ?? f.kind}</b> <code>{f.message ?? '-'}</code>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="최근 수집 오류" className="span-6">
          {data.collectErrors.length === 0 ? (
            <p className="adm-ok">
              <Dot ok /> 최근 오류가 없어요.
            </p>
          ) : (
            <ul className="adm-log">
              {data.collectErrors.map((e, i) => (
                <li key={i}>
                  <span className="tiny">{fmtDate(e.createdAt)}</span> <b>{e.job}</b> <span className={`adm-tag${e.status === 'FAILED' ? ' bad' : ''}`}>{e.status === 'FAILED' ? '실패' : '일부 실패'}</span> <code>{e.message ?? '-'}</code>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
