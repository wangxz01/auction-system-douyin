import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Hls from 'hls.js'
import { api } from '../api/client'
import { getUser, isLoggedIn } from '../lib/auth'
import { AuctionWS } from '../lib/ws'
import type { Auction, AuctionComment, Bid, TopBid, WSMessage } from '../lib/types'

// 兜底本地视频（放在 public/ 下，可被 / 直接访问）
const FALLBACK_VIDEO = '/live.mp4'

type Toast = { kind: 'win' | 'lose' | 'info'; text: string; id: number } | null
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
  const [priceFlashKey, setPriceFlashKey] = useState(0)
  const [toast, setToast] = useState<Toast>(null)
  const [finished, setFinished] = useState<FinishedInfo>(null)
  const [cancelled, setCancelled] = useState(false)
  const [secLeft, setSecLeft] = useState(0)
  const [comments, setComments] = useState<AuctionComment[]>([])

  const hasBidRef = useRef(false)
  const toastIdRef = useRef(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const backdropRef = useRef<HTMLVideoElement>(null)
  const [videoLoading, setVideoLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)
  // 'cover' = 充满（竖屏/方形适用）；'contain' = 保留完整画面（横屏适用）
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover')

  // 出价金额：默认 = 当前价 + 1×加价幅度；用户可点快捷倍数或自定义改写
  const [bidAmount, setBidAmount] = useState(0)
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [customInput, setCustomInput] = useState('')

  // 评论输入
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [commentInput, setCommentInput] = useState('')

  // 视频源加载策略：HLS → 原生 HLS → 兜底本地
  useEffect(() => {
    if (!auction) return
    const video = videoRef.current
    if (!video) return

    setVideoLoading(true)
    setUsingFallback(false)
    setFitMode('cover') // 默认满屏，加载完元数据后根据宽高再决定
    let hls: Hls | null = null
    let cancelled = false

    const playFallback = () => {
      if (cancelled) return
      setUsingFallback(true)
      video.src = FALLBACK_VIDEO
      video.load()
      void video.play().catch(() => {})
    }

    const onPlaying = () => setVideoLoading(false)
    video.addEventListener('playing', onPlaying)

    const url = auction.stream_url?.trim() || ''
    if (!url) {
      playFallback()
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari / iOS 原生 HLS
      video.src = url
      const onErr = () => playFallback()
      video.addEventListener('error', onErr, { once: true })
      void video.play().catch(() => {})
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true })
      hls.loadSource(url)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (cancelled) return
        void video.play().catch(() => {})
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          hls?.destroy()
          hls = null
          playFallback()
        }
      })
    } else {
      // 浏览器既不支持 hls.js 也不支持原生 HLS
      playFallback()
    }

    return () => {
      cancelled = true
      video.removeEventListener('playing', onPlaying)
      if (hls) hls.destroy()
    }
  }, [auction?.stream_url, auction])

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
    api.get<{ data: AuctionComment[] }>(`/auctions/${auctionId}/comments`).then((r) => {
      setComments(r.data.data)
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
    } else if (msg.type === 'new_comment') {
      setComments((prev) => [...prev.slice(-49), msg.comment])
    } else if (msg.type === 'auction_cancelled') {
      setCancelled(true)
      setAuction((p) => (p ? { ...p, status: 'cancelled' } : p))
    }
  }

  const pushToast = (kind: NonNullable<Toast>['kind'], text: string) => {
    toastIdRef.current += 1
    setToast({ kind, text, id: toastIdRef.current })
  }

  // 最小出价 = 当前价 + 1×加价幅度
  const minBid = useMemo(
    () => (auction ? auction.current_price + auction.price_step : 0),
    [auction?.current_price, auction?.price_step], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // 当前价 / 加价幅度变动 → 出价金额若过低（被超越或首次加载）自动重置为最小出价
  useEffect(() => {
    if (!auction) return
    if (bidAmount < minBid) setBidAmount(minBid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minBid])

  // 是否命中某个快捷倍数（用于高亮）
  const matchedMultiplier = useMemo(() => {
    if (!auction) return 0
    const delta = bidAmount - auction.current_price
    if (delta <= 0) return 0
    const m = delta / auction.price_step
    if (Math.abs(m - Math.round(m)) > 0.001) return 0
    return Math.round(m)
  }, [bidAmount, auction?.current_price, auction?.price_step]) // eslint-disable-line

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
      await api.post(`/auctions/${auctionId}/bids`, { amount: bidAmount })
      hasBidRef.current = true
    } catch (e: unknown) {
      const r = (e as { response?: { data?: { error?: string } } }).response
      alert(r?.data?.error ?? '出价失败')
    } finally {
      setSubmitting(false)
    }
  }

  const sendComment = async () => {
    const text = commentInput.trim()
    if (!text) {
      setShowCommentModal(false)
      return
    }
    if (!isLoggedIn()) {
      const from = encodeURIComponent(`/auction/${auctionId}`)
      navigate(`/login?from=${from}`)
      return
    }
    try {
      await api.post(`/auctions/${auctionId}/comments`, { content: text })
      setCommentInput('')
      setShowCommentModal(false)
    } catch (e: unknown) {
      const r = (e as { response?: { data?: { error?: string } } }).response
      alert(r?.data?.error ?? '评论发送失败')
    }
  }

  const confirmCustom = () => {
    const v = Number(customInput)
    if (!isFinite(v) || v < minBid) {
      alert(`金额无效，最低出价 ¥${minBid}`)
      return
    }
    if (auction) {
      const delta = v - auction.current_price
      if (Math.abs(delta / auction.price_step - Math.round(delta / auction.price_step)) > 0.001) {
        alert(`金额必须为 ¥${auction.price_step} 的整数倍`)
        return
      }
    }
    setBidAmount(v)
    setShowCustomModal(false)
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
      {/* 背景层：仅在 contain 模式（横屏视频）时显示，避免单调黑边 */}
      {fitMode === 'contain' && (
        <video
          ref={backdropRef}
          className="live-video-backdrop"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
          src={videoRef.current?.currentSrc || undefined}
        />
      )}

      {/* 视频底层（src 由 useEffect 根据 stream_url 设置） */}
      <video
        ref={videoRef}
        className={`live-video fit-${fitMode}`}
        autoPlay
        loop
        muted
        playsInline
        poster={`https://picsum.photos/seed/${auctionId}/720/1280`}
        onLoadedMetadata={() => {
          const v = videoRef.current
          if (!v || !v.videoWidth || !v.videoHeight) return
          const ratio = v.videoWidth / v.videoHeight
          // 横屏（宽高比 ≥ 1.1）→ contain 保留全画面 + 模糊背景
          // 竖屏/方形 → cover 充满
          setFitMode(ratio >= 1.1 ? 'contain' : 'cover')
        }}
      />

      {/* 加载提示 */}
      {videoLoading && (
        <div className="absolute inset-0 z-[2] flex items-center justify-center pointer-events-none">
          <div className="bg-black/60 rounded-full px-4 py-2 text-white/90 text-xs backdrop-blur">
            正在加载直播流...
          </div>
        </div>
      )}

      {/* 兜底视频提示（仅当原始 stream_url 加载失败时显示一次） */}
      {usingFallback && auction.stream_url && !videoLoading && (
        <div className="absolute top-2 right-2 z-[5]">
          <div className="bg-black/55 text-white/80 text-[10px] rounded-full px-2 py-0.5 backdrop-blur">
            演示视频
          </div>
        </div>
      )}

      {/* 渐变遮罩 */}
      <div className="live-overlay-top" />
      <div className="live-overlay-bottom" />

      {/* 顶部：主播 + 关注 —— 玻璃胶囊统一框 */}
      <div
        className="absolute left-3 right-3 z-10"
        style={{ top: 'var(--safe-top)' }}
      >
        <div className="live-glass-pill flex items-center gap-2 pl-1 pr-3 py-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #FE2C55, #FF6B85)' }}
          >
            {auction.title.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-white text-[13px] font-semibold truncate">
                {auction.title}的直播间
              </span>
              <span className="px-1 py-px bg-[#FE2C55] text-[9px] rounded font-bold text-white tracking-wider">
                LIVE
              </span>
            </div>
            <div className="text-white/75 text-[10px] mt-px">👥 {viewers} 人在看</div>
          </div>
          <button className="live-text-btn white text-sm shrink-0" style={{ padding: '2px 8px' }}>
            + 关注
          </button>
        </div>
      </div>

      {/* 倒计时 */}
      {auction.status === 'active' && secLeft > 0 && (
        <div
          className="absolute left-3 z-10"
          style={{ top: 'calc(var(--safe-top) + 52px)' }}
        >
          <span className={`countdown-pill ${secLeft < 10 ? 'urgent' : ''}`}>
            <span className="dot" />
            <span>距结束 {fmtTime(secLeft)}</span>
          </span>
        </div>
      )}

      {/* 排行榜 */}
      {topBids.length > 0 && (
        <div
          className="absolute right-3 z-10 w-36 live-glass p-2.5"
          style={{ top: 'calc(var(--safe-top) + 108px)' }}
        >
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
        {comments.slice(-3).map((c) => (
          <div key={c.id} className="comment-bubble fade-up">
            {c.username}: {c.content}
          </div>
        ))}
      </div>

      {/* 商品信息卡（位于底部统一容器上方） */}
      <div className="absolute left-3 right-3 z-10" style={{ bottom: 'calc(140px + env(safe-area-inset-bottom))' }}>
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

      {/* 底部统一玻璃容器：倍数 chips + 评论占位 + 出价按钮 */}
      {auction.status === 'active' && (
        <div
          className="absolute left-2 right-2 bottom-2 z-10 live-glass px-3 pt-2"
          style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
        >
          {/* 加价倍数 */}
          <div className="flex items-center gap-5 text-sm whitespace-nowrap overflow-x-auto pb-2">
            {[1, 2, 5, 10].map((m) => {
              const selected = matchedMultiplier === m
              return (
                <button
                  key={m}
                  onClick={() => setBidAmount(auction.current_price + m * auction.price_step)}
                  className={`live-text-btn ${selected ? 'gold' : 'muted'}`}
                >
                  +¥{(m * auction.price_step).toLocaleString()}
                </button>
              )
            })}
            <button
              onClick={() => {
                setCustomInput(String(minBid))
                setShowCustomModal(true)
              }}
              className={`live-text-btn ${
                matchedMultiplier === 0 || ![1, 2, 5, 10].includes(matchedMultiplier)
                  ? 'gold'
                  : 'white'
              }`}
            >
              自定义
            </button>
          </div>

          {/* 分隔线 */}
          <div className="h-px bg-white/12 -mx-3" />

          {/* 评论 + 出价 */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => setShowCommentModal(true)}
              className="flex-1 text-left text-white/55 text-sm truncate active:opacity-60 transition-opacity"
            >
              说点什么...
            </button>
            <button
              onClick={handleBid}
              disabled={submitting}
              className="live-text-btn gold text-base"
            >
              {submitting
                ? '出价中...'
                : isLoggedIn()
                ? `出价 ¥${bidAmount.toLocaleString()}`
                : `登录出价`}
            </button>
          </div>
        </div>
      )}
      {auction.status === 'pending' && !finished && !cancelled && (
        <div
          className="absolute left-2 right-2 bottom-2 z-10 live-glass px-4 py-4 text-center text-white/80 text-sm"
          style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        >
          竞拍尚未开始，敬请期待
        </div>
      )}

      {/* 评论 bottom sheet */}
      {showCommentModal && (
        <div
          className="absolute inset-0 z-40 bg-black/55 flex items-end"
          onClick={() => setShowCommentModal(false)}
        >
          <div
            className="w-full px-3"
            style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', paddingTop: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="live-glass flex items-center gap-2 px-3 py-2">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void sendComment()
                  if (e.key === 'Escape') setShowCommentModal(false)
                }}
                placeholder="参与互动"
                maxLength={50}
                autoFocus
                className="flex-1 bg-transparent text-white text-base outline-none placeholder:text-white/40"
              />
              <button
                onClick={() => void sendComment()}
                className="live-text-btn gold text-base"
              >
                发送
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 自定义金额 bottom sheet */}
      {showCustomModal && auction && (
        <div
          className="absolute inset-0 z-40 bg-black/60 flex items-end backdrop-blur-sm"
          onClick={() => setShowCustomModal(false)}
        >
          <div
            className="w-full p-6 rounded-t-3xl"
            style={{
              background: 'rgba(28, 28, 30, 0.95)',
              paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-white text-base font-semibold mb-1">自定义出价</div>
            <div className="text-white/55 text-xs mb-4">
              最低 ¥{minBid.toLocaleString()}，必须为 ¥{auction.price_step} 的整数倍
            </div>
            <input
              type="number"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder={String(minBid)}
              autoFocus
              step={auction.price_step}
              min={minBid}
              className="w-full bg-white/10 text-white text-2xl font-bold px-4 py-3 rounded-xl mb-5 outline-none"
              style={{ border: '1px solid rgba(255,255,255,0.15)' }}
            />
            <div className="flex items-center justify-around">
              <button
                onClick={() => setShowCustomModal(false)}
                className="live-text-btn muted text-base"
              >
                取消
              </button>
              <button onClick={confirmCustom} className="live-text-btn gold text-base">
                确认
              </button>
            </div>
          </div>
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
