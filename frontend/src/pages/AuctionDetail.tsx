import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { getUser, isLoggedIn } from '../lib/auth'
import { AuctionWS } from '../lib/ws'
import type { Auction, Bid, TopBid, WSMessage } from '../lib/types'

// 占位视频（横屏 mp4，object-fit:cover 后竖屏铺满）。
// 后续替换为真实商品展示视频即可。
const PLACEHOLDER_VIDEO =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'

type Toast = { kind: 'win' | 'lose' | 'info'; text: string; id: number } | null
type FinishedInfo = { final_price: number; winner_id: number | null } | null

// 假评论池 —— 让直播间感觉有人在
const FAKE_COMMENTS = [
  '666',
  '主播看看这个',
  '我先收藏了',
  '价格还能再降吗',
  '冲！',
  '蹲一个',
  '👏👏👏',
  '太便宜了吧',
  '上车',
  '老粉了',
]

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
  const [priceFlashKey, setPriceFlashKey] = useState(0)
  const [toast, setToast] = useState<Toast>(null)
  const [finished, setFinished] = useState<FinishedInfo>(null)
  const [cancelled, setCancelled] = useState(false)
  const [secLeft, setSecLeft] = useState(0)
  const [comments, setComments] = useState<string[]>([])

  const hasBidRef = useRef(false)
  const toastIdRef = useRef(0)

  // 初始拉数据
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
    const ws = new AuctionWS(auctionId, (msg: WSMessage) => handleMessage(msg))
    ws.connect()
    return () => ws.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId])

  // 倒计时
  useEffect(() => {
    if (!auction?.ends_at || auction.status !== 'active') {
      setSecLeft(0)
      return
    }
    const tick = () => {
      const remain = Math.max(
        0,
        Math.floor((new Date(auction.ends_at!).getTime() - Date.now()) / 1000),
      )
      setSecLeft(remain)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [auction?.ends_at, auction?.status])

  // toast 自动消失
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  // 弹幕轮播（每 2.5s 加一条）
  useEffect(() => {
    if (auction?.status !== 'active') return
    const t = setInterval(() => {
      const c = FAKE_COMMENTS[Math.floor(Math.random() * FAKE_COMMENTS.length)]
      setComments((prev) => [...prev.slice(-3), `游客${Math.floor(Math.random() * 9000 + 1000)}: ${c}`])
    }, 2500)
    return () => clearInterval(t)
  }, [auction?.status])

  const handleMessage = (msg: WSMessage) => {
    if (msg.type === 'auction_started') {
      setAuction((p) => (p ? { ...p, status: 'active', ends_at: msg.ends_at } : p))
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
      setPriceFlashKey((k) => k + 1)

      if (msg.winner_id === uid) {
        pushToast('win', '✨ 你正在领先')
      } else if (hasBidRef.current) {
        pushToast('lose', '⚠️ 你被超越了')
      }
    } else if (msg.type === 'auction_finished') {
      setFinished({ final_price: msg.final_price, winner_id: msg.winner_id })
      setAuction((p) => (p ? { ...p, status: 'finished' } : p))
    } else if (msg.type === 'auction_cancelled') {
      setCancelled(true)
      setAuction((p) => (p ? { ...p, status: 'cancelled' } : p))
    }
  }

  const pushToast = (kind: NonNullable<Toast>['kind'], text: string) => {
    toastIdRef.current += 1
    setToast({ kind, text, id: toastIdRef.current })
  }

  const nextBidAmount = useMemo(
    () => (auction ? auction.current_price + auction.price_step : 0),
    [auction],
  )

  // 假在线人数（确定性，基于 auctionId）
  const viewers = useMemo(() => ((auctionId * 137) % 800) + 120 + bidCount * 3, [auctionId, bidCount])

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
      <div className="live-room flex items-center justify-center">
        <div className="text-white/70 text-sm">直播间加载中...</div>
      </div>
    )
  }

  return (
    <div className="live-room">
      {/* 视频底层 */}
      <video
        src={PLACEHOLDER_VIDEO}
        className="live-video"
        autoPlay
        loop
        muted
        playsInline
        poster={`https://picsum.photos/seed/${auctionId}/720/1280`}
      />

      {/* 渐变遮罩 */}
      <div className="live-overlay-top" />
      <div className="live-overlay-bottom" />

      {/* 顶部：主播 + 关注 */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-2">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ring-2 ring-white/30"
          style={{ background: 'linear-gradient(135deg, #FE2C55, #FF6B85)' }}
        >
          {auction.title.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-white text-sm font-semibold truncate" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
              {auction.title}的直播间
            </span>
            <span className="px-1.5 py-0.5 bg-[#FE2C55] text-[9px] rounded font-bold text-white tracking-wider">
              LIVE
            </span>
          </div>
          <div className="text-white/85 text-[11px] mt-0.5 flex items-center gap-2" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
            <span>👥 {viewers} 人在看</span>
          </div>
        </div>
        <button className="px-3.5 py-1.5 bg-[#FE2C55] text-white text-xs font-semibold rounded-full shadow-lg shrink-0">
          + 关注
        </button>
      </div>

      {/* 倒计时 */}
      {auction.status === 'active' && secLeft > 0 && (
        <div className="absolute top-[60px] left-3 z-10">
          <span className={`countdown-pill ${secLeft < 10 ? 'urgent' : ''}`}>
            <span className="dot" />
            <span>距结束 {fmtTime(secLeft)}</span>
          </span>
        </div>
      )}

      {/* 排行榜 */}
      {topBids.length > 0 && (
        <div className="absolute right-3 top-[120px] z-10 w-36 live-glass p-2.5">
          <div className="text-[11px] text-white/75 mb-1.5 px-1 flex items-center gap-1 font-medium">
            <span>🏆</span>
            <span>出价榜</span>
          </div>
          <div className="space-y-1.5">
            {topBids.slice(0, 5).map((b, i) => (
              <div
                key={`${b.user_id}-${b.amount}-${i}`}
                className="flex items-center gap-1.5 text-xs"
              >
                <span
                  className={`w-4 h-4 inline-flex items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${
                    i === 0
                      ? 'bg-gradient-to-br from-[#FFE76A] to-[#FFB627] text-black shadow'
                      : 'bg-white/20 text-white'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="truncate flex-1 text-white/90">
                  UID {b.user_id}
                  {b.user_id === uid && <span className="text-[#FFD451] ml-0.5">·你</span>}
                </span>
                <span className={`font-bold ${i === 0 ? 'text-[#FFD451]' : 'text-white'}`}>
                  ¥{b.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 弹幕（左下，商品卡上方） */}
      <div className="absolute bottom-[170px] left-3 right-32 z-10 pointer-events-none flex flex-col items-start">
        {comments.slice(-3).map((c, i) => (
          <div key={`${c}-${i}`} className="comment-bubble fade-up">
            {c}
          </div>
        ))}
      </div>

      {/* 商品信息卡 */}
      <div className="absolute left-3 right-3 bottom-[76px] z-10">
        <div className="live-glass p-3.5">
          <div className="text-white text-sm font-semibold mb-1 truncate" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
            {auction.title}
          </div>
          {auction.description && (
            <div className="text-white/75 text-xs mb-2 line-clamp-2">
              {auction.description}
            </div>
          )}
          <div className="flex items-baseline justify-between mt-1">
            <div>
              <div className="text-white/70 text-[10px] tracking-wide">当前最高价</div>
              <div
                key={priceFlashKey}
                className="text-3xl font-bold text-[#FFD451] price-pop"
                style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
              >
                ¥{auction.current_price}
              </div>
            </div>
            <div className="text-right text-[11px] text-white/75">
              <div>{bidCount} 次出价</div>
              {auction.ceiling_price && (
                <div className="text-[#FFD451]">封顶 ¥{auction.ceiling_price}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 底部出价栏 */}
      {auction.status === 'active' && (
        <div className="absolute left-0 right-0 bottom-0 z-10 px-3 pt-2 flex items-center gap-2" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
          <div className="flex-1 h-9 bg-white/15 backdrop-blur rounded-full px-4 text-white/60 text-xs flex items-center" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
            说点什么...
          </div>
          <button
            onClick={handleBid}
            disabled={submitting}
            className="btn-douyin h-9 px-4 rounded-full text-sm whitespace-nowrap"
          >
            {submitting
              ? '出价中...'
              : isLoggedIn()
              ? `出价 ¥${nextBidAmount}`
              : `登录出价`}
          </button>
        </div>
      )}
      {auction.status === 'pending' && !finished && !cancelled && (
        <div className="absolute left-0 right-0 bottom-0 z-10 px-3 pb-5 pt-2 text-center text-white/80 text-sm bg-black/40 backdrop-blur">
          竞拍尚未开始，敬请期待
        </div>
      )}

      {/* 中央 Toast */}
      {toast && (
        <div key={toast.id} className="center-toast">
          <div
            className="px-7 py-4 rounded-2xl text-lg font-bold shadow-2xl text-white whitespace-nowrap"
            style={{
              background:
                toast.kind === 'win'
                  ? 'linear-gradient(135deg, #34C759, #28A745)'
                  : toast.kind === 'lose'
                  ? 'linear-gradient(135deg, #FE2C55, #FF6B85)'
                  : 'linear-gradient(135deg, #5AC8FA, #007AFF)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            }}
          >
            {toast.text}
          </div>
        </div>
      )}

      {/* 结束盖层 */}
      {finished && (
        <FullScreenEnd
          emoji={finished.winner_id === uid ? '🏆' : '🔨'}
          title="竞拍结束"
          subtitle={auction.title}
        >
          <div className="text-sm text-white/70 mb-1">成交价</div>
          <div className="text-5xl font-bold text-[#FFD451] mb-4">¥{finished.final_price}</div>
          <div className="text-sm text-white/70 mb-6">
            得主：UID {finished.winner_id ?? '无人出价'}
            {finished.winner_id === uid && (
              <span className="text-[#FFD451] ml-1 font-semibold">(你)</span>
            )}
          </div>
          {finished.winner_id === uid && (
            <button
              onClick={() => navigate(`/auction/${auctionId}/order`)}
              className="btn-douyin px-8 py-3 rounded-full font-bold text-base"
            >
              查看订单
            </button>
          )}
          <Link to="/" className="mt-6 text-white/70 text-sm">
            返回大厅
          </Link>
        </FullScreenEnd>
      )}

      {/* 取消盖层 */}
      {cancelled && !finished && (
        <FullScreenEnd emoji="🚫" title="该竞拍已取消" subtitle={auction.title}>
          <Link to="/" className="mt-6 text-white/70 text-sm">
            返回大厅
          </Link>
        </FullScreenEnd>
      )}
    </div>
  )
}

function FullScreenEnd({
  emoji,
  title,
  subtitle,
  children,
}: {
  emoji: string
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center p-8 text-center"
      style={{
        background:
          'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(20,20,30,0.92) 100%)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="text-7xl mb-3">{emoji}</div>
      <div className="text-2xl font-bold text-white mb-1">{title}</div>
      {subtitle && <div className="text-sm text-white/60 mb-6">{subtitle}</div>}
      {children}
    </div>
  )
}

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
