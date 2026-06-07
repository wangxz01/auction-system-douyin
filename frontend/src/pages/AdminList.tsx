import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Auction } from '../lib/types'
import { StatusBadge } from '../components/StatusBadge'
import { clearAuth, getUser } from '../lib/auth'

export function AdminList() {
  const nav = useNavigate()
  const me = getUser()
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api
      .get<{ data: Auction[] }>('/auctions')
      .then((r) => {
        setAuctions(r.data.data)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleStart = async (id: number) => {
    try {
      await api.post(`/auctions/${id}/start`)
      load()
    } catch (e: unknown) {
      alert(extractError(e))
    }
  }

  const handleCancel = async (id: number) => {
    if (!confirm('确认取消该竞拍？')) return
    try {
      await api.post(`/auctions/${id}/cancel`)
      load()
    } catch (e: unknown) {
      alert(extractError(e))
    }
  }

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-4 pb-12">
      <header className="sticky top-3 z-20 mt-3">
        <div className="glass rounded-3xl px-5 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">🛠️ 商家后台</h1>
            <p className="text-[11px] text-ink-500">竞拍商品管理</p>
          </div>
          <div className="flex items-center gap-3">
            {me && (
              <div className="flex items-center gap-2 text-sm text-ink-500">
                <span>👤 {me.username}</span>
                <button
                  onClick={() => {
                    clearAuth()
                    nav('/login')
                  }}
                  className="btn-glass px-3 py-1 rounded-full text-xs"
                >
                  退出
                </button>
              </div>
            )}
            <Link
              to="/"
              className="text-xs text-ink-400 hover:text-ink-700"
            >
              → 用户端
            </Link>
          </div>
        </div>
      </header>

      <main className="mt-4">
        {loading && (
          <div className="glass rounded-2xl p-12 text-center text-ink-400">加载中...</div>
        )}
        {error && (
          <div className="glass rounded-2xl p-12 text-center text-rose-500">
            错误: {error}
          </div>
        )}
        {!loading && !error && (
          <div className="glass-strong rounded-3xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-500">
                  <th className="px-4 py-3 text-left font-medium">ID</th>
                  <th className="px-4 py-3 text-left font-medium">商品</th>
                  <th className="px-4 py-3 text-right font-medium">起拍价</th>
                  <th className="px-4 py-3 text-right font-medium">加价幅度</th>
                  <th className="px-4 py-3 text-right font-medium">当前价</th>
                  <th className="px-4 py-3 text-center font-medium">状态</th>
                  <th className="px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {auctions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-ink-400">
                      <div className="text-5xl mb-2">📦</div>
                      暂无竞拍，点击右下角 ＋ 创建
                    </td>
                  </tr>
                )}
                {auctions.map((a) => (
                  <tr
                    key={a.id}
                    className="border-t border-white/60 hover:bg-white/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-ink-400">#{a.id}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/auction/${a.id}`}
                        className="font-medium hover:text-accent-600"
                      >
                        {a.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-700">¥{a.start_price}</td>
                    <td className="px-4 py-3 text-right text-ink-700">¥{a.price_step}</td>
                    <td className="px-4 py-3 text-right text-accent-600 font-semibold">
                      ¥{a.current_price}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleStart(a.id)}
                            className="btn-accent px-3 py-1.5 rounded-full text-xs"
                          >
                            开始
                          </button>
                          <button
                            onClick={() => handleCancel(a.id)}
                            className="btn-glass px-3 py-1.5 rounded-full text-xs"
                          >
                            取消
                          </button>
                        </div>
                      )}
                      {a.status === 'active' && (
                        <button
                          onClick={() => handleCancel(a.id)}
                          className="btn-danger px-3 py-1.5 rounded-full text-xs"
                        >
                          取消竞拍
                        </button>
                      )}
                      {(a.status === 'finished' || a.status === 'cancelled') && (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* 悬浮加号按钮 */}
      <button
        onClick={() => nav('/admin/create')}
        className="fab fixed bottom-6 right-6 z-30"
        aria-label="发布新竞拍"
        title="发布新竞拍"
      >
        +
      </button>
    </div>
  )
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const r = (e as { response?: { data?: { error?: string } } }).response
    return r?.data?.error ?? '请求失败'
  }
  return String(e)
}
