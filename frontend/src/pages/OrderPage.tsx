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
      <div className="min-h-screen max-w-md mx-auto p-6">
        <div className="card p-10 text-center">
          <div className="text-5xl mb-3">😕</div>
          <p className="text-rose-600 mb-4">{error}</p>
          <Link to="/" className="text-ink-400 hover:text-ink-700 text-sm">
            ← 返回大厅
          </Link>
        </div>
      </div>
    )

  if (!order || !auction)
    return (
      <div className="min-h-screen max-w-md mx-auto p-6">
        <div className="card p-10 text-center text-ink-400">加载中...</div>
      </div>
    )

  return (
    <div className="min-h-screen max-w-md mx-auto px-4 pb-12">
      <div className="pt-4 pb-2">
        <h1 className="text-2xl font-bold tracking-tight">我的订单</h1>
        <p className="text-xs text-ink-500 mt-1">查看与支付</p>
      </div>

      <div className="space-y-3 mt-3">
        <div className="card p-5 fade-up">
          <div className="text-xs text-ink-400 mb-1">订单号</div>
          <div className="text-sm font-mono mb-4">#{order.id}</div>

          <Divider />
          <Row label="商品" value={auction.title} />
          <Divider />
          <Row
            label="成交价"
            value={
              <span className="text-2xl font-bold text-accent-600">¥{order.final_price}</span>
            }
          />
          <Divider />
          <Row
            label="状态"
            value={
              paid ? (
                <span className="text-green-600 font-medium">✓ 已支付</span>
              ) : (
                <span className="text-ink-700">待支付</span>
              )
            }
          />
        </div>

        {!paid ? (
          <button
            onClick={() => setPaid(true)}
            className="btn-accent w-full py-3.5 rounded-2xl text-base"
          >
            模拟支付 ¥{order.final_price}
          </button>
        ) : (
          <div className="card p-7 text-center fade-up">
            <div className="text-5xl mb-2">✅</div>
            <div className="font-bold text-lg text-green-600">支付成功</div>
            <div className="text-sm text-ink-500 mt-1">感谢您的购买！</div>
          </div>
        )}

        <Link
          to="/"
          className="block text-center text-ink-400 text-sm py-2 hover:text-ink-700"
        >
          ← 返回大厅
        </Link>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline py-2.5">
      <span className="text-ink-500 text-sm">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function Divider() {
  return <div className="border-t border-app-100" />
}
