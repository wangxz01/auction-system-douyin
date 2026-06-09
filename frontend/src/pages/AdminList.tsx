import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminAlert, AdminMetrics, Auction } from '../lib/types'
import { paddleNumberOf } from '../lib/paddle'

export function AdminList() {
  const nav = useNavigate()
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [alerts, setAlerts] = useState<AdminAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    api
      .get<{ data: Auction[] }>('/auctions')
      .then((r) => {
        setAuctions(r.data.data)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
    api
      .get<{ data: AdminMetrics }>('/admin/metrics')
      .then((r) => setMetrics(r.data.data))
      .catch(() => setMetrics(null))
    api
      .get<{ data: AdminAlert[] }>('/admin/alerts')
      .then((r) => setAlerts(r.data.data || []))
      .catch(() => setAlerts([]))
  }

  useEffect(() => {
    load()
    // 调度台轮询：每 10 秒刷新 telemetry + alerts
    const t = setInterval(load, 10_000)
    return () => clearInterval(t)
  }, [])

  const handleStart = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await api.post(`/auctions/${id}/start`)
      load()
    } catch (err) {
      alert(extractError(err))
    }
  }

  const handleCancel = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('确认取消该竞拍？')) return
    try {
      await api.post(`/auctions/${id}/cancel`)
      load()
    } catch (err) {
      alert(extractError(err))
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-7">
      {/* 调度台标题（等宽 + 全大写） */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="console-title">Auction Bridge</div>
          <div className="console-subtitle mt-1">竞拍管理 · Live operations</div>
        </div>
        <button onClick={() => nav('/admin/create')} className="btn-console primary">
          ＋ New Lot
        </button>
      </div>

      {/* Telemetry 遥测条 —— 始终可见 */}
      <TelemetryBar metrics={metrics} />

      {/* 告警 banner —— 仅在有告警时显示 */}
      {alerts.length > 0 && (
        <div>
          {alerts.map((a, i) => (
            <div key={i} className={`alert-banner ${a.severity}`}>
              <span className="severity">{a.severity}</span>
              <div className="flex-1">
                <div>{a.message}</div>
                <div className="code">{a.code}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 竞拍面板 */}
      <div className="console-panel mt-4">
        <div className="console-panel-header">
          <span className="title">Lot Roster</span>
          <span className="count">{loading ? '…' : `${auctions.length} TOTAL`}</span>
        </div>

        {loading && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--console-ink-mute)', fontFamily: 'var(--font-console)' }}>
            Loading…
          </div>
        )}
        {error && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--console-crimson)', fontFamily: 'var(--font-console)' }}>
            ERROR · {error}
          </div>
        )}

        {!loading && !error && (
          <table className="console-table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Lot</th>
                <th>Title</th>
                <th style={{ textAlign: 'right' }}>Start</th>
                <th style={{ textAlign: 'right' }}>Step</th>
                <th style={{ textAlign: 'right' }}>Current</th>
                <th>Outcome</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ textAlign: 'right', width: 180 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {auctions.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center" style={{ padding: '48px 0', color: 'var(--console-ink-mute)', fontFamily: 'var(--font-console)' }}>
                    NO LOTS YET
                  </td>
                </tr>
              )}
              {auctions.map((a) => (
                <tr key={a.id} onClick={() => nav(`/admin/auctions/${a.id}`)}>
                  <td className="num" style={{ textAlign: 'left', color: 'var(--console-ink-soft)' }}>
                    #{String(a.id).padStart(4, '0')}
                  </td>
                  <td style={{ color: 'var(--console-ink)' }}>{a.title}</td>
                  <td className="num">¥{Number(a.start_price).toLocaleString()}</td>
                  <td className="num">¥{Number(a.price_step).toLocaleString()}</td>
                  <td className="num hi">¥{Number(a.current_price).toLocaleString()}</td>
                  <td style={{ color: 'var(--console-ink-soft)', fontFamily: 'var(--font-console)', fontSize: 12 }}>
                    {a.status === 'finished' ? (
                      <>¥{Number(a.current_price).toLocaleString()} → {paddleNumberOf(a.winner_id)}</>
                    ) : (
                      <span style={{ color: 'var(--console-ink-mute)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <ConsoleStatus status={a.status} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {a.status === 'pending' && (
                      <div className="flex justify-end gap-2">
                        <button onClick={(e) => handleStart(e, a.id)} className="btn-console primary">
                          Start
                        </button>
                        <button onClick={(e) => handleCancel(e, a.id)} className="btn-console">
                          Cancel
                        </button>
                      </div>
                    )}
                    {a.status === 'active' && (
                      <button onClick={(e) => handleCancel(e, a.id)} className="btn-console danger">
                        Stop
                      </button>
                    )}
                    {(a.status === 'finished' || a.status === 'cancelled') && (
                      <span style={{ color: 'var(--console-ink-mute)', fontFamily: 'var(--font-console)', fontSize: 11 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function TelemetryBar({ metrics }: { metrics: AdminMetrics | null }) {
  if (!metrics) {
    return (
      <div className="telemetry-bar">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="telemetry-cell">
            <span className="strip" />
            <span className="k">—</span>
            <span className="v" style={{ color: 'var(--console-ink-mute)' }}>·</span>
          </div>
        ))}
      </div>
    )
  }
  const dbOk = metrics.db_available
  const redisOk = metrics.redis_available
  const infraTone: 'healthy' | 'warn' | 'crit' = !dbOk ? 'crit' : !redisOk ? 'warn' : 'healthy'
  const infraLabel = !dbOk ? 'DB DOWN' : !redisOk ? 'REDIS DOWN' : 'NOMINAL'
  const alertCount = metrics.alert_count ?? 0
  const alertTone: 'healthy' | 'warn' | 'crit' = alertCount === 0 ? 'healthy' : alertCount > 2 ? 'crit' : 'warn'

  return (
    <div className="telemetry-bar">
      <div className="telemetry-cell">
        <span className="strip" />
        <span className="k">Active Lots</span>
        <span className="v">{metrics.active_auctions}</span>
      </div>
      <div className={`telemetry-cell ${metrics.online_ws_connections > 0 ? 'healthy' : ''}`}>
        <span className="strip" />
        <span className="k">WS Online</span>
        <div>
          <span className={`v ${metrics.online_ws_connections > 0 ? 'healthy' : ''}`}>
            {metrics.online_ws_connections}
          </span>
          <span className="sub">{metrics.active_rooms} rooms</span>
        </div>
      </div>
      <div className="telemetry-cell">
        <span className="strip" />
        <span className="k">Bids · Today</span>
        <div>
          <span className="v">{metrics.total_bids_today}</span>
          {typeof metrics.total_events_today === 'number' && (
            <span className="sub">{metrics.total_events_today} events</span>
          )}
        </div>
      </div>
      <div className={`telemetry-cell ${infraTone}`}>
        <span className="strip" />
        <span className="k">Infrastructure</span>
        <span className={`v ${infraTone}`} style={{ fontSize: 14, letterSpacing: '0.08em' }}>
          {infraLabel}
        </span>
      </div>
      <div className={`telemetry-cell ${alertTone}`}>
        <span className="strip" />
        <span className="k">Alerts</span>
        <span className={`v ${alertTone}`}>{alertCount}</span>
      </div>
    </div>
  )
}

function ConsoleStatus({ status }: { status: Auction['status'] }) {
  const label =
    status === 'active' ? 'LIVE' : status === 'pending' ? 'READY' : status === 'finished' ? 'SOLD' : 'STOPPED'
  return (
    <span className={`console-status ${status === 'active' ? 'live' : status}`}>
      <span className="dot" />
      {label}
    </span>
  )
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const r = (e as { response?: { data?: { error?: string } } }).response
    return r?.data?.error ?? '请求失败'
  }
  return String(e)
}
