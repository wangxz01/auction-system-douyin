export type ToastKind = 'win' | 'lose' | 'info'
export type ToastData = { kind: ToastKind; text: string; id: number }

const TONE: Record<ToastKind, string> = {
  win: 'linear-gradient(135deg, #34C759, #28A745)',
  lose: 'linear-gradient(135deg, #FE2C55, #FF6B85)',
  info: 'linear-gradient(135deg, #5AC8FA, #007AFF)',
}

export function LiveCenterToast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null
  return (
    <div key={toast.id} className="center-toast" role="status" aria-live="polite">
      <div
        className="px-7 py-4 rounded-2xl text-lg font-bold shadow-2xl text-white whitespace-nowrap"
        style={{ background: TONE[toast.kind], boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
      >
        {toast.text}
      </div>
    </div>
  )
}
