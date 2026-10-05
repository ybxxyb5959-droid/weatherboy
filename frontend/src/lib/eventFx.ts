// 일정 카드의 "쪽지에 펜으로 쓰기 / 지우개로 지우고 다시 쓰기" 연출을 일정 탭에 넘겨주는 작은 보관함.
// 일정을 저장한 화면(등록·수정)과 일정 탭은 서로 다른 화면이라, 어떤 카드를 어떻게 보여줄지를 여기에 잠깐 적어 둔다.
export type EventFx = { kind: 'created' } | { kind: 'edited'; oldTitle: string; oldRange: string }

const pending = new Map<string, EventFx>()

export const markEventFx = (id: string, fx: EventFx) => {
  pending.set(id, fx)
}
/** 일정 탭이 열릴 때 읽는다(읽기만 하고 지우지는 않는다: 개발 모드에서 두 번 그려져도 안전하게). 지우기는 clearEventFx */
export const peekEventFx = (): Map<string, EventFx> => new Map(pending)
export const clearEventFx = () => pending.clear()
