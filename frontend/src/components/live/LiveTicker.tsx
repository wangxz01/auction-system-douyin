import type { AuctionComment } from '../../lib/types'
import { paddleNumberOf } from '../../lib/paddle'

export function LiveTicker({ comments }: { comments: AuctionComment[] }) {
  return (
    <div className="ticker-tape" style={{ bottom: 'calc(184px + env(safe-area-inset-bottom))' }}>
      {comments.slice(-3).map((c, i) => (
        <div key={c.id} className="ticker-item" style={{ top: i * 32 }}>
          <span className="who">{paddleNumberOf(c.user_id)}</span>
          <span>{c.content}</span>
        </div>
      ))}
    </div>
  )
}
