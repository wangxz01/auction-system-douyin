import { useEffect, useState } from 'react'

export function Countdown({ endsAt, stopped }: { endsAt: string | null; stopped?: boolean }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (stopped) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [stopped])

  if (!endsAt) return <span className="text-gray-400">--:--</span>

  const target = new Date(endsAt).getTime()
  const diff = Math.max(0, Math.floor((target - now) / 1000))
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  const txt =
    h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return (
    <span className={diff <= 30 ? 'text-red-500 font-bold' : 'font-bold'}>{txt}</span>
  )
}
