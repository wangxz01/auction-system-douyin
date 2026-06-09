// 评论输入 bottom sheet：点遮罩关闭；输入框 Enter 发送 / Esc 关闭
export function LiveCommentSheet({
  open,
  value,
  onChange,
  onSend,
  onClose,
}: {
  open: boolean
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-40 bg-black/55 flex items-end" onClick={onClose}>
      <div
        className="w-full px-3"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', paddingTop: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="live-glass flex items-center gap-2 px-3 py-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSend()
              if (e.key === 'Escape') onClose()
            }}
            placeholder="参与互动"
            maxLength={50}
            autoFocus
            className="flex-1 bg-transparent text-white text-base outline-none placeholder:text-white/40"
          />
          <button onClick={onSend} className="live-text-btn gold text-base">
            发送
          </button>
        </div>
      </div>
    </div>
  )
}
