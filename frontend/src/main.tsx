import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/global.css'
import './styles/motion.css' // 움직임(날씨·화면 등장·옷장·캐릭터). 움직임 줄이기 설정이면 멈춘다
// 손글씨 폰트(Gaegu, Poor Story)는 구글 서버가 아니라 우리 쪽 파일로 내려준다(글자 모양은 같다). 화면을 막지 않게 따로 받는다.
void import('./styles/fonts.css')
import './lib/install.ts' // 설치 이벤트를 React 가 뜨기 전부터 붙잡는다
import App from './App.tsx'
import { AuthProvider } from './auth.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
