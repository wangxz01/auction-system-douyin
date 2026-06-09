import type { Auction } from '../../lib/types'

export function LiveProductCard({
  auction,
  bidCount,
  participantCount,
  priceFlashKey,
}: {
  auction: Auction
  bidCount: number
  participantCount: number
  priceFlashKey: number
}) {
  return (
    <div
      className="absolute left-3 right-3 z-10"
      style={{ bottom: 'calc(140px + env(safe-area-inset-bottom))' }}
    >
      <div className="live-glass p-3.5">
        <div
          className="text-white text-sm font-semibold mb-1 truncate"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
        >
          {auction.title}
        </div>
        {auction.description && (
          <div className="text-white/75 text-xs mb-2 line-clamp-2">{auction.description}</div>
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
  )
}
