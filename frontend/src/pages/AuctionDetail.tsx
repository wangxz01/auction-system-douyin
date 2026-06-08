import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { getUser, isLoggedIn } from '../lib/auth'
import { AuctionWS } from '../lib/ws'
import type { Auction, Bid, TopBid, WSMessage } from '../lib/types'
import { Countdown } from '../components/Countdown'
import { StatusBadge } from '../components/StatusBadge'

type Banner = { kind: 'success' | 'warn' | 'info'; text: string } | null
type FinishedInfo = { final_price: number; winner_id: number | null } | null

export function AuctionDetail() {
  const { id } = useParams<{ id: string }>()
  const auctionId = Number(id)
  const navigate = useNavigate()
  const me = getUser()
  const uid = me?.user_id ?? 0

  const [auction, setAuction] = useState<Auction | null>(null)
  const [topBids, setTopBids] = useState<TopBid[]>([])
  const [bidCount, setBidCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState<Banner>(null)
  const [priceFlash, setPriceFlash] = useState(false)
  const [finished, setFinished] = useState<FinishedInfo>(null)
  const [cancelled, setCancelled] = useState(false)
  const [wsStatus, setWsStatus] = useState<'open' | 'closed' | 'reconnecting'>('reconnecting')

  const hasBidRef = useRef(false)

  useEffect(() => {
    api.get<{ data: Auction }>(`/auctions/${auctionId}`).then((r) => {
      setAuction(r.data.data)
      if (r.data.data.status === 'finished') {
        setFinished({
          final_price: r.data.data.current_price,
          winner_id: r.data.data.winner_id,
        })
      } else if (r.data.data.status === 'cancelled') {
        setCancelled(true)
      }
    })
    api.get<{ data: Bid[] }>(`/auctions/${auctionId}/bids`).then((r) => {
      const arr = r.data.data
      setBidCount(arr.length)
      setTopBids(arr.slice(0, 5).map((b) => ({ user_id: b.user_id, amount: b.amount })))
      if (arr.some((b) => b.user_id === uid)) hasBidRef.current = true
    })
  }, [auctionId, uid])

  useEffect(() => {
    if (!auctionId) return
    const ws = new AuctionWS(
      auctionId,
      (msg: WSMessage) => handleMessage(msg),
      (s) => setWsStatus(s),
    )
    ws.connect()
    return () => ws.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId])

  const handleMessage = (msg: WSMessage) => {
    if (msg.type === 'auction_started') {
      setAuction((p) => (p ? { ...p, status: 'active', ends_at: msg.ends_at } : p))
      setBanner({ kind: 'info', text: '🚀 竞拍已开始！' })
    } else if (msg.type === 'new_bid') {
      setAuction((p) =>
        p
          ? {
              ...p,
              current_price: msg.current_price,
              winner_id: msg.winner_id,
              ends_at: msg.ends_at,
            }
          : p,
      )
      setTopBids(msg.top_bids.slice(0, 5))
      setBidCount((c) => c + 1)
      setPriceFlash(true)
      setTimeout(() => setPriceFlash(false), 600)

      if (msg.winner_id === uid) {
        setBanner({ kind: 'success', text: '✨ 你正在领先！' })
      } else if (hasBidRef.current) {
        setBanner({ kind: 'warn', text: '⚠️ 你被超越了！' })
      }
    } else if (msg.type === 'auction_finished') {
      setFinished({ final_price: msg.final_price, winner_id: msg.winner_id })
      setAuction((p) => (p ? { ...p, status: 'finished' } : p))
    } else if (msg.type === 'auction_cancelled') {
      setCancelled(true)
      setAuction((p) => (p ? { ...p, status: 'cancelled' } : p))
    }
  }

  const nextBidAmount = useMemo(
    () => (auction ? auction.current_price + auction.price_step : 0),
    [auction],
  )

  const handleBid = async () => {
    if (!auction) return
    if (!isLoggedIn()) {
      const from = encodeURIComponent(`/auction/${auctionId}`)
      navigate(`/login?from=${from}`)
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/auctions/${auctionId}/bids`, { amount: nextBidAmount })
      hasBidRef.current = true
    } catch (e: unknown) {
      const r = (e as { response?: { data?: { error?: string } } }).response
      alert(r?.data?.error ?? '出价失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (!auction) {
    return (
      <div className="min-h-screen max-w-md mx-auto p-4">
        <div className="card p-12 text-center text-ink-400 mt-12">加载中...</div>
      </div>
    )
  }

  if (cancelled) {
    return <CenterMessage emoji="🚫" title="该竞拍已取消" linkBack />
  }

  if (finished) {
    const isWinner = finished.winner_id === uid
    return (
      <div className="min-h-screen max-w-md mx-auto px-4 py-6">
        <div className="text-center pt-10 pb-6">
          <div className="text-7xl mb-3">{isWinner ? '🏆' : '🔨'}</div>
          <h1 className="ios-large-title text-2xl mb-1">竞拍结束</h1>
          <p className="text-[#8E8E93] text-sm">{auction.title}</p>
        </div>
        <div className="bg-white rounded-2xl p-7 text-center mb-4">
          <p className="text-xs text-[#8E8E93] mb-1">成交价</p>
          <p className="text-5xl font-bold text-[#FF9500] my-2">¥{finished.final_price}</p>
          <p className="text-xs text-[#8E8E93] mt-2">
            得主：UID {finished.winner_id ?? '无人出价'}
            {isWinner && <span className="ml-1 text-[#FF9500] font-medium">(你)</span>}
          </p>
        </div>
        {isWinner && (
          <>
            <div className="text-center text-[#FF9500] font-medium mb-3">
              🎉 恭喜你拍得此商品！
            </div>
            <button
              onClick={() => navigate(`/auction/${auctionId}/order`)}
              className="btn-accent w-full py-3.5 rounded-2xl text-base"
            >
              查看订单
            </button>
          </>
        )}
        <Link to="/" className="block text-center text-[#FF9500] text-sm mt-6">
          返回大厅
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen max-w-md mx-auto pb-32">
      {/* 顶部 banner */}
      {banner && (
        <div className="px-4 mt-3">
          <div
            className={`rounded-xl px-4 py-2.5 text-center text-sm font-medium ${
              banner.kind === 'success'
                ? 'bg-[#34C75933] text-[#1F7A2B]'
                : banner.kind === 'warn'
                ? 'bg-[#FF950033] text-[#9B5C00]'
                : 'bg-[#5AC8FA33] text-[#0E5E80]'
            }`}
          >
            {banner.text}
          </div>
        </div>
      )}

      {/* WS 状态条 */}
      {wsStatus !== 'open' && (
        <div className="text-center text-xs text-[#8E8E93] py-1.5 mt-2">
          {wsStatus === 'reconnecting' ? '🔄 正在连接实时通道...' : '⚠️ 实时通道已断开'}
        </div>
      )}

      {/* 商品图（顶部全宽） */}
      {auction.image_url && (
        <img
          src={auction.image_url}
          alt={auction.title}
          className="w-full mt-3 h-48 object-cover bg-[#F2F2F7]"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      )}

      {/* 商品标题 */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h1 className="ios-large-title text-2xl">{auction.title}</h1>
          <StatusBadge status={auction.status} />
        </div>
        {auction.description && (
          <p className="text-sm text-[#8E8E93] leading-relaxed mt-1">{auction.description}</p>
        )}
      </div>

      {/* 当前价 - 大字突出 */}
      <div className="px-4 mt-2">
        <div className="bg-white rounded-2xl px-5 py-6 text-center">
          <p className="text-xs text-[#8E8E93] font-medium tracking-wide">当前最高价</p>
          <p
            className={`text-5xl font-bold text-[#FF9500] my-2 inline-block px-3 ${
              priceFlash ? 'flash' : ''
            }`}
          >
            ¥{auction.current_price}
          </p>
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#F2F2F7]">
            <div>
              <div className="text-[11px] text-[#8E8E93] mb-0.5">倒计时</div>
              <div className="text-base">
                <Countdown endsAt={auction.ends_at} stopped={auction.status !== 'active'} />
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#8E8E93] mb-0.5">出价人数</div>
              <div className="text-base font-bold">{bidCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 排行榜 - iOS list 风格 */}
      <div className="ios-section-header mt-5">
        <span>出价排行</span>
        <span className="text-[#8E8E93]">TOP 5</span>
      </div>
      {topBids.length === 0 ? (
        <div className="ios-list">
          <div className="ios-list-item no-icon text-[#8E8E93] justify-center" style={{ justifyContent: 'center' }}>
            还没有人出价
          </div>
        </div>
      ) : (
        <div className="ios-list">
          {topBids.map((b, i) => (
            <div key={`${b.user_id}-${b.amount}-${i}`} className="ios-list-item">
              <span
                className={`w-7 h-7 inline-flex items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                  i === 0
                    ? 'bg-[#FF9500] text-white'
                    : 'bg-[#F2F2F7] text-[#8E8E93]'
                }`}
              >
                {i + 1}
              </span>
              <span className="flex-1 text-[15px]">
                UID {b.user_id}
                {b.user_id === uid && (
                  <span className="ml-1 text-xs text-[#FF9500] font-medium">(你)</span>
                )}
              </span>
              <span
                className={`font-semibold ${i === 0 ? 'text-[#FF9500] text-lg' : 'text-[#3C3C43]'}`}
              >
                ¥{b.amount}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 出价区（固定底部） */}
      {auction.status === 'active' && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-30">
          <div className="glass px-4 pt-3 pb-5">
            <div className="flex items-center justify-between mb-2 text-[11px] text-[#8E8E93] px-1">
              <span>
                最低出价 = ¥{auction.current_price} + ¥{auction.price_step}
              </span>
              {auction.ceiling_price && (
                <span className="text-[#FF9500] font-medium">封顶 ¥{auction.ceiling_price}</span>
              )}
            </div>
            <button
              onClick={handleBid}
              disabled={submitting}
              className="btn-accent w-full py-3.5 rounded-2xl text-base"
            >
              {submitting
                ? '出价中...'
                : isLoggedIn()
                ? `立即出价 ¥${nextBidAmount}`
                : `登录后出价 ¥${nextBidAmount}`}
            </button>
          </div>
        </div>
      )}
      {auction.status === 'pending' && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-30">
          <div className="glass px-4 py-5 text-center text-[#8E8E93] text-sm">竞拍尚未开始</div>
        </div>
      )}
    </div>
  )
}

function CenterMessage({
  emoji,
  title,
  linkBack,
}: {
  emoji: string
  title: string
  linkBack?: boolean
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center max-w-md mx-auto p-8 text-center">
      <div className="card px-10 py-12">
        <div className="text-7xl mb-4">{emoji}</div>
        <h1 className="text-xl font-bold mb-2">{title}</h1>
      </div>
      {linkBack && (
        <Link to="/" className="mt-6 text-ink-400 text-sm hover:text-ink-700">
          ← 返回大厅
        </Link>
      )}
    </div>
  )
}
