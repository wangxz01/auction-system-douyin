import http from 'k6/http'
import { check, sleep } from 'k6'

const vus = Number(__ENV.VUS || 100)
const iterations = Number(__ENV.ITERATIONS || vus)

export const options = {
  vus,
  iterations,
  thresholds: {
    http_req_failed: ['rate<0.50'],
    http_req_duration: ['p(95)<1000'],
  },
}

const apiBase = __ENV.API_BASE || 'http://localhost:8080'
const auctionId = __ENV.AUCTION_ID
const token = __ENV.TOKEN
const startCents = Number(__ENV.START_CENTS || 0)
const stepCents = Number(__ENV.STEP_CENTS || 100)

export default function () {
  if (!auctionId || !token) {
    throw new Error('AUCTION_ID and TOKEN are required')
  }

  const amountCents = startCents + (__ITER + 1) * stepCents
  const clientBidID = `k6-${__VU}-${__ITER}`
  const res = http.post(
    `${apiBase}/api/auctions/${auctionId}/bids`,
    JSON.stringify({
      amount_cents: amountCents,
      client_bid_id: clientBidID,
    }),
    {
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
    },
  )

  check(res, {
    'status is expected': (r) => [200, 400, 409, 429].includes(r.status),
  })
  sleep(0.01)
}
