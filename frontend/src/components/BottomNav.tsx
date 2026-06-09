import type { ComponentType, SVGProps } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { IconHome, IconUser } from '../lib/icons'

type Tab = {
  to: string
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
  label: string
}

const TABS: Tab[] = [
  { to: '/', Icon: IconHome, label: '大厅' },
  { to: '/me', Icon: IconUser, label: '我的' },
]

export function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav className="bottom-nav">
      {TABS.map(({ to, Icon, label }) => {
        const active = pathname === to
        return (
          <Link
            key={to}
            to={to}
            className={`bottom-nav-item ${active ? 'is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={22} />
            <div className="text-[10px] font-medium mt-1">{label}</div>
          </Link>
        )
      })}
    </nav>
  )
}
