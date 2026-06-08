import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Auction } from '../lib/types'
import { StatusBadge } from '../components/StatusBadge'

export function AdminList() {
  const nav = useNavigate()
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

  const handleStart = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await api.post(`/auctions/${id}/start`)
      load()
    } catch (err) {
      alert(extractError(err))
    }
  }

  const handleCancel = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('确认取消该竞拍？')) return
    try {
      await api.post(`/auctions/${id}/cancel`)
      load()
    } catch (err) {
      alert(extractError(err))
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">竞拍管理</h1>
          <p className="text-sm text-ink-500 mt-1">查看、开始或取消你发布的竞拍</p>
        </div>
        <button
          onClick={() => nav('/admin/create')}
          className="btn-accent px-5 py-2.5 rounded-full text-sm"
        >
          ＋ 发布新竞拍
        </button>
      </div>

      {loading && (
        <div className="card p-12 text-center text-ink-400">加载中...</div>
      )}
      {error && (
        <div className="card p-12 text-center text-rose-500">错误: {error}</div>
      )}
      {!loading && !error && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-500 bg-app-50">
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
                    暂无竞拍，点击右上角发布
                  </td>
                </tr>
              )}
              {auctions.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => nav(`/admin/auctions/${a.id}`)}
                  className="border-t border-app-100 hover:bg-app-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-ink-400">#{a.id}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/auctions/${a.id}`}
                      onClick={(e) => e.stopPropagation()}
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
                          onClick={(e) => handleStart(e, a.id)}
                          className="btn-accent px-3 py-1.5 rounded-full text-xs"
                        >
                          开始
                        </button>
                        <button
                          onClick={(e) => handleCancel(e, a.id)}
                          className="btn-default px-3 py-1.5 rounded-full text-xs"
                        >
                          取消
                        </button>
                      </div>
                    )}
                    {a.status === 'active' && (
                      <button
                        onClick={(e) => handleCancel(e, a.id)}
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
