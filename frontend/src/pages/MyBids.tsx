import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { MyBidEntry } from '../lib/types'
import { StatusBadge } from '../components/StatusBadge'

export function MyBids() {
  const nav = useNavigate()
  const [list, setList] = useState<MyBidEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<{ data: MyBidEntry[] }>('/me/bids')
      .then((r) => setList(r.data.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen max-w-md mx-auto pb-8">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h1 className="ios-large-title">我的拍卖</h1>
        <Link to="/me" className="text-[#FF9500] text-sm">返回</Link>
      </div>

      <div className="ios-section-header">
        <span>参与过的竞拍</span>
        {!loading && <span className="text-[#8E8E93]">{list.length} 个</span>}
      </div>

      {loading && (
        <div className="mx-4">
          <div className="bg-white rounded-2xl p-12 text-center text-[#8E8E93]">加载中...</div>
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="mx-4">
          <div className="bg-white rounded-2xl p-12 text-center text-[#8E8E93]">
            <div className="text-4xl mb-2">🪙</div>
            <div className="text-sm">还没参与过任何竞拍</div>
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
          const a = e.auction
          const finished = a.status === 'finished'
          const cancelled = a.status === 'cancelled'
          const lostFinal = finished && !e.is_leading

          return (
            <Link
              key={a.id}
              to={`/auction/${a.id}`}
              className="block bg-white rounded-2xl overflow-hidden active:opacity-70 transition-opacity"
            >
              {/* 顶部条 */}
              <div className="flex">
                {a.image_url ? (
                  <img
                    src={a.image_url}
                    alt={a.title}
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
                    <h2 className="font-semibold text-[15px] truncate">{a.title}</h2>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="text-xs text-[#8E8E93] mt-1.5 flex items-center gap-3">
                    <span>我出价 {e.my_bid_count} 次</span>
                    <span>最高 ¥{e.my_highest_bid}</span>
                  </div>
                </div>
              </div>

              {/* 状态条 */}
              <div className="px-3 py-2 border-t border-[#F2F2F7] flex items-center justify-between text-[13px]">
                <span className="text-[#8E8E93]">
                  当前最高：
                  <span className="text-[#FF9500] font-semibold ml-1">¥{a.current_price}</span>
                </span>
                {cancelled ? (
                  <span className="text-[#8E8E93]">已取消</span>
                ) : e.is_leading && !finished ? (
                  <span className="text-[#34C759] font-medium">✨ 你正领先</span>
                ) : e.is_leading && finished ? (
                  <span className="text-[#34C759] font-medium">🏆 你拍到了</span>
                ) : lostFinal ? (
                  <span className="text-[#8E8E93]">未中标</span>
                ) : (
                  <span className="text-[#FF9500]">已被超越</span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
