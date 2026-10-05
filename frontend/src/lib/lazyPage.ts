// oxlint-disable-next-line no-explicit-any
import { lazy, type ComponentType } from 'react'

const FLAG = 'wb-chunk-reload'

/**
 * 화면별로 나눠 받는 화면(React.lazy). 새 버전이 배포되면 열어 둔 탭이 지워진 옛 파일을 찾지 못해 실패할 수 있어서,
 * 그럴 때는 한 번만 새로고침해서 새 파일을 받는다(무한 새로고침은 막는다).
 */
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().then(
      (m) => {
        try {
          sessionStorage.removeItem(FLAG)
        } catch {
          /* 저장소를 못 써도 화면은 열린다 */
        }
        return m
      },
      (e) => {
        try {
          if (!sessionStorage.getItem(FLAG)) {
            sessionStorage.setItem(FLAG, '1')
            window.location.reload()
            return new Promise<never>(() => undefined)
          }
        } catch {
          /* 저장소를 못 쓰면 그대로 오류를 보여준다 */
        }
        throw e
      },
    ),
  )
}
