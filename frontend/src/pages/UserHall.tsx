import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Auction } from '../lib/types'
import { StatusBadge } from '../components/StatusBadge'
import { getUserId } from '../lib/user'

export function UserHall() {
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)
  const uid = getUserId()

  useEffect(() => {
    api
      .get<{ data: Auction[] }>('/auctions')
      .then((r) => {
        setAuctions(
          r.data.data.filter((a) => a.status === 'active' || a.status === 'pending'),
        )
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <header className="bg-gradient-to-r from-red-500 to-pink-500 text-white p-4 shadow">
        <div className="flex justify-between items-baseline">
          <h1 className="text-xl font-bold">🛒 拍卖大厅</h1>
          <span className="text-xs opacity-80">UID: {uid}</span>
        </div>
        <p className="text-xs opacity-90 mt-1">实时竞拍 · 价高者得</p>
      </header>

      <Link
        to="/admin"
        className="block text-center text-xs text-gray-400 py-2 hover:text-gray-600"
      >
        → 商家后台
      </Link>

      <div className="p-3 space-y-3">
        {loading && <div className="text-center text-gray-400 py-12">加载中...</div>}
        {!loading && auctions.length === 0 && (
          <div className="text-center text-gray-400 py-12">暂无进行中的竞拍</div>
        )}
        {auctions.map((a) => (
          <Link
            key={a.id}
            to={`/auction/${a.id}`}
            className="block bg-white rounded-lg shadow-sm overflow-hidden active:scale-[0.98] transition"
          >
            <div className="flex">
              {a.image_url ? (
                <img
                  src={a.image_url}
                  alt={a.title}
                  className="w-24 h-24 object-cover bg-gray-100"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-400">
                  📦
                </div>
              )}
              <div className="flex-1 p-3 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-medium leading-tight">{a.title}</h2>
                  <StatusBadge status={a.status} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">当前价</p>
                  <p className="text-red-500 text-xl font-bold">¥{a.current_price}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
