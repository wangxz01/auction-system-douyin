import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Auction, Order } from '../lib/types'

export function OrderPage() {
  const { id } = useParams<{ id: string }>()
  const auctionId = Number(id)
  const [order, setOrder] = useState<Order | null>(null)
  const [auction, setAuction] = useState<Auction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get<{ data: Order }>(`/auctions/${auctionId}/order`),
      api.get<{ data: Auction }>(`/auctions/${auctionId}`),
    ])
      .then(([o, a]) => {
        setOrder(o.data.data)
        setAuction(a.data.data)
      })
      .catch((e) => {
        const r = (e as { response?: { data?: { error?: string } } }).response
        setError(r?.data?.error ?? '加载订单失败')
      })
  }, [auctionId])

  if (error)
    return (
      <div className="min-h-screen max-w-md mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl p-10 text-center">
          <div className="text-5xl mb-3">😕</div>
          <p className="text-[#FF3B30] mb-4">{error}</p>
          <Link to="/" className="text-[#FF9500] text-sm">
            返回大厅
          </Link>
        </div>
      </div>
    )

  if (!order || !auction)
    return (
      <div className="min-h-screen max-w-md mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl p-10 text-center text-[#8E8E93]">加载中...</div>
      </div>
    )

  return (
    <div className="min-h-screen max-w-md mx-auto pb-10">
      <div className="px-5 pt-5 pb-3">
        <h1 className="ios-large-title">订单</h1>
      </div>

      {/* 订单详情 inset list */}
      <div className="ios-section-header">订单信息</div>
      <div className="ios-list">
        <div className="ios-list-item no-icon">
          <span className="flex-1 text-[#3C3C43]">订单号</span>
          <span className="text-sm text-[#8E8E93] font-mono">#{order.id}</span>
        </div>
        <div className="ios-list-item no-icon">
          <span className="flex-1 text-[#3C3C43]">商品</span>
          <span className="text-sm text-right truncate max-w-[55%]">{auction.title}</span>
        </div>
        <div className="ios-list-item no-icon">
          <span className="flex-1 text-[#3C3C43]">成交价</span>
          <span className="text-base font-bold text-[#FF9500]">¥{order.final_price}</span>
        </div>
        <div className="ios-list-item no-icon">
          <span className="flex-1 text-[#3C3C43]">状态</span>
          {paid ? (
            <span className="text-sm text-[#34C759] font-medium">✓ 已支付</span>
          ) : (
            <span className="text-sm text-[#8E8E93]">待支付</span>
          )}
        </div>
      </div>

      {/* 操作 */}
      <div className="px-4 mt-8">
        {!paid ? (
          <button
            onClick={() => setPaid(true)}
            className="btn-accent w-full py-3.5 rounded-2xl text-base"
          >
            模拟支付 ¥{order.final_price}
          </button>
        ) : (
          <div className="bg-white rounded-2xl p-7 text-center fade-up">
            <div className="text-5xl mb-2">✅</div>
            <div className="font-bold text-lg text-[#34C759]">支付成功</div>
            <div className="text-sm text-[#8E8E93] mt-1">感谢您的购买！</div>
          </div>
        )}
      </div>

      <div className="text-center mt-6">
        <Link to="/" className="text-[#FF9500] text-sm">返回大厅</Link>
      </div>
    </div>
  )
}
