import type { AuctionStatus } from '../lib/types'

const STYLES: Record<AuctionStatus, { label: string; cls: string }> = {
  pending: {
    label: '未开始',
    cls: 'bg-app-100 text-ink-500 border-app-200',
  },
  active: {
    label: '进行中',
    cls: 'bg-gradient-to-br from-amber-300 to-orange-400 text-amber-900 border-amber-300',
  },
  finished: {
    label: '已结束',
    cls: 'bg-app-100 text-ink-500 border-app-200',
  },
  cancelled: {
    label: '已取消',
    cls: 'bg-rose-50 text-rose-700 border-rose-200',
  },
}

export function StatusBadge({ status }: { status: AuctionStatus }) {
  const s = STYLES[status]
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.cls}`}
    >
      {s.label}
    </span>
  )
}
