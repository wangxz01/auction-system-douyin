import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clearAuth, getUser } from '../lib/auth'

const ITEMS = [
  { to: '/admin', icon: '📋', label: '竞拍管理', match: (p: string) => p === '/admin' || p.startsWith('/admin/auctions') },
  { to: '/admin/create', icon: '➕', label: '发布商品', match: (p: string) => p === '/admin/create' },
] as const

export function AdminSidebar() {
  const { pathname } = useLocation()
  const nav = useNavigate()
  const me = getUser()

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand" title="拍卖系统">🏷️</div>

      {ITEMS.map((it) => {
        const active = it.match(pathname)
        return (
          <Link
            key={it.to}
            to={it.to}
            className={`admin-sidebar-item ${active ? 'is-active' : ''}`}
          >
            <span className="icon">{it.icon}</span>
            <span>{it.label}</span>
          </Link>
        )
      })}

      <div className="admin-sidebar-spacer" />

      {me && (
        <>
          <div className="admin-sidebar-item" title={me.username}>
            <span className="icon">👤</span>
            <span className="truncate max-w-[64px]">{me.username}</span>
          </div>
          <button
            onClick={() => {
              clearAuth()
              nav('/login')
            }}
            className="admin-sidebar-item"
          >
            <span className="icon">↩</span>
            <span>退出</span>
          </button>
        </>
      )}
    </aside>
  )
}
