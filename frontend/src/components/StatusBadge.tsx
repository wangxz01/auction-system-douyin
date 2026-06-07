import type { AuctionStatus } from '../lib/types'

const STYLES: Record<AuctionStatus, { label: string; cls: string }> = {
  pending: { label: '未开始', cls: 'bg-gray-200 text-gray-700' },
  active: { label: '进行中', cls: 'bg-green-100 text-green-700' },
  finished: { label: '已结束', cls: 'bg-blue-100 text-blue-700' },
  cancelled: { label: '已取消', cls: 'bg-red-100 text-red-700' },
}

export function StatusBadge({ status }: { status: AuctionStatus }) {
  const s = STYLES[status]
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>{s.label}</span>
  )
}
