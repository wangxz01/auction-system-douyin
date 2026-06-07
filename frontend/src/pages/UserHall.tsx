import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Auction } from '../lib/types'
import { StatusBadge } from '../components/StatusBadge'
import { clearAuth, getUser } from '../lib/auth'

export function UserHall() {
  const nav = useNavigate()
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)
  const me = getUser()

  useEffect(() => {
    api
      .get<{ data: Auction[] }>('/auctions')
      .then((r) => {
        setAuctions(
          r.data.data.filter((a) => a.status === 'active' || a.status === 'pending'),
        )
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen max-w-md mx-auto px-4 pb-12">
      {/* 顶部玻璃栏 */}
      <header className="sticky top-3 z-20 mt-3">
        <div className="glass rounded-3xl px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">🛒 拍卖大厅</h1>
            <p className="text-[11px] text-ink-500">实时竞拍 · 价高者得</p>
          </div>
          {me ? (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-xs text-ink-500">登录为</div>
                <div className="text-sm font-medium text-ink-900">{me.username}</div>
              </div>
              <button
                onClick={() => {
                  clearAuth()
                  nav(0)
                }}
                className="btn-glass px-3 py-1.5 rounded-full text-xs"
              >
                退出
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="btn-accent px-4 py-2 rounded-full text-sm"
            >
              登录 / 注册
            </Link>
          )}
        </div>
      </header>

      {/* 商家入口 */}
      <Link
        to="/admin"
        className="block text-center text-xs text-ink-400 py-3 hover:text-ink-700"
      >
        → 进入商家后台
      </Link>

      {/* 列表 */}
      <div className="space-y-3">
        {loading && (
          <div className="glass rounded-2xl p-12 text-center text-ink-400">
            加载中...
          </div>
        )}
        {!loading && auctions.length === 0 && (
          <div className="glass rounded-2xl p-12 text-center text-ink-400">
            <div className="text-5xl mb-2">📭</div>
            <div className="text-sm">暂无进行中的竞拍</div>
          </div>
        )}
        {auctions.map((a, idx) => (
          <Link
            key={a.id}
            to={`/auction/${a.id}`}
            className="block glass rounded-3xl overflow-hidden fade-up active:scale-[0.98] transition-transform"
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <div className="flex">
              {a.image_url ? (
                <img
                  src={a.image_url}
                  alt={a.title}
                  className="w-28 h-28 object-cover"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <div className="w-28 h-28 flex items-center justify-center text-3xl bg-gradient-to-br from-amber-200/60 to-orange-200/60">
                  📦
                </div>
              )}
              <div className="flex-1 p-3.5 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold leading-snug text-ink-900">{a.title}</h2>
                  <StatusBadge status={a.status} />
                </div>
                <div>
                  <p className="text-[11px] text-ink-500">当前价</p>
                  <p className="text-2xl font-bold text-accent-600">
                    ¥{a.current_price}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
