import { wsUrl } from '../api/client'
import type { WSMessage } from './types'

type Handler = (msg: WSMessage) => void
type StatusHandler = (s: 'open' | 'closed' | 'reconnecting') => void

// AuctionWS：自动重连 + 心跳监控的 WebSocket 封装
//
// 重连策略：
//   - 指数退避：1s, 2s, 4s, 8s, 16s（上限）
//   - 随机抖动 ±20%：避免大量客户端在同一时刻同时回连（雪崩）
//   - 上限 10 次后转 'closed'，由调用方决定是否手动刷新
//
// 心跳监控（防"半开"连接）：
//   - 后端每 30s 发一次 ping（gorilla/websocket 默认）
//   - 客户端 45s 内没收到任何消息（包括 ping）即视作连接死亡，主动 close 触发重连
//   - 任何 message 到达即重置 watchdog
const MAX_BACKOFF_MS = 16_000
const BASE_BACKOFF_MS = 1_000
const MAX_RETRIES = 10
const WATCHDOG_MS = 45_000

export class AuctionWS {
  private ws: WebSocket | null = null
  private retries = 0
  private closed = false
  private reconnectTimer: number | null = null
  private watchdogTimer: number | null = null
  private readonly auctionId: number
  private readonly onMessage: Handler
  private readonly onStatus?: StatusHandler

  constructor(auctionId: number, onMessage: Handler, onStatus?: StatusHandler) {
    this.auctionId = auctionId
    this.onMessage = onMessage
    this.onStatus = onStatus
  }

  connect(): void {
    if (this.closed) return
    const url = wsUrl(this.auctionId)
    const ws = new WebSocket(url)
    this.ws = ws

    ws.onopen = () => {
      this.retries = 0
      this.onStatus?.('open')
      this.armWatchdog()
    }
    ws.onmessage = (e) => {
      this.armWatchdog()
      try {
        const msg = JSON.parse(e.data) as WSMessage
        this.onMessage(msg)
      } catch {
        /* 静默：仅打活心跳 */
      }
    }
    ws.onclose = () => {
      this.ws = null
      this.clearWatchdog()
      if (this.closed) return
      if (this.retries >= MAX_RETRIES) {
        this.onStatus?.('closed')
        return
      }
      this.retries++
      this.onStatus?.('reconnecting')
      const delay = backoffWithJitter(this.retries)
      this.reconnectTimer = window.setTimeout(() => this.connect(), delay)
    }
    ws.onerror = () => {
      // 触发 onclose 走重连分支
      ws.close()
    }
  }

  close(): void {
    this.closed = true
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.clearWatchdog()
    this.ws?.close()
    this.ws = null
  }

  // 收到任何消息（包括底层 ping）就重置 watchdog
  private armWatchdog(): void {
    this.clearWatchdog()
    this.watchdogTimer = window.setTimeout(() => {
      // 长时间静默：连接可能"半开"——强制关闭触发 onclose → 重连
      this.ws?.close()
    }, WATCHDOG_MS)
  }
  private clearWatchdog(): void {
    if (this.watchdogTimer !== null) {
      window.clearTimeout(this.watchdogTimer)
      this.watchdogTimer = null
    }
  }
}

// 指数退避 + ±20% 抖动；retries 从 1 开始
function backoffWithJitter(retries: number): number {
  const base = Math.min(BASE_BACKOFF_MS * 2 ** (retries - 1), MAX_BACKOFF_MS)
  const jitter = base * 0.2 * (Math.random() * 2 - 1) // [-0.2 base, +0.2 base]
  return Math.max(BASE_BACKOFF_MS / 2, Math.round(base + jitter))
}
