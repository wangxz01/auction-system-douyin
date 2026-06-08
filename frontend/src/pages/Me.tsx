import { useNavigate } from 'react-router-dom'
import { clearAuth, getUser } from '../lib/auth'
import { BottomNav } from '../components/BottomNav'

export function Me() {
  const nav = useNavigate()
  const me = getUser()

  const logout = () => {
    clearAuth()
    nav(0)
  }

  return (
    <div className="min-h-screen max-w-md mx-auto px-4 pb-24">
      <header className="sticky top-3 z-20 mt-3">
        <div className="glass rounded-3xl px-4 py-3">
          <h1 className="text-lg font-bold tracking-tight">👤 我的</h1>
        </div>
      </header>

      {/* 用户卡 */}
      <div className="glass-strong rounded-3xl mt-3 p-6 text-center fade-up">
        <div
          className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl text-white font-bold"
          style={{
            background:
              'linear-gradient(135deg, #FFD451 0%, #FF9500 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.6), 0 8px 20px rgba(255,149,0,0.35)',
          }}
        >
          {me ? me.username.slice(0, 1).toUpperCase() : '👤'}
        </div>
        {me ? (
          <>
            <div className="text-xl font-bold">{me.username}</div>
            <div className="text-xs text-ink-500 mt-1">UID #{me.user_id}</div>
            <button
              onClick={logout}
              className="btn-glass mt-4 px-5 py-2 rounded-full text-sm"
            >
              退出登录
            </button>
          </>
        ) : (
          <>
            <div className="text-ink-500 text-sm mb-3">尚未登录</div>
            <button
              onClick={() => nav('/login?from=/me')}
              className="btn-accent px-6 py-2 rounded-full text-sm"
            >
              立即登录
            </button>
          </>
        )}
      </div>

      {/* 菜单 */}
      <div className="glass rounded-3xl mt-3 overflow-hidden fade-up">
        <MenuRow icon="📜" label="我的拍卖记录" hint="功能开发中" disabled />
        <Divider />
        <MenuRow icon="📋" label="我的订单" hint="功能开发中" disabled />
        <Divider />
        <MenuRow
          icon="🛠️"
          label="商家后台"
          onClick={() => {
            if (!me) {
              nav('/login?from=/admin')
              return
            }
            nav('/admin')
          }}
        />
      </div>

      <div className="glass-soft rounded-3xl mt-3 p-4 text-center text-xs text-ink-500 fade-up">
        拍卖系统 v0.7 · 实时竞拍 · 价高者得
      </div>

      <BottomNav />
    </div>
  )
}

function MenuRow({
  icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  icon: string
  label: string
  hint?: string
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${
        disabled ? 'text-ink-400 cursor-not-allowed' : 'hover:bg-white/40 active:bg-white/60'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      {hint ? (
        <span className="text-xs text-ink-400">{hint}</span>
      ) : (
        <span className="text-ink-400">›</span>
      )}
    </button>
  )
}

function Divider() {
  return <div className="border-t border-white/50 mx-5" />
}
