import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
      <div className="admin-page-header">
        <div>
          <h1 className="ios-large-title">竞拍管理</h1>
          <p className="text-sm text-[#8E8E93] mt-1">查看、开始或取消你发布的竞拍</p>
        </div>
        <button
          onClick={() => nav('/admin/create')}
          className="btn-accent px-5 py-2 rounded-full text-sm"
        >
          ＋ 发布新竞拍
        </button>
      </div>

      <div className="ios-section-header" style={{ padding: '0 4px 8px' }}>
        <span>全部竞拍</span>
        {!loading && <span className="text-[#8E8E93]">{auctions.length} 件</span>}
      </div>

      {loading && (
        <div className="bg-white rounded-2xl p-12 text-center text-[#8E8E93]">加载中...</div>
      )}
      {error && (
        <div className="bg-white rounded-2xl p-12 text-center text-[#FF3B30]">错误: {error}</div>
      )}
      {!loading && !error && (
        <div className="bg-white rounded-2xl overflow-hidden">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-[#8E8E93] text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-medium">ID</th>
                <th className="px-5 py-3 text-left font-medium">商品</th>
                <th className="px-5 py-3 text-right font-medium">起拍价</th>
                <th className="px-5 py-3 text-right font-medium">加价幅度</th>
                <th className="px-5 py-3 text-right font-medium">当前价</th>
                <th className="px-5 py-3 text-center font-medium">状态</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {auctions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-[#8E8E93]">
                    <div className="text-5xl mb-2">📦</div>
                    暂无竞拍
                  </td>
                </tr>
              )}
              {auctions.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => nav(`/admin/auctions/${a.id}`)}
                  className="relative hover:bg-[#F8F8F8] active:bg-[#EFEFEF] transition-colors cursor-pointer admin-row"
                >
                  <td className="px-5 py-3 text-[#8E8E93]">#{a.id}</td>
                  <td className="px-5 py-3 font-medium">{a.title}</td>
                  <td className="px-5 py-3 text-right text-[#3C3C43]">¥{a.start_price}</td>
                  <td className="px-5 py-3 text-right text-[#3C3C43]">¥{a.price_step}</td>
                  <td className="px-5 py-3 text-right text-[#FF9500] font-semibold">
                    ¥{a.current_price}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
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
                      <span className="text-[#C7C7CC]">—</span>
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
