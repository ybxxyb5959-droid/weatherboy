import { Stat, Card, Bars, DayBars } from './common'
import { pct, padDays } from './format'
import type { Insights } from './types'

/** 인사이트: 베타 동안 "쓰고 있나, 돌아오나, 추천이 맞나"를 보는 지표 */
export default function InsightsTab({ data }: { data: Insights }) {
  const { retention, feedback, titles } = data
  const fbTotal = feedback.cold + feedback.ok + feedback.hot
  const follow = feedback.followed + feedback.notFollowed
  const rareTotal = titles.rare.reduce((a, r) => a + r.count, 0)
  return (
    <>
      <div className="adm-stats">
        <Stat label="재방문율 D1 (근사)" value={retention.d1.rate == null ? '-' : `${retention.d1.rate}%`} sub={`가입 1일 지난 ${retention.d1.eligible}명 중 ${retention.d1.returned}명`} />
        <Stat label="재방문율 D7 (근사)" value={retention.d7.rate == null ? '-' : `${retention.d7.rate}%`} sub={`가입 7일 지난 ${retention.d7.eligible}명 중 ${retention.d7.returned}명`} />
        <Stat label={`체감 후기 (${feedback.windowDays}일)`} value={fbTotal} sub={fbTotal ? `딱 좋아요 ${pct(feedback.ok, fbTotal)}` : '아직 없어요'} />
        <Stat label="추천대로 입은 비율" value={follow ? pct(feedback.followed, follow) : '-'} sub={follow ? `${feedback.followed} / ${follow}건` : '아직 없어요'} />
      </div>
      <p className="tiny adm-note">재방문율은 접속 기록이 "마지막 접속 시각" 하나뿐이라 근사값이에요. 가입한 지 N일이 지난 사용자 중, 마지막 접속이 가입 N일 뒤 이후인 사람의 비율이에요. 정확한 D1·D7이 필요하면 접속 기록을 따로 쌓아야 해요.</p>

      <div className="adm-grid">
        <Card title="하루 추천 조회 사용자 (14일)" className="span-6">
          <DayBars rows={padDays(data.daily14.map((d) => ({ d: d.d, v: d.users })), 14)} label="하루 추천 조회 사용자" />
        </Card>
        <Card title="접속일수 분포" className="span-6">
          <Bars rows={data.activeDays.map((b) => ({ label: b.label, value: b.count }))} total={data.activeDays.reduce((a, b) => a + b.count, 0)} />
          <p className="tiny adm-note">KST 기준 서로 다른 날 몇 번 들어왔는지예요. 1일이 대부분이면 다시 오게 만드는 장치(알림)가 필요해요.</p>
        </Card>

        <Card title="체감 후기 (추웠어요 / 딱 좋아요 / 더웠어요)" className="span-6">
          {fbTotal === 0 ? (
            <p className="tiny">아직 체감 후기가 없어요.</p>
          ) : (
            <Bars
              rows={[
                { label: '추웠어요', value: feedback.cold },
                { label: '딱 좋아요', value: feedback.ok },
                { label: '더웠어요', value: feedback.hot },
              ]}
              total={fbTotal}
            />
          )}
          <p className="tiny adm-note">"딱 좋아요" 비율이 추천 정확도의 가장 직접적인 신호예요. 추웠어요가 많으면 겨울 기준을, 더웠어요가 많으면 여름 기준을 올려 보세요.</p>
        </Card>
        <Card title="일정 종류" className="span-6">
          <p className="tiny">전체 일정 {data.events.total}개</p>
          {data.events.kinds.length === 0 ? <p className="tiny">아직 일정이 없어요.</p> : <Bars rows={data.events.kinds.map((k) => ({ label: k.label, value: k.count }))} total={data.events.total} />}
        </Card>

        <Card title="등록된 옷: 종류 TOP" className="span-4">
          <Bars rows={data.clothes.types.map((t) => ({ label: t.label, value: t.count }))} />
        </Card>
        <Card title="등록된 옷: 색상 TOP" className="span-4">
          <Bars rows={data.clothes.colors.map((t) => ({ label: t.label, value: t.count }))} />
        </Card>
        <Card title="등록된 옷: 무늬" className="span-4">
          <Bars rows={data.clothes.patterns.map((t) => ({ label: t.label, value: t.count }))} />
        </Card>

        <Card title={`칭호 분포 (옷 10벌 이상 ${titles.analyzed}명)`} className="span-12">
          {titles.analyzed === 0 ? (
            <p className="tiny">아직 칭호를 분석할 사용자가 없어요.</p>
          ) : (
            <div className="adm-two">
              <div>
                <p className="tiny">희귀 칭호 {rareTotal}명 · 취향 칭호 {titles.taste.total}명 · 칭호 없음 {titles.none}명</p>
                <Bars rows={titles.rare.filter((r) => r.count > 0).map((r) => ({ label: r.name, value: r.count }))} total={titles.analyzed} />
                {rareTotal === 0 && <p className="tiny">희귀 칭호를 받은 사용자가 아직 없어요.</p>}
              </div>
              <div>
                <p className="tiny">취향 칭호 종류</p>
                <Bars
                  rows={[
                    { label: '○○ 편애 중 (색)', value: titles.taste.color },
                    { label: '○○ 단골 (종류)', value: titles.taste.type },
                    { label: '○○ 포인트 (무늬)', value: titles.taste.pattern },
                  ]}
                  total={titles.taste.total || undefined}
                />
                <p className="tiny adm-note">희귀 칭호가 너무 적게 나오면 조건을 더 낮추고, 너무 많으면 올려서 조정해 보세요.</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
