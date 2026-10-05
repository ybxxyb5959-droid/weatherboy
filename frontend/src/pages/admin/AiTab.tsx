import { Stat, Card, Bars } from './common'
import { secs } from './format'
import type { AiUsage } from './types'

/** AI 사용 현황: 최근 7일 호출, 실패율, 응답 속도, 서버 전체 상한, 많이 쓴 사용자, 지금 한도 */
export default function AiTab({ ai }: { ai: AiUsage }) {
  const today = ai.days.at(-1)
  const week = ai.days.reduce((a, d) => a + d.total, 0)
  const failed = ai.days.reduce((a, d) => a + d.failed, 0)
  const pct = Math.min(100, Math.round((ai.global.used / ai.global.cap) * 100))
  return (
    <>
      <div className="adm-stats">
        <Stat label="오늘 호출" value={today?.total ?? 0} sub={`사진 ${today?.photo ?? 0} · 말 ${today?.text ?? 0} · 설명 ${today?.explain ?? 0} · 그 밖 ${today?.other ?? 0}`} />
        <Stat label="7일 호출" value={week} sub={ai.failureRate == null ? '아직 없어요' : `실패 ${failed}건 (${ai.failureRate}%)`} tone={ai.failureRate != null && ai.failureRate >= 10 ? 'warn' : undefined} />
        <Stat label="사진 평균 응답" value={secs(ai.avgMs.photo)} sub={`말 입력 ${secs(ai.avgMs.text)}`} />
        <Stat label="서버 전체 24시간" value={`${pct}%`} sub={`${ai.global.used} / ${ai.global.cap}${ai.global.open ? '' : ' · 지금 쉬는 중'}`} tone={!ai.global.open ? 'warn' : pct >= 80 ? 'warn' : undefined} />
      </div>

      <div className="adm-grid">
        <Card title="하루 호출 수 (최근 7일)" className="span-6">
          <Bars rows={ai.days.map((d) => ({ label: d.date.slice(5).replace('-', '/'), value: d.total }))} />
        </Card>
        <Card title="지금 한도 설정" className="span-6">
          <ul className="adm-limits">
            <li>
              <span>시간당(전체 종류)</span>
              <b>{ai.limits.hourly}회</b>
            </li>
            <li>
              <span>사진 하루</span>
              <b>
                {ai.limits.photoDaily}회 <small>(가입 {ai.limits.newUserHours}시간 동안 {ai.limits.photoNewUser}회)</small>
              </b>
            </li>
            <li>
              <span>말 입력 하루</span>
              <b>
                {ai.limits.textDaily}회 <small>(가입 직후 {ai.limits.textNewUser}회)</small>
              </b>
            </li>
            <li>
              <span>추천 설명 하루</span>
              <b>{ai.limits.explainDaily}회</b>
            </li>
            <li>
              <span>서버 전체 하루</span>
              <b>{ai.global.cap}회</b>
            </li>
          </ul>
          <p className="tiny adm-note">한도는 서버 환경변수로 바꿔요. 호출 기록을 보고 비용에 맞게 조정하세요.</p>
        </Card>

        <Card title="최근 24시간 많이 쓴 사용자" className="span-12">
          {ai.topUsers.length === 0 ? (
            <p className="tiny">아직 사용자별 기록이 없어요. (사용자 기록은 업데이트 이후 호출부터 쌓여요)</p>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>고객번호</th>
                    <th className="num">사진</th>
                    <th className="num">말</th>
                    <th className="num">설명</th>
                    <th className="num">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {ai.topUsers.map((u) => (
                    <tr key={u.code}>
                      <td>
                        <code>{u.code}</code>
                      </td>
                      <td className="num">{u.photo}</td>
                      <td className="num">{u.text}</td>
                      <td className="num">{u.explain}</td>
                      <td className="num">
                        <b>{u.total}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
