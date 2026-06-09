import { fmtMs } from './live-utils'

export function LiveCountdown({ msLeft }: { msLeft: number }) {
  if (msLeft <= 0) return null
  return (
    <div className="absolute left-3 z-10" style={{ top: 'calc(var(--safe-top) + 52px)' }}>
      <span className={`countdown-pill ${msLeft < 10_000 ? 'urgent' : ''}`}>
        <span className="dot" />
        <span>距结束 {fmtMs(msLeft)}</span>
      </span>
    </div>
  )
}
