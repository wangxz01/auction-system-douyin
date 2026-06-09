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
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-8 py-7">
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="console-title">Settled Orders</div>
          <div className="console-subtitle mt-1">订单管理 · 成交结果</div>
        </div>
      </div>

      <div className="console-panel">
        <div className="console-panel-header">
          <span className="title">Order Log</span>
          <span className="count">{loading ? '…' : `${items.length} ORDERS`}</span>
        </div>

        {loading && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--console-ink-mute)', fontFamily: 'var(--font-console)' }}>
            Loading…
          </div>
        )}
        {error && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--console-crimson)', fontFamily: 'var(--font-console)' }}>
            ERROR · {error}
          </div>
        )}
        {!loading && !error && (
          <table className="console-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Order</th>
                <th>Lot · Title</th>
                <th style={{ textAlign: 'right' }}>Buyer</th>
                <th style={{ textAlign: 'right' }}>Hammer</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ textAlign: 'right', width: 160 }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center" style={{ padding: '48px 0', color: 'var(--console-ink-mute)', fontFamily: 'var(--font-console)' }}>
                    NO ORDERS YET
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
                      {order.status.toUpperCase()}
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

function fmt(s: string): string {
  const d = new Date(s)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function pad(n: number) {
  return n.toString().padStart(2, '0')
}
