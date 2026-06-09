import type { TopBid } from '../../lib/types'
import { paddleNumberOf } from '../../lib/paddle'
import { IconTrophy } from '../../lib/icons'

export function LiveLeaderboard({ bids, uid }: { bids: TopBid[]; uid: number }) {
  if (bids.length === 0) return null
  return (
    <div
      className="absolute right-3 z-10 w-36 live-glass p-2.5"
      style={{ top: 'calc(var(--safe-top) + 108px)' }}
    >
      <div className="text-[11px] text-white/75 mb-1.5 px-1 flex items-center gap-1.5 font-catalog tracking-wider uppercase">
        <IconTrophy size={12} />
        <span>Leaderboard</span>
      </div>
      <div className="space-y-1.5">
        {bids.slice(0, 5).map((b, i) => (
          <div key={`${b.user_id}-${b.amount}-${i}`} className="flex items-center gap-1.5 text-xs">
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
  )
}
