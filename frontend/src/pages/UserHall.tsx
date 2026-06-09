import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Auction, AuctionStatus } from '../lib/types'
import { BottomNav } from '../components/BottomNav'
import { lotNumberOf } from '../lib/paddle'

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
      {/* 拍卖行 hero（衬线大标题 + 帷幕色） */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="hall-hero-title">拍卖行</h1>
        <p className="hall-hero-sub">Lots · Live Bidding</p>
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

      {/* 计数（场刊感） */}
      <div
        className="mt-6 mb-3 px-5 flex items-baseline justify-between font-catalog"
        style={{ color: 'var(--hall-ink-mute)' }}
      >
        <span
          className="text-[11px] tracking-[0.18em] uppercase"
          style={{ color: 'var(--hall-velvet)' }}
        >
          {filter === 'all' ? 'All Lots' : filter === 'active' ? 'Live' : 'Upcoming'}
        </span>
        {!loading && <span className="text-xs tabular-nums">{list.length} 件</span>}
      </div>

      {/* 拍品卡列表 */}
      <div className="px-4 space-y-4">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="lot-card"
              style={{ pointerEvents: 'none', animationDelay: `${i * 40}ms` }}
            >
              <div className="lot-card-media skeleton" />
              <div className="lot-card-body">
                <div className="skeleton" style={{ height: 18, width: '60%' }} />
                <div className="lot-card-rule" />
                <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 12, width: '30%' }} />
              </div>
            </div>
          ))}
        {!loading && list.length === 0 && (
          <div
            className="rounded text-center py-12 text-sm font-catalog"
            style={{
              background: 'var(--hall-ivory-soft)',
              border: '1px solid var(--hall-ivory-rim)',
              color: 'var(--hall-ink-mute)',
            }}
          >
            本场暂无拍品
          </div>
        )}
        {list.map((a, idx) => (
          <Link
            key={a.id}
            to={`/auction/${a.id}`}
            className="lot-card fade-up"
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <div className="lot-card-media">
              {a.image_url ? (
                <img
                  src={a.image_url}
                  alt={a.title}
                  loading="lazy"
                  decoding="async"
                  width={800}
                  height={600}
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : null}
              <span className="lot-stamp">{lotNumberOf(a.id)}</span>
              {a.status === 'active' && (
                <span className="lot-live">
                  <span className="pulse" />
                  Live
                </span>
              )}
            </div>

            <div className="lot-card-body">
              <div className="lot-card-title">{a.title}</div>
              <div className="lot-card-rule" />
              <div className="lot-card-row">
                <span className="label">{a.status === 'active' ? '当前价' : '起拍价'}</span>
                <span className="value current">
                  ¥{Number(a.current_price || a.start_price).toLocaleString()}
                </span>
              </div>
              <div className="lot-card-row mt-1">
                <span className="label">加价</span>
                <span className="value">¥{a.price_step}</span>
              </div>
              {a.ceiling_price && (
                <div className="lot-card-row mt-1">
                  <span className="label">封顶</span>
                  <span className="value">¥{Number(a.ceiling_price).toLocaleString()}</span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      <BottomNav />
    </div>
  )
}
