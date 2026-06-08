import { Link, useLocation } from 'react-router-dom'

const TABS = [
  { to: '/', icon: '🏠', label: '大厅' },
  { to: '/me', icon: '👤', label: '我的' },
] as const

export function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => {
        const active = pathname === t.to
        return (
          <Link
            key={t.to}
            to={t.to}
            className={`bottom-nav-item ${active ? 'is-active' : ''}`}
          >
            <div className="text-xl leading-none">{t.icon}</div>
            <div className="text-[10px] font-medium mt-1">{t.label}</div>
          </Link>
        )
      })}
    </nav>
  )
}
