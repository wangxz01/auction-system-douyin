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
    <div className="min-h-screen max-w-md mx-auto pb-28">
      {/* iOS 大标题 */}
      <div className="px-5 pt-5 pb-3">
        <h1 className="ios-large-title">拍卖大厅</h1>
        <p className="text-sm text-[#8E8E93] mt-1">实时竞拍 · 价高者得</p>
      </div>

      {/* 过滤 */}
      <div className="px-4">
        <div className="pill-group w-full grid grid-cols-3">
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
      </div>

      {/* 分组标题 + 卡片列表 */}
      <div className="ios-section-header mt-5">
        <span>{filter === 'all' ? '全部商品' : filter === 'active' ? '进行中' : '即将开始'}</span>
        {!loading && <span className="text-[#8E8E93]">{list.length} 件</span>}
      </div>

      <div className="px-4 space-y-3">
        {loading && (
          <div className="bg-white rounded-2xl p-12 text-center text-[#8E8E93]">加载中...</div>
        )}
        {!loading && list.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center text-[#8E8E93]">
            <div className="text-4xl mb-2">📭</div>
            <div className="text-sm">暂无竞拍</div>
          </div>
        )}
        {list.map((a, idx) => (
          <Link
            key={a.id}
            to={`/auction/${a.id}`}
            className="block bg-white rounded-2xl overflow-hidden fade-up active:opacity-70 transition-opacity"
            style={{ animationDelay: `${idx * 35}ms` }}
          >
            <div className="flex">
              {a.image_url ? (
                <img
                  src={a.image_url}
                  alt={a.title}
                  className="w-24 h-24 object-cover bg-[#F2F2F7]"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <div className="w-24 h-24 flex items-center justify-center text-3xl bg-[#F2F2F7]">
                  📦
                </div>
              )}
              <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold leading-snug text-[#000] truncate">{a.title}</h2>
                  <StatusBadge status={a.status} />
                </div>
                <div>
                  <p className="text-[11px] text-[#8E8E93]">当前价</p>
                  <p className="text-xl font-bold text-[#FF9500]">¥{a.current_price}</p>
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
