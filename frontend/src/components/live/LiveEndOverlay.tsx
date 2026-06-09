// 直播间结束盖层：finished（成交） / cancelled（被取消） 两种形态
import type { ComponentType, ReactNode, SVGProps } from 'react'
import { Link } from 'react-router-dom'
import { IconBan, IconGavel, IconTrophy } from '../../lib/icons'
import { paddleNumberOf } from '../../lib/paddle'

type Tone = 'gold' | 'neutral' | 'danger'

function FullScreen({
  Icon,
  tone = 'neutral',
  title,
  subtitle,
  children,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
  tone?: Tone
  title: string
  subtitle?: string
  children?: ReactNode
}) {
  const iconColor =
    tone === 'gold' ? '#FFD66B' : tone === 'danger' ? '#FF6B85' : 'rgba(255, 255, 255, 0.7)'
  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center p-8 text-center"
      style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(20,20,30,0.92) 100%)',
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

export function LiveFinishedOverlay({
  title,
  finalPrice,
  winnerId,
  uid,
  onClaimOrder,
}: {
  title: string
  finalPrice: number
  winnerId: number | null
  uid: number
  onClaimOrder: () => void
}) {
  const youWon = winnerId === uid
  return (
    <FullScreen
      Icon={youWon ? IconTrophy : IconGavel}
      tone={youWon ? 'gold' : 'neutral'}
      title="竞拍结束"
      subtitle={title}
    >
      <div className="text-xs uppercase tracking-[0.18em] text-white/55 mb-1 font-catalog">
        Hammer Price
      </div>
      <div
        className="font-catalog tabular-nums text-5xl mb-5"
        style={{ color: '#FFD66B', fontWeight: 600 }}
      >
        ¥{finalPrice.toLocaleString()}
      </div>
      <div className="text-sm text-white/70 mb-6 flex items-center gap-2">
        <span>得主</span>
        {winnerId ? (
          <>
            <span className="paddle-badge">{paddleNumberOf(winnerId)}</span>
            {youWon && <span className="text-[#FFD66B] font-semibold">· 是你</span>}
          </>
        ) : (
          <span className="text-white/55">无人举牌</span>
        )}
      </div>
      {youWon && (
        <button onClick={onClaimOrder} className="btn-paddle">
          领取订单
        </button>
      )}
      <Link to="/" className="mt-6 text-white/70 text-sm">
        返回大厅
      </Link>
    </FullScreen>
  )
}

export function LiveCancelledOverlay({ title }: { title: string }) {
  return (
    <FullScreen Icon={IconBan} tone="danger" title="该竞拍已取消" subtitle={title}>
      <Link to="/" className="mt-6 text-white/70 text-sm">
        返回大厅
      </Link>
    </FullScreen>
  )
}
