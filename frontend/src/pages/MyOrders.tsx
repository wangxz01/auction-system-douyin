import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { MyOrderEntry } from '../lib/types'
import { BottomNav } from '../components/BottomNav'

export function MyOrders() {
  const nav = useNavigate()
  const [list, setList] = useState<MyOrderEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<{ data: MyOrderEntry[] }>('/me/orders')
      .then((r) => setList(r.data.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen max-w-md mx-auto pb-28">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h1 className="ios-large-title">我的订单</h1>
        <Link to="/me" className="text-[#FF9500] text-sm">返回</Link>
      </div>

      <div className="ios-section-header">
        <span>全部订单</span>
        {!loading && <span className="text-[#8E8E93]">{list.length} 笔</span>}
      </div>

      {loading && (
        <div className="mx-4">
          <div className="bg-white rounded-2xl p-12 text-center text-[#8E8E93]">加载中...</div>
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="mx-4">
          <div className="bg-white rounded-2xl p-12 text-center text-[#8E8E93]">
            <div className="text-4xl mb-2">📭</div>
            <div className="text-sm">还没有订单</div>
            <button
              onClick={() => nav('/')}
              className="btn-accent px-5 py-2 rounded-full text-sm mt-4"
            >
              去逛逛
            </button>
          </div>
        </div>
      )}

      <div className="px-4 space-y-3">
        {list.map((e) => {
          const { order, auction } = e
          return (
            <Link
              key={order.id}
              to={`/auction/${auction.id}/order`}
              className="block bg-white rounded-2xl overflow-hidden active:opacity-70 transition-opacity"
            >
              <div className="flex">
                {auction.image_url ? (
                  <img
                    src={auction.image_url}
                    alt={auction.title}
                    className="w-20 h-20 object-cover bg-[#F2F2F7]"
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-20 h-20 flex items-center justify-center text-2xl bg-[#F2F2F7]">
                    📦
                  </div>
                )}
                <div className="flex-1 px-3 py-2.5 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-[15px] truncate">{auction.title}</h2>
                    <span className="text-xs text-[#8E8E93] shrink-0">#{order.id}</span>
                  </div>
                  <div className="text-xs text-[#8E8E93] mt-1.5">{fmt(order.created_at)}</div>
                </div>
              </div>

              <div className="px-3 py-2.5 border-t border-[#F2F2F7] flex items-center justify-between">
                <span className="text-[#FF9500] font-bold text-lg">¥{order.final_price}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    order.status === 'paid'
                      ? 'bg-[#E4F8E4] text-[#1F7A2B] border-[#B6E3B6]'
                      : 'bg-[#FFF1D6] text-[#9B5C00] border-[#FFE0A8]'
                  }`}
                >
                  {order.status === 'paid' ? '已支付' : '待支付'}
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      <BottomNav />
    </div>
  )
}

function fmt(s: string): string {
  const d = new Date(s)
  return `${d.getMonth() + 1}-${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function pad(n: number) {
  return n.toString().padStart(2, '0')
}
