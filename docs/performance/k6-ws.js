import http from 'k6/http'
import ws from 'k6/ws'
import { check, sleep } from 'k6'
import { Counter, Trend } from 'k6/metrics'

const apiBase = __ENV.API_BASE || 'http://localhost:8080'
const wsBase = (__ENV.WS_BASE || apiBase).replace(/^http/, 'ws')
const vus = Number(__ENV.WS_VUS || __ENV.VUS || 100)
const holdSeconds = Number(__ENV.HOLD_SECONDS || 20)
const connectDelaySeconds = Number(__ENV.CONNECT_DELAY_SECONDS || 5)
const runId = __ENV.RUN_ID || `${Date.now()}`
const userRunId = runId.replace(/[^a-zA-Z0-9]/g, '').slice(-12)
const broadcastPrefix = `k6-ws-${runId}`

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 499 }))

export const wsConnected = new Counter('ws_connected')
export const wsConnectFailed = new Counter('ws_connect_failed')
export const wsBroadcastReceived = new Counter('ws_broadcast_received')
export const wsUnexpectedMessage = new Counter('ws_unexpected_message')
export const wsBroadcastLatency = new Trend('ws_broadcast_latency')

export const options = {
  scenarios: {
    ws_room: {
      executor: 'per-vu-iterations',
      vus,
      iterations: 1,
      maxDuration: `${holdSeconds + 30}s`,
      exec: 'wsRoom',
    },
    broadcaster: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      startTime: `${connectDelaySeconds}s`,
      exec: 'broadcastOnce',
    },
  },
  thresholds: {
    ws_connected: [`count>=${vus}`],
    ws_connect_failed: ['count==0'],
    ws_broadcast_received: [`count>=${__ENV.REQUIRE_BROADCAST === 'true' ? vus : 0}`],
    ws_broadcast_latency: ['p(95)<1500'],
  },
}

function jsonHeaders(token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = token
  return { headers }
}

function postJSON(path, body, token) {
  return http.post(`${apiBase}${path}`, JSON.stringify(body), jsonHeaders(token))
}

function getToken(username, password) {
  let res = postJSON('/api/auth/register', { username, password })
  if (res.status !== 200) {
    res = postJSON('/api/auth/login', { username, password })
  }
  if (res.status !== 200) {
    throw new Error(`failed to get token for ${username}: ${res.status} ${res.body}`)
  }
  return `Bearer ${res.json('data.token')}`
}

function adminToken() {
  if (__ENV.ADMIN_TOKEN) return __ENV.ADMIN_TOKEN
  const username = __ENV.ADMIN_USERNAME
  const password = __ENV.ADMIN_PASSWORD
  if (!username || !password) {
    throw new Error('ADMIN_TOKEN or ADMIN_USERNAME/ADMIN_PASSWORD is required when AUCTION_ID is not provided')
  }
  return getToken(username, password)
}

function createAuction(token) {
  const res = postJSON(
    '/api/auctions',
    {
      title: `k6 ws auction ${runId}`,
      description: 'created by docs/performance/k6-ws.js',
      start_price_cents: 0,
      price_step_cents: 100,
      ceiling_price_cents: 100000000,
      duration_seconds: Math.max(holdSeconds + 60, 120),
      auto_extend_seconds: 10,
    },
    token,
  )
  if (res.status !== 200) {
    throw new Error(`create auction failed: ${res.status} ${res.body}`)
  }
  const auctionId = res.json('data.id')
  const start = postJSON(`/api/auctions/${auctionId}/start`, {}, token)
  if (start.status !== 200) {
    throw new Error(`start auction failed: ${start.status} ${start.body}`)
  }
  return auctionId
}

export function setup() {
  const auctionId = __ENV.AUCTION_ID || createAuction(adminToken())
  const broadcasterToken =
    __ENV.BROADCAST_TOKEN || getToken(`k6-ws-broadcaster-${userRunId}`, 'password123')
  return { auctionId, broadcasterToken }
}

export function wsRoom(data) {
  let received = false
  const url = `${wsBase}/ws/auctions/${data.auctionId}`
  const res = ws.connect(url, {}, (socket) => {
    socket.on('open', () => {
      wsConnected.add(1)
      socket.setInterval(() => socket.ping(), 10_000)
    })

    socket.on('message', (raw) => {
      let event
      try {
        event = JSON.parse(raw)
      } catch {
        wsUnexpectedMessage.add(1)
        return
      }
      if (event.type !== 'new_comment') return
      const content = event.comment?.content || ''
      if (!content.startsWith(broadcastPrefix)) return
      received = true
      const sentAt = Number(content.split(' ').pop())
      if (sentAt > 0) wsBroadcastLatency.add(Date.now() - sentAt)
      wsBroadcastReceived.add(1)
    })

    socket.setTimeout(() => socket.close(), holdSeconds * 1000 - 500)
  })

  if (!check(res, { 'ws handshake is 101': (r) => r && r.status === 101 })) {
    wsConnectFailed.add(1)
  }
  if (__ENV.REQUIRE_BROADCAST === 'true') {
    check(received, { 'client received broadcast': (ok) => ok })
  }
}

export function broadcastOnce(data) {
  sleep(1)
  const sentAt = Date.now()
  const res = postJSON(
    `/api/auctions/${data.auctionId}/comments`,
    { content: `${broadcastPrefix} ${sentAt}` },
    data.broadcasterToken,
  )
  check(res, {
    'broadcast comment accepted': (r) => r.status === 200,
  })
  sleep(Math.max(1, holdSeconds - connectDelaySeconds - 2))
}
