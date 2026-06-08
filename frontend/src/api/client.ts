import axios from 'axios'
import { clearAuth, getToken } from '../lib/auth'

const configuredBase = (import.meta.env.VITE_API_BASE ?? '').trim()
const API_BASE =
  configuredBase ||
  (import.meta.env.DEV ? 'http://localhost:8080' : window.location.origin)

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 8000,
})

// 请求拦截器：自动附带 Bearer token
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：401 → 清登录态 + 跳登录
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      clearAuth()
      const here = window.location.pathname + window.location.search
      if (window.location.pathname !== '/login') {
        window.location.href = `/login?from=${encodeURIComponent(here)}`
      }
    }
    return Promise.reject(err)
  },
)

export function wsUrl(auctionId: number): string {
  const url = new URL(`/ws/auctions/${auctionId}`, API_BASE)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}
