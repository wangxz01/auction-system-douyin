// 直播间共享小工具：格式化、ID 生成、音效

export function fmtMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  const tenth = Math.floor((ms % 1000) / 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenth}`
}

export function makeClientBidID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

export function playCue(kind: 'win' | 'lose' | 'finish'): void {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return
  try {
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const now = ctx.currentTime
    osc.type = 'sine'
    osc.frequency.value = kind === 'win' ? 880 : kind === 'lose' ? 220 : 520
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.2)
    window.setTimeout(() => void ctx.close(), 250)
  } catch {
    /* 浏览器在无用户手势时可能拒绝播放 */
  }
}
