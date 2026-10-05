import { Suspense, type ReactElement } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import IntroPage from './pages/IntroPage'
import LandingPage from './pages/LandingPage'
import { isStandalone } from './lib/install'
import GuestDataNotice from './components/GuestDataNotice'
import Splash from './components/Splash'
import LocationGate from './components/LocationGate'
import NotifyGate from './components/NotifyGate'
import { useAuth } from './auth'
import { lazyPage } from './lib/lazyPage'

// 처음 열 때 꼭 필요하지 않은 화면은 쓸 때 받아와서 첫 로딩을 가볍게 한다(소개·로그인 화면은 바로 받는다)
const TourPage = lazyPage(() => import('./pages/TourPage'))
const AdminPage = lazyPage(() => import('./pages/AdminPage'))
const ReviewPage = lazyPage(() => import('./pages/ReviewPage'))
const SupportPage = lazyPage(() => import('./pages/SupportPage'))
const LegalPage = lazyPage(() => import('./pages/LegalPage'))
const HomePage = lazyPage(() => import('./pages/HomePage'))
const WardrobePage = lazyPage(() => import('./pages/WardrobePage'))
const EditEventPage = lazyPage(() => import('./pages/EditEventPage'))
const ScanClosetPage = lazyPage(() => import('./pages/ScanClosetPage'))
const EditClothingPage = lazyPage(() => import('./pages/EditClothingPage'))
const AddClothingPage = lazyPage(() => import('./pages/AddClothingPage'))
const EventsPage = lazyPage(() => import('./pages/EventsPage'))
const NewEventPage = lazyPage(() => import('./pages/NewEventPage'))
const EventDetailPage = lazyPage(() => import('./pages/EventDetailPage'))
const WeatherPreviewPage = lazyPage(() => import('./pages/WeatherPreviewPage'))
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'))
const CharacterPage = lazyPage(() => import('./pages/CharacterPage'))

// 세션(HttpOnly 쿠키)으로 로그인 여부를 판단한다. 첫 설정 화면은 없고 바로 홈으로 간다.
function ConnectError() {
  const { refresh } = useAuth()
  return (
    <main className="app-error" role="alert">
      <p>서버에 연결하지 못했어요. 인터넷을 확인하고 다시 시도해주세요.</p>
      <button type="button" className="dbtn w1" onClick={() => void refresh()}>
        다시 시도
      </button>
    </main>
  )
}

// 로그인 화면(/start). 로그인돼 있으면 바로 홈으로 간다.
function Root() {
  const { me, loading, connectError } = useAuth()
  if (loading) return <Splash />
  if (!me && connectError) return <ConnectError />
  if (!me) return <IntroPage />
  return <Navigate to="/home" replace />
}

// 주소의 첫 화면(/): 브라우저로 들어오면 소개 페이지, 설치한 앱으로 열면 바로 로그인/홈
function Front() {
  return isStandalone() ? <Root /> : <LandingPage />
}

// 둘러보기(/tour)는 설치 전 웹에서 보는 미리보기다. 아이폰 등은 '홈 화면에 추가'할 때 보고 있던 주소로 앱을 열기 때문에,
// 미리보기 화면에서 설치하면 앱 첫 화면이 미리보기가 된다. 설치한 앱에서는 미리보기 대신 로그인/홈으로 보낸다.
function Tour() {
  return isStandalone() ? <Navigate to="/start" replace /> : <TourPage />
}

function Protected({ children }: { children: ReactElement }) {
  const { me, loading, connectError } = useAuth()
  if (loading) return <Splash />
  if (!me && connectError) return <ConnectError />
  if (!me) return <Navigate to="/start" replace />
  return children
}

export default function App() {
  const { pathname } = useLocation()
  const { me } = useAuth()
  // 로그인이 확인된 뒤에만 하단 탭을 보인다(로딩 중·연결 실패 화면에는 안 보인다)
  const showNav = !!me && pathname !== '/' && pathname !== '/start' && pathname !== '/tour' && pathname !== '/admin' && pathname !== '/terms' && pathname !== '/privacy' && pathname !== '/delete-account'
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
      <GuestDataNotice />
      {/* 화면이 바뀔 때 살짝 올라오며 나타난다(같은 영역 안의 이동, 예: 설정의 하위 화면은 다시 만들지 않는다) */}
      <div key={pathname.split('/')[1] ?? ''} className="page-in">
      <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/" element={<Front />} />
        <Route path="/start" element={<Root />} />
        <Route path="/tour" element={<Tour />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="/delete-account" element={<LegalPage kind="delete-account" />} />
        <Route path="/review" element={<Protected><ReviewPage /></Protected>} />
        <Route path="/support" element={<Protected><SupportPage /></Protected>} />
        <Route path="/weather" element={<WeatherPreviewPage />} />
        <Route path="/home" element={<Protected><LocationGate><NotifyGate><HomePage /></NotifyGate></LocationGate></Protected>} />
        <Route path="/wardrobe" element={<Protected><WardrobePage /></Protected>} />
        <Route path="/wardrobe/scan" element={<Protected><ScanClosetPage /></Protected>} />
        <Route path="/wardrobe/:id/edit" element={<Protected><EditClothingPage /></Protected>} />
        <Route path="/wardrobe/add" element={<Protected><AddClothingPage /></Protected>} />
        <Route path="/character" element={<Protected><CharacterPage /></Protected>} />
        <Route path="/events" element={<Protected><EventsPage /></Protected>} />
        <Route path="/events/new" element={<Protected><NewEventPage /></Protected>} />
        <Route path="/events/:id/edit" element={<Protected><EditEventPage /></Protected>} />
        <Route path="/events/:id" element={<Protected><EventDetailPage /></Protected>} />
        <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
        <Route path="/settings/:section" element={<Protected><SettingsPage /></Protected>} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      </Suspense>
      </div>
      {showNav && <BottomNav />}
    </div>
  )
}
