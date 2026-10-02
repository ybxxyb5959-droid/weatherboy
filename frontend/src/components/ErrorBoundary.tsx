import { Component, type ReactNode } from 'react'

/** 화면을 그리다 오류가 나도 하얀 화면으로 멈추지 않고, 다시 시도할 수 있게 한다. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('render error', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="app-error" role="alert">
        <p>앗, 화면에 문제가 생겼어요.</p>
        <button type="button" className="dbtn w1" onClick={() => window.location.assign('/')}>
          처음으로 돌아가기
        </button>
      </main>
    )
  }
}
