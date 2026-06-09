// 用户行为埋点：fire-and-forget 上报到 POST /api/auctions/:id/events
// 设计原则：
//   1. 失败静默——埋点不应影响业务体验
//   2. 仅在登录状态下上报（后端要求 RequireAuth）
//   3. leave_room 用 fetch keepalive: true，保证导航离开时仍能发出
//   4. metadata 用字符串（后端期望 string，≤2000 字符）
import { apiBase } from '../api/client'
import { getToken, isLoggedIn } from './auth'

export type EventType =
  | 'enter_room'
  | 'leave_room'
  | 'bid_chip_click'
  | 'bid_custom_open'
  | 'bid_submit'
  | 'comment_open'

export function trackEvent(
  auctionId: number,
  type: EventType,
  metadata?: Record<string, unknown>,
): void {
  if (!auctionId || auctionId <= 0) return
  if (!isLoggedIn()) return
  const token = getToken()
  if (!token) return

  const body = JSON.stringify({
    event_type: type,
    metadata: metadata ? safeStringify(metadata) : '',
  })

  try {
    void fetch(`${apiBase()}/api/auctions/${auctionId}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body,
      // keepalive 让请求在页面 unload 时仍能发出（leave_room 关键）
      keepalive: true,
    }).catch(() => {
      /* 埋点静默失败 */
    })
  } catch {
    /* SSR / 旧浏览器：彻底忽略 */
  }
}

function safeStringify(meta: Record<string, unknown>): string {
  try {
    const s = JSON.stringify(meta)
    // 后端硬上限 2000，保留余量
    return s.length > 1800 ? s.slice(0, 1800) : s
  } catch {
    return ''
  }
}
