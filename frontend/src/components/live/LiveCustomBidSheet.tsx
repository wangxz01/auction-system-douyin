// 自定义出价金额 bottom sheet
export function LiveCustomBidSheet({
  open,
  value,
  onChange,
  onConfirm,
  onClose,
  minBid,
  priceStep,
}: {
  open: boolean
  value: string
  onChange: (v: string) => void
  onConfirm: () => void
  onClose: () => void
  minBid: number
  priceStep: number
}) {
  if (!open) return null
  return (
    <div
      className="absolute inset-0 z-40 bg-black/60 flex items-end backdrop-blur-sm"
      onClick={onClose}
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
          最低 ¥{minBid.toLocaleString()}，必须为 ¥{priceStep} 的整数倍
        </div>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={String(minBid)}
          autoFocus
          step={priceStep}
          min={minBid}
          className="w-full bg-white/10 text-white text-2xl font-bold px-4 py-3 rounded-xl mb-5 outline-none"
          style={{ border: '1px solid rgba(255,255,255,0.15)' }}
        />
        <div className="flex items-center justify-around">
          <button onClick={onClose} className="live-text-btn muted text-base">
            取消
          </button>
          <button onClick={onConfirm} className="live-text-btn gold text-base">
            确认
          </button>
        </div>
      </div>
    </div>
  )
}
