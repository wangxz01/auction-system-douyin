import { lotNumberOf, paddleNumberOf } from '../../lib/paddle'

export function LiveHeader({
  auctionId,
  title,
  viewers,
  participantCount,
  uid,
  onBack,
}: {
  auctionId: number
  title: string
  viewers: number
  participantCount: number
  uid: number
  onBack: () => void
}) {
  return (
    <div className="absolute left-3 right-3 z-10" style={{ top: 'var(--safe-top)' }}>
      <div className="flex items-center gap-2 min-w-0">
        <button type="button" onClick={onBack} className="live-back-btn" aria-label="返回大厅">
          <span aria-hidden="true">‹</span>
          <span>返回</span>
        </button>
        <div className="live-glass-pill flex flex-1 min-w-0 items-center gap-2.5 pl-2.5 pr-3 py-1.5">
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
                {title}
              </span>
              <span
                className="px-1.5 py-px bg-[#C8102E] text-[9px] rounded-sm font-bold text-white shrink-0"
              >
                直播中
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
    </div>
  )
}
