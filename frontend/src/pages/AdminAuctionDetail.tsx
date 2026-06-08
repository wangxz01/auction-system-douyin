import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Auction, Bid, Order } from '../lib/types'
import { StatusBadge } from '../components/StatusBadge'

export function AdminAuctionDetail() {
  const { id } = useParams<{ id: string }>()
  const auctionId = Number(id)
  const nav = useNavigate()

  const [auction, setAuction] = useState<Auction | null>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get<{ data: Auction }>(`/auctions/${auctionId}`),
      api.get<{ data: Bid[] }>(`/auctions/${auctionId}/bids`),
    ])
      .then(([a, b]) => {
        setAuction(a.data.data)
        setBids(b.data.data)
        if (a.data.data.status === 'finished') {
          api
            .get<{ data: Order }>(`/auctions/${auctionId}/order`)
            .then((o) => setOrder(o.data.data))
            .catch(() => setOrder(null))
        }
        setError(null)
      })
      .catch((e) => setError(extractError(e)))
      .finally(() => setLoading(false))
  }

  useEffect(load, [auctionId])

  const onStart = async () => {
    try {
      await api.post(`/auctions/${auctionId}/start`)
      load()
    } catch (e) {
      alert(extractError(e))
    }
  }

  const onCancel = async () => {
    if (!confirm('确认取消该竞拍？此操作不可撤销。')) return
    try {
      await api.post(`/auctions/${auctionId}/cancel`)
      load()
    } catch (e) {
      alert(extractError(e))
    }
  }

  if (loading)
    return <div className="p-12 text-center text-ink-400">加载中...</div>
  if (error)
    return (
      <div className="p-12 text-center text-rose-500">
        {error}
        <div className="mt-4">
          <button onClick={() => nav('/admin')} className="btn-default px-4 py-2 rounded-full text-sm">
            返回列表
          </button>
        </div>
      </div>
    )
  if (!auction) return null

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            to="/admin"
            className="text-xs text-ink-400 hover:text-ink-700"
          >
            ← 返回列表
          </Link>
          <div className="flex items-baseline gap-3 mt-1">
            <h1 className="text-2xl font-bold tracking-tight">{auction.title}</h1>
            <StatusBadge status={auction.status} />
            <span className="text-xs text-ink-400">#{auction.id}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {auction.status === 'pending' && (
            <>
              <button onClick={onStart} className="btn-accent px-5 py-2 rounded-full text-sm">
                ▶ 开始竞拍
              </button>
              <button onClick={onCancel} className="btn-default px-5 py-2 rounded-full text-sm">
                取消
              </button>
            </>
          )}
          {auction.status === 'active' && (
            <button onClick={onCancel} className="btn-danger px-5 py-2 rounded-full text-sm">
              强制取消竞拍
            </button>
          )}
          {(auction.status === 'finished' || auction.status === 'cancelled') && (
            <span className="text-ink-400 text-sm self-center">竞拍已结束，无操作</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* 商品信息 */}
        <div className="card col-span-2 p-6">
          <h2 className="text-sm font-semibold text-ink-700 mb-4">📦 商品信息</h2>
          <div className="grid grid-cols-2 gap-4">
            {auction.image_url ? (
              <img
                src={auction.image_url}
                alt={auction.title}
                className="w-full h-40 object-cover rounded-xl bg-app-100"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <div className="w-full h-40 bg-app-100 rounded-xl flex items-center justify-center text-4xl">
                📦
              </div>
            )}
            <div className="space-y-2">
              <Info label="商品名称" value={auction.title} />
              <Info label="图片 URL" value={auction.image_url || '—'} mono />
            </div>
          </div>
          {auction.description && (
            <div className="mt-4">
              <div className="text-xs text-ink-500 mb-1">商品描述</div>
              <div className="text-sm leading-relaxed text-ink-800 whitespace-pre-line">
                {auction.description}
              </div>
            </div>
          )}
        </div>

        {/* 价格规则 */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-ink-700 mb-4">💰 价格规则</h2>
          <div className="space-y-2">
            <Info label="起拍价" value={`¥${auction.start_price}`} />
            <Info label="加价幅度" value={`¥${auction.price_step}`} />
            <Info
              label="封顶价"
              value={auction.ceiling_price ? `¥${auction.ceiling_price}` : '无封顶'}
            />
            <Info label="持续时长" value={`${auction.duration_seconds} 秒`} />
            <div className="pt-2 mt-2 border-t border-app-200">
              <Info
                label="当前最高价"
                value={
                  <span className="text-accent-600 text-xl font-bold">
                    ¥{auction.current_price}
                  </span>
                }
              />
              <Info
                label="领先者"
                value={auction.winner_id ? `UID ${auction.winner_id}` : '尚无'}
              />
            </div>
          </div>
        </div>

        {/* 时间 */}
        <div className="card col-span-3 p-6">
          <h2 className="text-sm font-semibold text-ink-700 mb-4">⏱ 时间</h2>
          <div className="grid grid-cols-3 gap-6">
            <Info label="创建于" value={fmt(auction.created_at)} />
            <Info label="开始于" value={fmt(auction.started_at)} />
            <Info label="结束于" value={fmt(auction.ends_at)} />
          </div>
        </div>

        {/* 出价历史 */}
        <div className="card col-span-2 p-6">
          <h2 className="text-sm font-semibold text-ink-700 mb-4">
            📊 出价历史 <span className="text-ink-400 font-normal">({bids.length} 条)</span>
          </h2>
          {bids.length === 0 ? (
            <div className="text-center text-ink-400 py-8 text-sm">还没有出价</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-ink-500">
                <tr>
                  <th className="text-left py-2 font-medium">排名</th>
                  <th className="text-left py-2 font-medium">UID</th>
                  <th className="text-right py-2 font-medium">金额</th>
                </tr>
              </thead>
              <tbody>
                {bids.slice(0, 20).map((b, i) => (
                  <tr key={b.id} className="border-t border-app-100">
                    <td className="py-2 text-ink-500">#{i + 1}</td>
                    <td className="py-2">UID {b.user_id}</td>
                    <td className="py-2 text-right font-semibold">¥{b.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 订单 */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-ink-700 mb-4">🧾 订单</h2>
          {order ? (
            <div className="space-y-2">
              <Info label="订单号" value={`#${order.id}`} mono />
              <Info label="买家" value={`UID ${order.user_id}`} />
              <Info
                label="成交价"
                value={<span className="text-accent-600 font-bold">¥{order.final_price}</span>}
              />
              <Info label="状态" value={order.status} />
            </div>
          ) : (
            <div className="text-center text-ink-400 py-8 text-sm">
              {auction.status === 'finished' ? '订单尚未生成或加载失败' : '竞拍结束后会自动生成订单'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Info({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-xs text-ink-500 shrink-0">{label}</span>
      <span className={`text-sm text-ink-800 text-right truncate ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function fmt(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function pad(n: number) {
  return n.toString().padStart(2, '0')
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const r = (e as { response?: { data?: { error?: string } } }).response
    return r?.data?.error ?? '请求失败'
  }
  return String(e)
}
