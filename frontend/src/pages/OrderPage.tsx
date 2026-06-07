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
      <div className="min-h-screen max-w-md mx-auto p-8 text-center">
        <div className="text-5xl mb-4">😕</div>
        <p className="text-red-500 mb-4">{error}</p>
        <Link to="/" className="text-gray-500 hover:text-gray-700 text-sm">
          ← 返回大厅
        </Link>
      </div>
    )

  if (!order || !auction)
    return <div className="p-8 text-center text-gray-400">加载中...</div>

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <header className="bg-white shadow-sm p-4">
        <h1 className="text-lg font-bold">📋 我的订单</h1>
      </header>

      <div className="p-4 space-y-3">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="text-xs text-gray-400 mb-1">订单号</div>
          <div className="text-sm font-mono mb-4">#{order.id}</div>

          <div className="border-t border-gray-100 pt-4">
            <div className="text-sm text-gray-500 mb-1">商品</div>
            <div className="font-medium">{auction.title}</div>
          </div>

          <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between items-baseline">
            <span className="text-gray-500">成交价</span>
            <span className="text-2xl font-bold text-red-500">¥{order.final_price}</span>
          </div>

          <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between">
            <span className="text-gray-500">状态</span>
            <span className={paid ? 'text-green-600 font-medium' : 'text-gray-700'}>
              {paid ? '✓ 已支付' : '待支付'}
            </span>
          </div>
        </div>

        {!paid ? (
          <button
            onClick={() => setPaid(true)}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-lg font-bold"
          >
            模拟支付 ¥{order.final_price}
          </button>
        ) : (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-6 text-center">
            <div className="text-4xl mb-2">✅</div>
            <div className="font-bold text-lg">支付成功</div>
            <div className="text-sm mt-1">感谢您的购买！</div>
          </div>
        )}

        <Link
          to="/"
          className="block text-center text-gray-400 text-sm py-2 hover:text-gray-600"
        >
          ← 返回大厅
        </Link>
      </div>
    </div>
  )
}
