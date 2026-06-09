import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { setAuth } from '../lib/auth'
import { IconAlert, IconGavel } from '../lib/icons'

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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm card p-8 fade-up">
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center mb-3"
            style={{
              width: 56,
              height: 56,
              borderRadius: 4,
              background:
                'linear-gradient(180deg, var(--hall-paddle-hi, #E5C57E) 0%, var(--hall-paddle, #B8862C) 60%, var(--hall-paddle-lo, #7E5A18) 100%)',
              color: '#2A1908',
              border: '1px solid rgba(126, 90, 24, 0.55)',
              boxShadow:
                'inset 0 1px 0 rgba(255, 240, 200, 0.6), inset 0 -1px 0 rgba(80, 50, 0, 0.35), 0 4px 12px rgba(80, 50, 0, 0.2)',
            }}
          >
            <IconGavel size={28} />
          </div>
          <h1 className="font-catalog text-2xl tracking-tight" style={{ color: 'var(--hall-velvet)', fontWeight: 600 }}>
            拍卖系统
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--hall-ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Live Bidding · Members
          </p>
        </div>

        <div className="pill-group w-full mb-6 grid grid-cols-2">
          <button
            type="button"
            onClick={() => setMode('login')}
            data-active={mode === 'login'}
            className="pill-tab text-center"
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            data-active={mode === 'register'}
            className="pill-tab text-center"
          >
            注册
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <div className="text-sm text-ink-700 mb-1.5 font-medium">用户名</div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={2}
              maxLength={32}
              autoComplete="username"
              className="input-default"
            />
          </label>
          <label className="block">
            <div className="text-sm text-ink-700 mb-1.5 font-medium">密码</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="input-default"
            />
          </label>

          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 rounded-xl px-3 py-2 border border-rose-200 inline-flex items-center gap-2">
              <IconAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-accent w-full py-3.5 rounded-2xl text-base"
          >
            {submitting ? '...' : mode === 'login' ? '登录' : '注册并登录'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-ink-400 hover:text-ink-700">
            ← 不登录，继续浏览
          </Link>
        </div>
      </div>
    </div>
  )
}
