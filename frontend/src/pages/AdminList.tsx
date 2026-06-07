import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Auction } from '../lib/types'
import { StatusBadge } from '../components/StatusBadge'

export function AdminList() {
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
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">🛠️ 商家后台 · 竞拍管理</h1>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
              → 用户端
            </Link>
            <Link
              to="/admin/create"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
            >
              + 发布新竞拍
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {loading && <div className="text-center text-gray-400 py-12">加载中...</div>}
        {error && <div className="text-center text-red-500 py-12">错误: {error}</div>}
        {!loading && !error && (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">商品</th>
                  <th className="px-4 py-3 text-right">起拍价</th>
                  <th className="px-4 py-3 text-right">加价幅度</th>
                  <th className="px-4 py-3 text-right">当前价</th>
                  <th className="px-4 py-3 text-center">状态</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {auctions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      暂无竞拍，点击右上角创建
                    </td>
                  </tr>
                )}
                {auctions.map((a) => (
                  <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">#{a.id}</td>
                    <td className="px-4 py-3">
                      <Link to={`/auction/${a.id}`} className="font-medium hover:text-blue-600">
                        {a.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">¥{a.start_price}</td>
                    <td className="px-4 py-3 text-right">¥{a.price_step}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-semibold">
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
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs"
                          >
                            开始
                          </button>
                          <button
                            onClick={() => handleCancel(a.id)}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-1 rounded text-xs"
                          >
                            取消
                          </button>
                        </div>
                      )}
                      {a.status === 'active' && (
                        <button
                          onClick={() => handleCancel(a.id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs"
                        >
                          取消竞拍
                        </button>
                      )}
                      {(a.status === 'finished' || a.status === 'cancelled') && (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
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
