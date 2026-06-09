import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminOrderEntry } from '../lib/types'
import { paddleNumberOf } from '../lib/paddle'

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
      .catch((e) => setError(extractError(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-8 py-7">
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="console-title">成交订单</div>
          <div className="console-subtitle mt-1">订单管理 · 成交结果</div>
        </div>
      </div>

      <div className="console-panel">
        <div className="console-panel-header">
          <span className="title">订单列表</span>
          <span className="count">{loading ? '…' : `共 ${items.length} 笔`}</span>
        </div>

        {loading && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--console-ink-mute)', fontFamily: 'var(--font-console)' }}>
            加载中…
          </div>
        )}
        {error && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--console-crimson)', fontFamily: 'var(--font-console)' }}>
            错误 · {error}
          </div>
        )}
        {!loading && !error && (
          <table className="console-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>订单</th>
                <th>竞拍 · 商品</th>
                <th style={{ textAlign: 'right' }}>买家</th>
                <th style={{ textAlign: 'right' }}>成交价</th>
                <th style={{ width: 100 }}>状态</th>
                <th style={{ textAlign: 'right', width: 160 }}>时间</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center" style={{ padding: '48px 0', color: 'var(--console-ink-mute)', fontFamily: 'var(--font-console)' }}>
                    暂无订单
                  </td>
                </tr>
              )}
              {items.map(({ order, auction }) => (
                <tr key={order.id}>
                  <td className="num" style={{ textAlign: 'left', color: 'var(--console-ink-soft)' }}>
                    #{String(order.id).padStart(4, '0')}
                  </td>
                  <td>
                    <Link
                      to={`/admin/auctions/${auction.id}`}
                      style={{ color: 'var(--console-ink)' }}
                      className="hover:underline"
                    >
                      <span style={{ color: 'var(--console-cyan)', fontFamily: 'var(--font-console)', fontSize: 11, marginRight: 8 }}>
                        #{String(auction.id).padStart(4, '0')}
                      </span>
                      {auction.title}
                    </Link>
                  </td>
                  <td className="num">{paddleNumberOf(order.user_id)}</td>
                  <td className="num hi">¥{Number(order.final_price).toLocaleString()}</td>
                  <td>
                    <span className="console-status pending">
                      <span className="dot" />
                      {orderStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="num" style={{ color: 'var(--console-ink-mute)' }}>{fmt(order.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function orderStatusLabel(status: string): string {
  if (status === 'pending') return '待支付'
  if (status === 'paid') return '已支付'
  if (status === 'cancelled') return '已取消'
  return status
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const r = (e as { response?: { data?: { error?: string } } }).response
    return r?.data?.error ?? '请求失败'
  }
  return '请求失败'
}

function fmt(s: string): string {
  const d = new Date(s)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function pad(n: number) {
  return n.toString().padStart(2, '0')
}
