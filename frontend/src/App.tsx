import type { ReactElement } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import IntroPage from './pages/IntroPage'
import HomePage from './pages/HomePage'
import WardrobePage from './pages/WardrobePage'
import EditEventPage from './pages/EditEventPage'
import ScanClosetPage from './pages/ScanClosetPage'
import AddClothingPage from './pages/AddClothingPage'
import EventsPage from './pages/EventsPage'
import NewEventPage from './pages/NewEventPage'
import EventDetailPage from './pages/EventDetailPage'
import WeatherPreviewPage from './pages/WeatherPreviewPage'
import SetupPage from './pages/SetupPage'
import SettingsPage from './pages/SettingsPage'
import { useAuth } from './auth'

// 세션(HttpOnly 쿠키)으로 로그인 여부를 판단한다. 첫 설정을 안 했으면 /setup 으로 보낸다.
function Root() {
  const { me, loading } = useAuth()
  if (loading) return null
  if (!me) return <IntroPage />
  return <Navigate to={me.onboardingDone ? '/home' : '/setup'} replace />
}

function Protected({ children, setup = false }: { children: ReactElement; setup?: boolean }) {
  const { me, loading } = useAuth()
  if (loading) return null
  if (!me) return <Navigate to="/" replace />
  if (!setup && !me.onboardingDone) return <Navigate to="/setup" replace />
  return children
}

export default function App() {
  const { pathname } = useLocation()
  const showNav = pathname !== '/' && pathname !== '/setup'
  return (
    <div className="app">
      {/* 손으로 그은 듯 선을 살짝 흔드는 필터 */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="wobble">
          <feTurbulence type="turbulence" baseFrequency="0.035" numOctaves="2" seed="3" result="t" />
          <feDisplacementMap in="SourceGraphic" in2="t" scale="4" />
        </filter>
        <filter id="wobble-soft">
          <feTurbulence type="turbulence" baseFrequency="0.03" numOctaves="2" seed="5" result="t" />
          <feDisplacementMap in="SourceGraphic" in2="t" scale="1.5" />
        </filter>
      </svg>
      <Routes>
        <Route path="/" element={<Root />} />
        <Route path="/weather" element={<WeatherPreviewPage />} />
        <Route path="/setup" element={<Protected setup><SetupPage /></Protected>} />
        <Route path="/home" element={<Protected><HomePage /></Protected>} />
        <Route path="/wardrobe" element={<Protected><WardrobePage /></Protected>} />
        <Route path="/wardrobe/scan" element={<Protected><ScanClosetPage /></Protected>} />
        <Route path="/wardrobe/add" element={<Protected><AddClothingPage /></Protected>} />
        <Route path="/events" element={<Protected><EventsPage /></Protected>} />
        <Route path="/events/new" element={<Protected><NewEventPage /></Protected>} />
        <Route path="/events/:id/edit" element={<Protected><EditEventPage /></Protected>} />
        <Route path="/events/:id" element={<Protected><EventDetailPage /></Protected>} />
        <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
        <Route path="/settings/:section" element={<Protected><SettingsPage /></Protected>} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      {showNav && <BottomNav />}
    </div>
  )
}
