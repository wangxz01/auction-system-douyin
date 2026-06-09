import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Hls from 'hls.js'
import { api } from '../api/client'
import { getUser, isLoggedIn } from '../lib/auth'
import { AuctionWS } from '../lib/ws'
import type { Auction, AuctionComment, AuctionStats, Bid, TopBid, WSMessage } from '../lib/types'
import { lotNumberOf, paddleNumberOf } from '../lib/paddle'
import { trackEvent } from '../lib/events'
import { IconBan, IconGavel, IconTrophy } from '../lib/icons'
import type { ComponentType, SVGProps } from 'react'

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
  const [msLeft, setMsLeft] = useState(0)
  const [comments, setComments] = useState<AuctionComment[]>([])
  const [participantCount, setParticipantCount] = useState(0)
  const [wsStatus, setWsStatus] = useState<'open' | 'closed' | 'reconnecting'>('closed')

  const hasBidRef = useRef(false)
  const toastIdRef = useRef(0)
  const serverOffsetRef = useRef(0)
  const lastBidAtRef = useRef(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoLoading, setVideoLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)
  const [backdropSrc, setBackdropSrc] = useState<string | undefined>(undefined)
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

    const onPlaying = () => {
      setVideoLoading(false)
      setBackdropSrc(video.currentSrc || video.src || FALLBACK_VIDEO)
    }
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

  const loadSnapshot = useCallback(async () => {
    const [auctionResp, bidsResp, statsResp, commentsResp] = await Promise.all([
      api.get<{ data: Auction }>(`/auctions/${auctionId}`),
      api.get<{ data: Bid[] }>(`/auctions/${auctionId}/bids`),
      api.get<{ data: AuctionStats }>(`/auctions/${auctionId}/stats`),
      api.get<{ data: AuctionComment[] }>(`/auctions/${auctionId}/comments`),
    ])

    const freshAuction = auctionResp.data.data
    setAuction(freshAuction)
    setFinished(null)
    setCancelled(false)
    if (freshAuction.status === 'finished') {
      setFinished({
        final_price: freshAuction.current_price,
        winner_id: freshAuction.winner_id,
      })
    } else if (freshAuction.status === 'cancelled') {
      setCancelled(true)
    }

    const bids = bidsResp.data.data
    setBidCount(bids.length)
    setTopBids(
      bids.slice(0, 5).map((b) => ({
        user_id: b.user_id,
        amount: b.amount,
        amount_cents: b.amount_cents ?? Math.round(b.amount * 100),
      })),
    )
    if (bids.some((b) => b.user_id === uid)) hasBidRef.current = true

    const stats = statsResp.data.data
    setBidCount(stats.bid_count)
    setParticipantCount(stats.participant_count)
    setTopBids(stats.top_bids)
    syncServerTime(stats.server_time)
    if (stats.top_bids.some((b) => b.user_id === uid)) hasBidRef.current = true

    setComments(commentsResp.data.data)
  }, [auctionId, uid])

  // 初始拉数据；WebSocket 重连成功后也复用同一个快照补偿逻辑。
  useEffect(() => {
    const timer = window.setTimeout(() => void loadSnapshot(), 0)
    return () => window.clearTimeout(timer)
  }, [loadSnapshot])

  // 行为埋点：进房 / 离房（fire-and-forget，仅登录用户）
  useEffect(() => {
    if (!auctionId) return
    trackEvent(auctionId, 'enter_room', {
      ts: Date.now(),
      ua_screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '',
    })
    const onUnload = () => trackEvent(auctionId, 'leave_room', { ts: Date.now() })
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      // 切换路由时也算离房
      trackEvent(auctionId, 'leave_room', { ts: Date.now(), reason: 'route_change' })
    }
  }, [auctionId])

  // WebSocket
  useEffect(() => {
    if (!auctionId) return
    const ws = new AuctionWS(
      auctionId,
      (msg: WSMessage) => handleMessage(msg),
      (status) => {
        setWsStatus(status)
        if (status === 'open') {
          void loadSnapshot()
        }
      },
    )
    ws.connect()
    return () => ws.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId, loadSnapshot])

  // 倒计时：100ms 刷新，并用后端 server_time 校准本机时钟偏移。
  useEffect(() => {
    if (!auction?.ends_at || auction.status !== 'active') {
      return
    }
    const tick = () => {
      const calibratedNow = Date.now() + serverOffsetRef.current
      const remain = Math.max(0, new Date(auction.ends_at!).getTime() - calibratedNow)
      setMsLeft(remain)
    }
    tick()
    const t = setInterval(tick, 100)
    return () => clearInterval(t)
  }, [auction?.ends_at, auction?.status])

  // toast 自动消失
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  function handleMessage(msg: WSMessage) {
    if (msg.type === 'auction_started') {
      syncServerTime(msg.server_time)
      setAuction((p) => (p ? { ...p, status: 'active', ends_at: msg.ends_at } : p))
    } else if (msg.type === 'new_bid') {
      syncServerTime(msg.server_time)
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
      setParticipantCount(msg.participant_count)
      setPriceFlashKey((k) => k + 1)

      if (msg.winner_id === uid) {
        pushToast('win', `${paddleNumberOf(uid)} 领先`)
        playCue('win')
      } else if (hasBidRef.current) {
        pushToast('lose', `被 ${paddleNumberOf(msg.winner_id)} 超越`)
        playCue('lose')
      }
      if (msg.auto_extended) {
        pushToast('info', `延时 ${msg.auto_extend_seconds} 秒`)
      }
    } else if (msg.type === 'auction_finished') {
      syncServerTime(msg.server_time)
      setFinished({ final_price: msg.final_price, winner_id: msg.winner_id })
      setAuction((p) => (p ? { ...p, status: 'finished' } : p))
      playCue('finish')
    } else if (msg.type === 'new_comment') {
      setComments((prev) => [...prev.slice(-49), msg.comment])
    } else if (msg.type === 'auction_cancelled') {
      setCancelled(true)
      setAuction((p) => (p ? { ...p, status: 'cancelled' } : p))
    }
  }

  function pushToast(kind: NonNullable<Toast>['kind'], text: string) {
    toastIdRef.current += 1
    setToast({ kind, text, id: toastIdRef.current })
  }

  function syncServerTime(serverTime?: string) {
    if (!serverTime) return
    const serverMs = new Date(serverTime).getTime()
    if (!Number.isFinite(serverMs)) return
    serverOffsetRef.current = serverMs - Date.now()
  }

  // 最小出价 = 当前价 + 1×加价幅度
  const minBid = useMemo(
    () => (auction ? auction.current_price + auction.price_step : 0),
    [auction?.current_price, auction?.price_step], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const effectiveBidAmount = auction && bidAmount >= minBid ? bidAmount : minBid

  // 是否命中某个快捷倍数（用于高亮）
  const matchedMultiplier = useMemo(() => {
    if (!auction) return 0
    const delta = effectiveBidAmount - auction.current_price
    if (delta <= 0) return 0
    const m = delta / auction.price_step
    if (Math.abs(m - Math.round(m)) > 0.001) return 0
    return Math.round(m)
  }, [effectiveBidAmount, auction?.current_price, auction?.price_step]) // eslint-disable-line

  // 演示在线人数（确定性，基于 auctionId）；真实参与人数来自 /stats 和 WS。
  const viewers = useMemo(() => ((auctionId * 137) % 800) + 120 + bidCount * 3, [auctionId, bidCount])

  const handleBid = async () => {
    if (!auction) return
    if (submitting) return
    const now = Date.now()
    if (now - lastBidAtRef.current < 700) {
      pushToast('info', '操作太快，正在同步出价')
      return
    }
    if (!isLoggedIn()) {
      const from = encodeURIComponent(`/auction/${auctionId}`)
      navigate(`/login?from=${from}`)
      return
    }
    lastBidAtRef.current = now
    setSubmitting(true)
    trackEvent(auctionId, 'bid_submit', {
      amount: effectiveBidAmount,
      multiplier: matchedMultiplier || null,
    })
    try {
      await api.post(`/auctions/${auctionId}/bids`, {
        amount: effectiveBidAmount,
        client_bid_id: makeClientBidID(),
      })
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

  const isCrisis = auction.status === 'active' && msLeft > 0 && msLeft < 10_000

  return (
    <div className={`live-room${isCrisis ? ' crisis' : ''}`}>
      {/* 背景层：仅在 contain 模式（横屏视频）时显示，避免单调黑边 */}
      {fitMode === 'contain' && (
        <video
          className="live-video-backdrop"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
          src={backdropSrc}
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

      {wsStatus !== 'open' && (
        <div className="absolute left-3 right-3 z-20" style={{ top: 'calc(var(--safe-top) + 88px)' }}>
          <div className="live-glass px-3 py-2 text-white/85 text-xs">
            {wsStatus === 'reconnecting' ? '正在重连并同步最新状态...' : '实时连接已断开'}
          </div>
        </div>
      )}

      {/* 顶部：拍品编号 + 主标题 —— 拍卖目录风（衬线 + 烫印号） */}
      <div
        className="absolute left-3 right-3 z-10"
        style={{ top: 'var(--safe-top)' }}
      >
        <div className="live-glass-pill flex items-center gap-2.5 pl-2.5 pr-3 py-1.5">
          <span
            className="font-catalog tabular-nums shrink-0"
            style={{
              fontSize: 11,
              letterSpacing: '0.08em',
              color: 'rgba(255, 240, 220, 0.95)',
              background: 'rgba(184, 134, 44, 0.32)',
              border: '1px solid rgba(229, 197, 126, 0.55)',
              padding: '1px 7px 2px',
              borderRadius: 2,
              textTransform: 'uppercase',
            }}
          >
            {lotNumberOf(auctionId)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="font-catalog text-white truncate"
                style={{ fontSize: 14, fontWeight: 600 }}
              >
                {auction.title}
              </span>
              <span className="px-1 py-px bg-[#C8102E] text-[9px] rounded-sm font-bold text-white tracking-wider">
                LIVE
              </span>
            </div>
            <div className="text-white/70 text-[10px] mt-px tabular-nums">
              {viewers.toLocaleString()} 在场 · {participantCount} 举牌
            </div>
          </div>
          {uid > 0 && (
            <span className="paddle-badge sm shrink-0" title="你的号牌">
              {paddleNumberOf(uid)}
            </span>
          )}
        </div>
      </div>

      {/* 倒计时 */}
      {auction.status === 'active' && msLeft > 0 && (
        <div
          className="absolute left-3 z-10"
          style={{ top: 'calc(var(--safe-top) + 52px)' }}
        >
          <span className={`countdown-pill ${msLeft < 10_000 ? 'urgent' : ''}`}>
            <span className="dot" />
            <span>距结束 {fmtMs(msLeft)}</span>
          </span>
        </div>
      )}

      {/* 排行榜 */}
      {topBids.length > 0 && (
        <div
          className="absolute right-3 z-10 w-36 live-glass p-2.5"
          style={{ top: 'calc(var(--safe-top) + 108px)' }}
        >
          <div className="text-[11px] text-white/75 mb-1.5 px-1 flex items-center gap-1.5 font-catalog tracking-wider uppercase">
            <IconTrophy size={12} />
            <span>Leaderboard</span>
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
                <span className="truncate flex-1 text-white/90 font-catalog tabular-nums">
                  {paddleNumberOf(b.user_id)}
                  {b.user_id === uid && <span className="text-[#FFD451] ml-1">·你</span>}
                </span>
                <span
                  className={`font-catalog tabular-nums font-bold ${
                    i === 0 ? 'text-[#FFD451]' : 'text-white'
                  }`}
                >
                  ¥{b.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 拍卖师弹幕滚带：每条评论从右滑入，向左淡出，三行错开 */}
      <div className="ticker-tape" style={{ bottom: 'calc(184px + env(safe-area-inset-bottom))' }}>
        {comments.slice(-3).map((c, i) => (
          <div key={c.id} className="ticker-item" style={{ top: i * 32 }}>
            <span className="who">{paddleNumberOf(c.user_id)}</span>
            <span>{c.content}</span>
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
              <div>参与 {participantCount} 人</div>
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
                  onClick={() => {
                    setBidAmount(auction.current_price + m * auction.price_step)
                    trackEvent(auctionId, 'bid_chip_click', { multiplier: m })
                  }}
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
                trackEvent(auctionId, 'bid_custom_open')
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
              onClick={() => {
                setShowCommentModal(true)
                trackEvent(auctionId, 'comment_open')
              }}
              className="flex-1 text-left text-white/55 text-sm truncate active:opacity-60 transition-opacity"
            >
              说点什么...
            </button>
            <button
              onClick={handleBid}
              disabled={submitting}
              className="btn-paddle"
              aria-label={isLoggedIn() ? `出价 ${effectiveBidAmount} 元` : '登录后出价'}
            >
              {submitting
                ? '举牌中…'
                : isLoggedIn()
                ? `举牌 ¥${effectiveBidAmount.toLocaleString()}`
                : `登录举牌`}
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
          Icon={finished.winner_id === uid ? IconTrophy : IconGavel}
          tone={finished.winner_id === uid ? 'gold' : 'neutral'}
          title="竞拍结束"
          subtitle={auction.title}
        >
          <div
            className="text-xs uppercase tracking-[0.18em] text-white/55 mb-1 font-catalog"
          >
            Hammer Price
          </div>
          <div
            className="font-catalog tabular-nums text-5xl mb-5"
            style={{ color: '#FFD66B', fontWeight: 600 }}
          >
            ¥{finished.final_price.toLocaleString()}
          </div>
          <div className="text-sm text-white/70 mb-6 flex items-center gap-2">
            <span>得主</span>
            {finished.winner_id ? (
              <>
                <span className="paddle-badge">{paddleNumberOf(finished.winner_id)}</span>
                {finished.winner_id === uid && (
                  <span className="text-[#FFD66B] font-semibold">· 是你</span>
                )}
              </>
            ) : (
              <span className="text-white/55">无人举牌</span>
            )}
          </div>
          {finished.winner_id === uid && (
            <button
              onClick={() => navigate(`/auction/${auctionId}/order`)}
              className="btn-paddle"
            >
              领取订单
            </button>
          )}
          <Link to="/" className="mt-6 text-white/70 text-sm">
            返回大厅
          </Link>
        </FullScreenEnd>
      )}

      {/* 取消盖层 */}
      {cancelled && !finished && (
        <FullScreenEnd Icon={IconBan} tone="danger" title="该竞拍已取消" subtitle={auction.title}>
          <Link to="/" className="mt-6 text-white/70 text-sm">
            返回大厅
          </Link>
        </FullScreenEnd>
      )}
    </div>
  )
}

function FullScreenEnd({
  Icon,
  tone = 'neutral',
  title,
  subtitle,
  children,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
  tone?: 'gold' | 'neutral' | 'danger'
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  const iconColor =
    tone === 'gold' ? '#FFD66B' : tone === 'danger' ? '#FF6B85' : 'rgba(255, 255, 255, 0.7)'
  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center p-8 text-center"
      style={{
        background:
          'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(20,20,30,0.92) 100%)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="mb-4" style={{ color: iconColor }}>
        <Icon size={64} strokeWidth={1.4} />
      </div>
      <div className="font-catalog text-2xl text-white mb-1" style={{ fontWeight: 600 }}>
        {title}
      </div>
      {subtitle && <div className="text-sm text-white/60 mb-6">{subtitle}</div>}
      {children}
    </div>
  )
}

function fmtMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  const tenth = Math.floor((ms % 1000) / 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenth}`
}

function makeClientBidID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function playCue(kind: 'win' | 'lose' | 'finish') {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return
  try {
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const now = ctx.currentTime
    osc.type = 'sine'
    osc.frequency.value = kind === 'win' ? 880 : kind === 'lose' ? 220 : 520
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.2)
    window.setTimeout(() => void ctx.close(), 250)
  } catch {
    /* Browser may block audio until a user gesture. */
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
