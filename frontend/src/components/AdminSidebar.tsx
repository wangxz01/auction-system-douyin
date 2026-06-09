import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clearAuth, getUser } from '../lib/auth'
import {
  IconCatalog,
  IconGavel,
  IconLogout,
  IconPlus,
  IconReceipt,
  IconUser,
} from '../lib/icons'
import type { ComponentType, SVGProps } from 'react'

type SidebarItem = {
  to: string
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
  label: string
  match: (p: string) => boolean
}

const ITEMS: SidebarItem[] = [
  {
    to: '/admin',
    Icon: IconCatalog,
    label: '竞拍管理',
    match: (p) => p === '/admin' || p.startsWith('/admin/auctions'),
  },
  {
    to: '/admin/create',
    Icon: IconPlus,
    label: '发布商品',
    match: (p) => p === '/admin/create',
  },
  {
    to: '/admin/orders',
    Icon: IconReceipt,
    label: '订单管理',
    match: (p) => p === '/admin/orders',
  },
]

export function AdminSidebar() {
  const { pathname } = useLocation()
  const nav = useNavigate()
  const me = getUser()

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand" title="拍卖系统">
        <IconGavel size={22} />
      </div>

      <nav className="flex flex-col gap-2 mt-2">
        {ITEMS.map(({ to, Icon, label, match }) => {
          const active = match(pathname)
          return (
            <Link
              key={to}
              to={to}
              className={`admin-sidebar-item ${active ? 'is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="icon">
                <Icon size={22} />
              </span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="admin-sidebar-spacer" />

      {me && (
        <div className="flex flex-col items-center gap-2">
          <div className="admin-sidebar-item" title={me.username}>
            <span className="icon">
              <IconUser size={22} />
            </span>
            <span className="truncate max-w-[64px]">{me.username}</span>
          </div>
          <button
            onClick={() => {
              clearAuth()
              nav('/login')
            }}
            className="admin-sidebar-item"
            aria-label="退出登录"
          >
            <span className="icon">
              <IconLogout size={22} />
            </span>
            <span>退出</span>
          </button>
        </div>
      )}
    </aside>
  )
}
