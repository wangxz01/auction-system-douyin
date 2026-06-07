import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080'

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 8000,
})

export function wsUrl(auctionId: number): string {
  const base = API_BASE.replace(/^http/, 'ws')
  return `${base}/ws/auctions/${auctionId}`
}
