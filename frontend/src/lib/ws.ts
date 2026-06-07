import { wsUrl } from '../api/client'
import type { WSMessage } from './types'

type Handler = (msg: WSMessage) => void
type StatusHandler = (s: 'open' | 'closed' | 'reconnecting') => void

// AuctionWS：带自动重连（最多 5 次，每次 3s）的 WebSocket 封装。
export class AuctionWS {
  private ws: WebSocket | null = null
  private retries = 0
  private closed = false
  private readonly maxRetries = 5
  private readonly retryDelayMs = 3000
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
    }
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WSMessage
        this.onMessage(msg)
      } catch {
        /* ignore */
      }
    }
    ws.onclose = () => {
      this.ws = null
      if (this.closed) return
      if (this.retries < this.maxRetries) {
        this.retries++
        this.onStatus?.('reconnecting')
        setTimeout(() => this.connect(), this.retryDelayMs)
      } else {
        this.onStatus?.('closed')
      }
    }
    ws.onerror = () => {
      ws.close()
    }
  }

  close(): void {
    this.closed = true
    this.ws?.close()
    this.ws = null
  }
}
