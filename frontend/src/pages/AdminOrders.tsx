import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminOrderEntry } from '../lib/types'

export function AdminOrders() {
  const [items, setItems] = useState<AdminOrderEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<{ data: AdminOrderEntry[] }>('/admin/orders')
      .then((r) => {
        setItems(r.data.data)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <div className="admin-page-header">
        <div>
          <h1 className="ios-large-title">订单管理</h1>
          <p className="text-sm text-[#8E8E93] mt-1">查看成交订单与竞拍结果</p>
        </div>
      </div>

      <div className="ios-section-header" style={{ padding: '0 4px 8px' }}>
        <span>成交订单</span>
        {!loading && <span className="text-[#8E8E93]">{items.length} 单</span>}
      </div>

      {loading && <div className="bg-white rounded-2xl p-12 text-center text-[#8E8E93]">加载中...</div>}
      {error && <div className="bg-white rounded-2xl p-12 text-center text-[#FF3B30]">错误: {error}</div>}
      {!loading && !error && (
        <div className="bg-white rounded-2xl overflow-hidden">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-[#8E8E93] text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-medium">订单</th>
                <th className="px-5 py-3 text-left font-medium">商品</th>
                <th className="px-5 py-3 text-right font-medium">买家</th>
                <th className="px-5 py-3 text-right font-medium">成交价</th>
                <th className="px-5 py-3 text-center font-medium">状态</th>
                <th className="px-5 py-3 text-right font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-[#8E8E93]">
                    暂无订单
                  </td>
                </tr>
              )}
              {items.map(({ order, auction }) => (
                <tr key={order.id} className="hover:bg-[#F8F8F8] transition-colors">
                  <td className="px-5 py-3 text-[#8E8E93]">#{order.id}</td>
                  <td className="px-5 py-3 font-medium">
                    <Link to={`/admin/auctions/${auction.id}`} className="hover:text-[#FF9500]">
                      {auction.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-right text-[#3C3C43]">UID {order.user_id}</td>
                  <td className="px-5 py-3 text-right text-[#FF9500] font-semibold">¥{order.final_price}</td>
                  <td className="px-5 py-3 text-center">{order.status}</td>
                  <td className="px-5 py-3 text-right text-[#8E8E93]">{fmt(order.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function fmt(s: string): string {
  const d = new Date(s)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function pad(n: number) {
  return n.toString().padStart(2, '0')
}
