import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Auction, AuctionStatus } from '../lib/types'
import { StatusBadge } from '../components/StatusBadge'
import { BottomNav } from '../components/BottomNav'

type Filter = 'all' | 'active' | 'pending'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'pending', label: '即将开始' },
]

export function UserHall() {
  const [all, setAll] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    api
      .get<{ data: Auction[] }>('/auctions')
      .then((r) => {
        // 用户端只显示未结束 / 未取消的
        setAll(
          r.data.data.filter(
            (a) => a.status === 'active' || a.status === 'pending',
          ),
        )
      })
      .finally(() => setLoading(false))
  }, [])

  const list = useMemo(() => {
    if (filter === 'all') return all
    return all.filter((a) => a.status === (filter as AuctionStatus))
  }, [all, filter])

  return (
    <div className="min-h-screen max-w-md mx-auto px-4 pb-24">
      {/* 大标题 */}
      <div className="pt-4 pb-2">
        <h1 className="text-3xl font-bold tracking-tight">拍卖大厅</h1>
        <p className="text-xs text-ink-500 mt-1">实时竞拍 · 价高者得</p>
      </div>

      {/* 过滤 pill */}
      <div className="pill-group mt-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            data-active={filter === f.key}
            onClick={() => setFilter(f.key)}
            className="pill-tab"
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 卡片列表 */}
      <div className="space-y-3 mt-4">
        {loading && (
          <div className="card p-12 text-center text-ink-400">加载中...</div>
        )}
        {!loading && list.length === 0 && (
          <div className="card p-12 text-center text-ink-400">
            <div className="text-5xl mb-2">📭</div>
            <div className="text-sm">暂无竞拍</div>
          </div>
        )}
        {list.map((a, idx) => (
          <Link
            key={a.id}
            to={`/auction/${a.id}`}
            className="block card card-hover overflow-hidden fade-up active:scale-[0.98] transition-transform"
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <div className="flex">
              {a.image_url ? (
                <img
                  src={a.image_url}
                  alt={a.title}
                  className="w-28 h-28 object-cover bg-app-100"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <div className="w-28 h-28 flex items-center justify-center text-3xl bg-app-100">
                  📦
                </div>
              )}
              <div className="flex-1 p-3.5 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold leading-snug text-ink-900">{a.title}</h2>
                  <StatusBadge status={a.status} />
                </div>
                <div>
                  <p className="text-[11px] text-ink-500">当前价</p>
                  <p className="text-2xl font-bold text-accent-600">¥{a.current_price}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <BottomNav />
    </div>
  )
}
