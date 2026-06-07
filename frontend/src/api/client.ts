import axios from 'axios'
import { clearAuth, getToken } from '../lib/auth'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080'

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
  const base = API_BASE.replace(/^http/, 'ws')
  return `${base}/ws/auctions/${auctionId}`
}
