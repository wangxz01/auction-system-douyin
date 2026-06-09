import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type Hls from 'hls.js'
import { api } from '../api/client'
import { getUser, isLoggedIn } from '../lib/auth'
import { AuctionWS } from '../lib/ws'
import type { Auction, AuctionComment, AuctionStats, Bid, TopBid, WSMessage } from '../lib/types'
import { paddleNumberOf } from '../lib/paddle'
import { trackEvent } from '../lib/events'
import { LiveHeader } from '../components/live/LiveHeader'
import { LiveCountdown } from '../components/live/LiveCountdown'
import { LiveLeaderboard } from '../components/live/LiveLeaderboard'
import { LiveTicker } from '../components/live/LiveTicker'
import { LiveProductCard } from '../components/live/LiveProductCard'
import { LiveCenterToast, type ToastData, type ToastKind } from '../components/live/LiveCenterToast'
import { LiveCommentSheet } from '../components/live/LiveCommentSheet'
import { LiveCustomBidSheet } from '../components/live/LiveCustomBidSheet'
import { LiveCancelledOverlay, LiveFinishedOverlay } from '../components/live/LiveEndOverlay'
import { makeClientBidID, playCue } from '../components/live/live-utils'

const FALLBACK_VIDEO = '/live.mp4'

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
  const [toast, setToast] = useState<ToastData | null>(null)
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
    setFitMode('cover')
    let hls: Hls | null = null
    let stopped = false

    const playFallback = () => {
      if (stopped) return
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
      video.src = url
      const onErr = () => playFallback()
      video.addEventListener('error', onErr, { once: true })
      void video.play().catch(() => {})
    } else {
      void import('hls.js').then(({ default: Hls }) => {
        if (stopped) return
        if (!Hls.isSupported()) {
          playFallback()
          return
        }
        hls = new Hls({ enableWorker: true })
        hls.loadSource(url)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (stopped) return
          void video.play().catch(() => {})
        })
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            hls?.destroy()
            hls = null
            playFallback()
          }
        })
      })
    }

    return () => {
      stopped = true
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
      setFinished({ final_price: freshAuction.current_price, winner_id: freshAuction.winner_id })
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

  // 初始拉数据；WS 重连成功后也复用同一个快照补偿逻辑
  useEffect(() => {
    const timer = window.setTimeout(() => void loadSnapshot(), 0)
    return () => window.clearTimeout(timer)
  }, [loadSnapshot])

  // 行为埋点：进房 / 离房（fire-and-forget，仅登录用户）
  useEffect(() => {
    if (!auctionId) return
    trackEvent(auctionId, 'enter_room', {
      ts: Date.now(),
      ua_screen:
        typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '',
    })
    const onUnload = () => trackEvent(auctionId, 'leave_room', { ts: Date.now() })
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
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
        if (status === 'open') void loadSnapshot()
      },
    )
    ws.connect()
    return () => ws.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId, loadSnapshot])

  // 倒计时
  useEffect(() => {
    if (!auction?.ends_at || auction.status !== 'active') return
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

  function pushToast(kind: ToastKind, text: string) {
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

  const matchedMultiplier = useMemo(() => {
    if (!auction) return 0
    const delta = effectiveBidAmount - auction.current_price
    if (delta <= 0) return 0
    const m = delta / auction.price_step
    if (Math.abs(m - Math.round(m)) > 0.001) return 0
    return Math.round(m)
  }, [effectiveBidAmount, auction?.current_price, auction?.price_step]) // eslint-disable-line

  // 演示在线人数（确定性）
  const viewers = useMemo(
    () => ((auctionId * 137) % 800) + 120 + bidCount * 3,
    [auctionId, bidCount],
  )

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

    // 乐观更新：立刻把本地当前价 / 排行榜推进
    const snapshot = {
      current_price: auction.current_price,
      winner_id: auction.winner_id,
      topBids,
      priceFlashKey,
    }
    setAuction((p) =>
      p ? { ...p, current_price: effectiveBidAmount, winner_id: uid } : p,
    )
    setTopBids((prev) => {
      const optimistic: TopBid = {
        user_id: uid,
        amount: effectiveBidAmount,
        amount_cents: Math.round(effectiveBidAmount * 100),
      }
      const merged = [optimistic, ...prev.filter((b) => b.user_id !== uid)]
      return merged.slice(0, 5)
    })
    setPriceFlashKey((k) => k + 1)

    try {
      await api.post(`/auctions/${auctionId}/bids`, {
        amount: effectiveBidAmount,
        client_bid_id: makeClientBidID(),
      })
      hasBidRef.current = true
    } catch (e: unknown) {
      // 回滚
      setAuction((p) =>
        p
          ? { ...p, current_price: snapshot.current_price, winner_id: snapshot.winner_id }
          : p,
      )
      setTopBids(snapshot.topBids)
      setPriceFlashKey(snapshot.priceFlashKey)
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
      {/* 背景层：仅在 contain 模式（横屏视频）时显示 */}
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
          setFitMode(ratio >= 1.1 ? 'contain' : 'cover')
        }}
      />

      {videoLoading && (
        <div className="absolute inset-0 z-[2] flex items-center justify-center pointer-events-none">
          <div className="bg-black/60 rounded-full px-4 py-2 text-white/90 text-xs backdrop-blur">
            正在加载直播流...
          </div>
        </div>
      )}

      {usingFallback && auction.stream_url && !videoLoading && (
        <div className="absolute top-2 right-2 z-[5]">
          <div className="bg-black/55 text-white/80 text-[10px] rounded-full px-2 py-0.5 backdrop-blur">
            演示视频
          </div>
        </div>
      )}

      <div className="live-overlay-top" />
      <div className="live-overlay-bottom" />

      {wsStatus !== 'open' && (
        <div
          className="absolute left-3 right-3 z-20"
          style={{ top: 'calc(var(--safe-top) + 88px)' }}
        >
          <div className="live-glass px-3 py-2 text-white/85 text-xs">
            {wsStatus === 'reconnecting' ? '正在重连并同步最新状态...' : '实时连接已断开'}
          </div>
        </div>
      )}

      <LiveHeader
        auctionId={auctionId}
        title={auction.title}
        viewers={viewers}
        participantCount={participantCount}
        uid={uid}
      />

      {auction.status === 'active' && <LiveCountdown msLeft={msLeft} />}

      <LiveLeaderboard bids={topBids} uid={uid} />
      <LiveTicker comments={comments} />
      <LiveProductCard
        auction={auction}
        bidCount={bidCount}
        participantCount={participantCount}
        priceFlashKey={priceFlashKey}
      />

      {/* 底部统一玻璃容器：倍数 chips + 评论占位 + 出价按钮 */}
      {auction.status === 'active' && (
        <div
          className="absolute left-2 right-2 bottom-2 z-10 live-glass px-3 pt-2"
          style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
        >
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

          <div className="h-px bg-white/12 -mx-3" />

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

      <LiveCommentSheet
        open={showCommentModal}
        value={commentInput}
        onChange={setCommentInput}
        onSend={() => void sendComment()}
        onClose={() => setShowCommentModal(false)}
      />

      <LiveCustomBidSheet
        open={showCustomModal && !!auction}
        value={customInput}
        onChange={setCustomInput}
        onConfirm={confirmCustom}
        onClose={() => setShowCustomModal(false)}
        minBid={minBid}
        priceStep={auction.price_step}
      />

      <LiveCenterToast toast={toast} />

      {finished && (
        <LiveFinishedOverlay
          title={auction.title}
          finalPrice={finished.final_price}
          winnerId={finished.winner_id}
          uid={uid}
          onClaimOrder={() => navigate(`/auction/${auctionId}/order`)}
        />
      )}

      {cancelled && !finished && <LiveCancelledOverlay title={auction.title} />}
    </div>
  )
}
