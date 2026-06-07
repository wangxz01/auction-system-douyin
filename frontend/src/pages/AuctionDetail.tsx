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

  // 记录"我是否在本次会话中出过价"——用于决定是否提示"被超越"
  const hasBidRef = useRef(false)

  // 初始加载竞拍 + 出价历史
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

  // WebSocket
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
      setBanner({ kind: 'info', text: '竞拍已开始！' })
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
      await api.post(`/auctions/${auctionId}/bids`, {
        amount: nextBidAmount,
      })
      hasBidRef.current = true
    } catch (e: unknown) {
      const r = (e as { response?: { data?: { error?: string } } }).response
      alert(r?.data?.error ?? '出价失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (!auction) return <div className="p-8 text-center text-gray-400">加载中...</div>

  // 取消状态
  if (cancelled) {
    return (
      <CenterMessage emoji="🚫" title="该竞拍已取消" linkBack />
    )
  }

  // 结束状态
  if (finished) {
    const isWinner = finished.winner_id === uid
    return (
      <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white max-w-md mx-auto p-6">
        <div className="text-center pt-12 pb-8">
          <div className="text-6xl mb-4">{isWinner ? '🏆' : '🔨'}</div>
          <h1 className="text-2xl font-bold mb-2">竞拍结束</h1>
          <p className="text-gray-500 mb-6">{auction.title}</p>
          <div className="bg-white rounded-lg shadow p-6 inline-block">
            <p className="text-sm text-gray-500">成交价</p>
            <p className="text-4xl font-bold text-red-500 my-2">¥{finished.final_price}</p>
            <p className="text-sm text-gray-500">
              得主：UID {finished.winner_id ?? '无人出价'}
            </p>
          </div>
        </div>
        {isWinner && (
          <div className="space-y-3">
            <div className="text-center text-green-600 font-medium">
              🎉 恭喜你拍得此商品！
            </div>
            <button
              onClick={() => navigate(`/auction/${auctionId}/order`)}
              className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-medium"
            >
              查看订单
            </button>
          </div>
        )}
        <Link
          to="/"
          className="block text-center text-gray-400 text-sm mt-6 hover:text-gray-600"
        >
          ← 返回大厅
        </Link>
      </div>
    )
  }

  // 正常详情
  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto pb-32">
      {/* 顶部 banner */}
      {banner && (
        <div
          className={`p-3 text-center text-sm font-medium ${
            banner.kind === 'success'
              ? 'bg-green-100 text-green-700'
              : banner.kind === 'warn'
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {banner.text}
        </div>
      )}

      {/* WS 状态条 */}
      {wsStatus !== 'open' && (
        <div className="bg-gray-200 text-gray-600 text-xs text-center py-1">
          {wsStatus === 'reconnecting' ? '🔄 正在连接实时通道...' : '⚠️ 实时通道已断开'}
        </div>
      )}

      {/* 商品信息 */}
      <div className="bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-bold">{auction.title}</h1>
            {auction.description && (
              <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                {auction.description}
              </p>
            )}
          </div>
          <StatusBadge status={auction.status} />
        </div>
        {auction.image_url && (
          <img
            src={auction.image_url}
            alt={auction.title}
            className="w-full mt-3 rounded max-h-60 object-cover"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        )}
      </div>

      {/* 当前价 / 倒计时 / 出价人数 */}
      <div className="bg-white mt-2 p-6 text-center">
        <p className="text-sm text-gray-500">当前最高价</p>
        <p
          className={`text-5xl font-bold text-red-500 my-2 inline-block rounded ${
            priceFlash ? 'flash' : ''
          }`}
        >
          ¥{auction.current_price}
        </p>
        <div className="flex justify-around mt-4 text-sm">
          <div>
            <div className="text-gray-400">⏱ 倒计时</div>
            <Countdown endsAt={auction.ends_at} stopped={auction.status !== 'active'} />
          </div>
          <div>
            <div className="text-gray-400">👥 出价人数</div>
            <div className="font-bold">{bidCount}</div>
          </div>
        </div>
      </div>

      {/* 排行榜 */}
      <div className="bg-white mt-2 p-4">
        <h3 className="font-medium mb-3">🏆 出价排行 Top 5</h3>
        {topBids.length === 0 ? (
          <div className="text-center text-gray-400 py-4 text-sm">还没有人出价</div>
        ) : (
          <ol className="space-y-2">
            {topBids.map((b, i) => (
              <li
                key={`${b.user_id}-${b.amount}-${i}`}
                className={`flex items-center justify-between px-3 py-2 rounded ${
                  i === 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 inline-flex items-center justify-center rounded-full text-xs font-bold ${
                      i === 0
                        ? 'bg-yellow-400 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm">
                    UID {b.user_id}
                    {b.user_id === uid && (
                      <span className="ml-1 text-xs text-blue-500">(你)</span>
                    )}
                  </span>
                </span>
                <span
                  className={`font-bold ${i === 0 ? 'text-red-500' : 'text-gray-700'}`}
                >
                  ¥{b.amount}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* 出价区 */}
      {auction.status === 'active' && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
            <span>
              最低出价 = ¥{auction.current_price} + ¥{auction.price_step}
            </span>
            {auction.ceiling_price && (
              <span>封顶 ¥{auction.ceiling_price}</span>
            )}
          </div>
          <button
            onClick={handleBid}
            disabled={submitting}
            className="w-full bg-gradient-to-r from-red-500 to-pink-500 disabled:from-red-300 disabled:to-pink-300 text-white py-3 rounded-lg font-bold text-lg"
          >
            {submitting
              ? '出价中...'
              : isLoggedIn()
              ? `立即出价 ¥${nextBidAmount}`
              : `登录后出价 ¥${nextBidAmount}`}
          </button>
        </div>
      )}
      {auction.status === 'pending' && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-gray-100 text-gray-500 text-center p-4 text-sm">
          竞拍尚未开始
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
      <div className="text-6xl mb-4">{emoji}</div>
      <h1 className="text-2xl font-bold mb-6">{title}</h1>
      {linkBack && (
        <Link to="/" className="text-gray-400 text-sm hover:text-gray-600">
          ← 返回大厅
        </Link>
      )}
    </div>
  )
}
