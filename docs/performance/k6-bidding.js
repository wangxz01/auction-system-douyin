import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter } from 'k6/metrics'

const vus = Number(__ENV.VUS || 100)
const iterationsPerVU = Number(__ENV.ITERATIONS_PER_VU || 1)
const apiBase = __ENV.API_BASE || 'http://localhost:8080'
const stepCents = Number(__ENV.STEP_CENTS || 100)
const durationSeconds = Number(__ENV.DURATION_SECONDS || 600)
const maxRetries = Number(__ENV.MAX_RETRIES || 20)
const runId = __ENV.RUN_ID || `${Date.now()}`
const userRunId = runId.replace(/[^a-zA-Z0-9]/g, '').slice(-12)

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 499 }))

export const bidSuccess = new Counter('bid_success')
export const bidBusinessFail = new Counter('bid_business_fail')
export const bidUnexpectedFail = new Counter('bid_unexpected_fail')

export const options = {
  scenarios: {
    bidding: {
      executor: 'per-vu-iterations',
      vus,
      iterations: iterationsPerVU,
      maxDuration: '10m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
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
  const ceilingCents = Number(__ENV.CEILING_CENTS || (vus * iterationsPerVU + 1000) * stepCents)
  const res = postJSON(
    '/api/auctions',
    {
      title: `k6 perf auction ${runId}`,
      description: 'created by docs/performance/k6-bidding.js',
      start_price_cents: 0,
      price_step_cents: stepCents,
      ceiling_price_cents: ceilingCents,
      duration_seconds: durationSeconds,
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
  const token = __ENV.AUCTION_ID ? null : adminToken()
  const auctionId = __ENV.AUCTION_ID || createAuction(token)
  const tokens = []
  for (let i = 1; i <= vus; i++) {
    tokens.push(getToken(`k6u-${userRunId}-${i}`, 'password123'))
  }
  return { auctionId, tokens }
}

export default function (data) {
  const token = data.tokens[(__VU - 1) % data.tokens.length]
  const clientBidID = `k6-${runId}-${__VU}-${__ITER}`

  let res
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const auction = http.get(`${apiBase}/api/auctions/${data.auctionId}`)
    const currentCents = Number(auction.json('data.current_price_cents') || 0)
    const amountCents = currentCents + stepCents
    res = postJSON(
      `/api/auctions/${data.auctionId}/bids`,
      { amount_cents: amountCents, client_bid_id: clientBidID },
      token,
    )
    if (res.status === 200) break
    if (![400, 409, 429].includes(res.status)) break
    sleep(0.03 + Math.random() * 0.12)
  }

  const expected = [200, 400, 409, 429].includes(res.status)
  check(res, {
    'status is expected': () => expected,
  })
  if (res.status === 200) {
    bidSuccess.add(1)
  } else if (expected) {
    bidBusinessFail.add(1)
  } else {
    bidUnexpectedFail.add(1)
  }
}

export function teardown(data) {
  const stats = http.get(`${apiBase}/api/auctions/${data.auctionId}/stats`)
  const auction = http.get(`${apiBase}/api/auctions/${data.auctionId}`)
  console.log(`auction_id=${data.auctionId}`)
  console.log(`auction_status=${auction.status} body=${auction.body}`)
  console.log(`stats_status=${stats.status} body=${stats.body}`)
}
