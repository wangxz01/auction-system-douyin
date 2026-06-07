import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { setAuth } from '../lib/auth'

type Mode = 'login' | 'register'

interface AuthResp {
  data: { user_id: number; username: string; token: string }
}

export function Login() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const redirect = params.get('from') ?? '/'

  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register'
      const r = await api.post<AuthResp>(path, { username, password })
      setAuth(r.data.data.token, {
        user_id: r.data.data.user_id,
        username: r.data.data.username,
      })
      nav(redirect, { replace: true })
    } catch (e: unknown) {
      const r = (e as { response?: { data?: { error?: string } } }).response
      setError(r?.data?.error ?? '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="text-4xl">🏷️</div>
          <h1 className="text-2xl font-bold mt-2">拍卖系统</h1>
        </div>

        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-2 rounded text-sm font-medium ${
              mode === 'login' ? 'bg-white shadow' : 'text-gray-500'
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 py-2 rounded text-sm font-medium ${
              mode === 'register' ? 'bg-white shadow' : 'text-gray-500'
            }`}
          >
            注册
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <div className="text-sm text-gray-700 mb-1">用户名</div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={2}
              maxLength={32}
              autoComplete="username"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-red-500"
            />
          </label>
          <label className="block">
            <div className="text-sm text-gray-700 mb-1">密码</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-red-500"
            />
          </label>

          {error && <div className="text-sm text-red-500">⚠ {error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-red-500 to-pink-500 disabled:opacity-50 text-white py-3 rounded-lg font-bold"
          >
            {submitting ? '...' : mode === 'login' ? '登录' : '注册并登录'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-gray-400 hover:text-gray-600">
            ← 不登录，继续浏览
          </Link>
        </div>
      </div>
    </div>
  )
}
