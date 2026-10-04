import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useCharacter } from '../lib/character'
import HandText from './HandText'
import { LockIcon } from './ToolIcons'

const stroke = {
  fill: 'none',
  stroke: '#222',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const icons: Record<string, ReactNode> = {
  home: <path d="M4 14 L14 5 L24 14 M7 12 V23 H21 V12 M12 23 V16 H16 V23" />,
  wardrobe: <path d="M5 6 H23 V24 H5Z M14 6 V24 M11 14 h.1 M17 14 h.1 M5 3 Q14 0 23 3" />,
  events: <path d="M5 7 H23 V24 H5Z M5 12 H23 M10 3 V8 M18 3 V8 M10 17 h2 M16 17 h2" />,
  // 둥근 얼굴에 점 눈과 작은 미소(내 캐릭터)
  character: <path d="M14 5 C20 5 24 9 24 14 C24 19.5 19.5 23.5 14 23.5 C8.5 23.5 4 19.5 4 14 C4 9 8 5 14 5Z M10 13 h.1 M18 13 h.1 M10.5 17.5 Q14 20.5 17.5 17.5" />,
  settings: <path d="M5 8 H23 M5 14 H23 M5 20 H23 M10 5 V11 M17 11 V17 M12 17 V23" />,
}

const tabs = [
  { to: '/home', label: '홈', icon: 'home' },
  { to: '/wardrobe', label: '옷장', icon: 'wardrobe' },
  { to: '/character', label: '캐릭터', icon: 'character' }, // 가운데 탭: 앱의 얼굴(칭호·꾸미기·공유)
  { to: '/events', label: '일정', icon: 'events' },
  { to: '/settings', label: '설정', icon: 'settings' },
]

export default function BottomNav() {
  const { data, reload } = useCharacter()
  const { pathname } = useLocation()
  const locked = !!data && !data.unlocked // 옷을 더 등록해야 열리는 캐릭터 탭에 자물쇠를 단다
  // 잠겨 있는 동안은 화면을 옮길 때마다 다시 확인해서, 옷을 채워 열리면 자물쇠가 바로 사라진다
  useEffect(() => {
    if (locked) reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
  return (
    <nav className="bottom-nav" aria-label="메뉴">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => `navitem ${isActive ? 'active' : ''}`}>
          <span className="navicon">
            <svg className="doodle" width="28" height="28" viewBox="0 0 28 28" {...stroke} aria-hidden="true">
              {icons[t.icon]}
            </svg>
            {t.icon === 'character' && locked && (
              <span className="nav-lock" role="img" aria-label="잠겨 있어요">
                <LockIcon size={15} />
              </span>
            )}
          </span>
          <span><HandText>{t.label}</HandText></span>
        </NavLink>
      ))}
    </nav>
  )
}
