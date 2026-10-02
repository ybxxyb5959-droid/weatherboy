import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import HandText from './HandText'

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
  settings: <path d="M5 8 H23 M5 14 H23 M5 20 H23 M10 5 V11 M17 11 V17 M12 17 V23" />,
}

const tabs = [
  { to: '/home', label: '홈', icon: 'home' },
  { to: '/wardrobe', label: '옷장', icon: 'wardrobe' },
  { to: '/events', label: '일정', icon: 'events' },
  { to: '/settings', label: '설정', icon: 'settings' },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="메뉴">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => `navitem ${isActive ? 'active' : ''}`}>
          <svg className="doodle" width="28" height="28" viewBox="0 0 28 28" {...stroke} aria-hidden="true">
            {icons[t.icon]}
          </svg>
          <span><HandText>{t.label}</HandText></span>
        </NavLink>
      ))}
    </nav>
  )
}
