import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminAlert, AdminMetrics, Auction, DemoUser } from '../lib/types'
import { paddleNumberOf } from '../lib/paddle'

export function AdminList() {
  const nav = useNavigate()
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [alerts, setAlerts] = useState<AdminAlert[]>([])
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    api
      .get<{ data: Auction[] }>('/auctions')
      .then((r) => {
        setAuctions(r.data.data)
        setError(null)
      })
      .catch((e) => setError(extractError(e)))
      .finally(() => setLoading(false))
    api
      .get<{ data: AdminMetrics }>('/admin/metrics')
      .then((r) => setMetrics(r.data.data))
      .catch(() => setMetrics(null))
    api
      .get<{ data: AdminAlert[] }>('/admin/alerts')
      .then((r) => setAlerts(r.data.data || []))
      .catch(() => setAlerts([]))
    api
      .get<{ data: DemoUser[] }>('/admin/demo-users')
      .then((r) => setDemoUsers(r.data.data || []))
      .catch(() => setDemoUsers([]))
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

  const handleFinish = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('确认强制结束该竞拍并按当前领先者生成订单？')) return
    try {
      await api.post(`/admin/auctions/${id}/finish`)
      load()
    } catch (err) {
      alert(extractError(err))
    }
  }

  const handleDeleteAuction = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('确认物理删除该拍卖及其出价、评论、订单、行为数据？')) return
    try {
      await api.delete(`/admin/auctions/${id}`)
      load()
    } catch (err) {
      alert(extractError(err))
    }
  }

  const handleDeleteDemoUser = async (id: number, username: string) => {
    if (!confirm(`确认删除演示用户 ${username}？该用户的出价、评论、订单和行为数据也会清理。`)) return
    try {
      await api.delete(`/admin/demo-users/${id}`)
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
          <div className="console-title">竞拍管理台</div>
          <div className="console-subtitle mt-1">竞拍管理 · 实时运营</div>
        </div>
        <button onClick={() => nav('/admin/create')} className="btn-console primary">
          ＋ 新建竞拍
        </button>
      </div>

      {/* Telemetry 遥测条 —— 始终可见 */}
      <TelemetryBar metrics={metrics} />

      {/* 告警 banner —— 仅在有告警时显示 */}
      {alerts.length > 0 && (
        <div>
          {alerts.map((a, i) => (
            <div key={i} className={`alert-banner ${a.severity}`}>
              <span className="severity">{alertSeverityLabel(a.severity)}</span>
              <div className="flex-1">
                <div>{a.message}</div>
                <div className="code">{alertSeverityLabel(a.severity)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 竞拍面板 */}
      <div className="console-panel mt-4">
        <div className="console-panel-header">
          <span className="title">竞拍列表</span>
          <span className="count">{loading ? '…' : `共 ${auctions.length} 场`}</span>
        </div>

        {loading && (
          <div style={{ padding: 14 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4"
                style={{
                  paddingTop: 10,
                  paddingBottom: 10,
                  borderBottom: i < 4 ? '1px solid var(--console-rule)' : 'none',
                }}
              >
                <div className="skeleton" style={{ height: 12, width: 60 }} />
                <div className="skeleton" style={{ height: 14, flex: 1 }} />
                <div className="skeleton" style={{ height: 14, width: 70 }} />
                <div className="skeleton" style={{ height: 14, width: 70 }} />
                <div className="skeleton" style={{ height: 14, width: 90 }} />
                <div className="skeleton" style={{ height: 18, width: 100 }} />
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--console-crimson)', fontFamily: 'var(--font-console)' }}>
            错误 · {error}
          </div>
        )}

        {!loading && !error && (
          <table className="console-table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>编号</th>
                <th>商品</th>
                <th style={{ textAlign: 'right' }}>起拍价</th>
                <th style={{ textAlign: 'right' }}>加价</th>
                <th style={{ textAlign: 'right' }}>当前价</th>
                <th>成交结果</th>
                <th style={{ width: 110 }}>状态</th>
                <th style={{ textAlign: 'right', width: 180 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {auctions.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center" style={{ padding: '48px 0', color: 'var(--console-ink-mute)', fontFamily: 'var(--font-console)' }}>
                    暂无竞拍
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
                          开始
                        </button>
                        <button onClick={(e) => handleCancel(e, a.id)} className="btn-console">
                          取消
                        </button>
                      </div>
                    )}
                    {a.status === 'active' && (
                      <div className="flex justify-end gap-2">
                        <button onClick={(e) => handleFinish(e, a.id)} className="btn-console primary">
                          结束
                        </button>
                        <button onClick={(e) => handleCancel(e, a.id)} className="btn-console danger">
                          停止
                        </button>
                      </div>
                    )}
                    {(a.status === 'finished' || a.status === 'cancelled') && (
                      <button onClick={(e) => handleDeleteAuction(e, a.id)} className="btn-console danger">
                        删除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="console-panel mt-4">
        <div className="console-panel-header">
          <span className="title">演示用户</span>
          <span className="count">共 {demoUsers.length} 人</span>
        </div>
        <table className="console-table">
          <thead>
            <tr>
              <th style={{ width: 70 }}>编号</th>
              <th>用户名</th>
              <th>角色</th>
              <th>商家名</th>
              <th style={{ textAlign: 'right' }}>出价</th>
              <th style={{ textAlign: 'right' }}>订单</th>
              <th style={{ textAlign: 'right' }}>竞拍</th>
              <th style={{ textAlign: 'right', width: 110 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {demoUsers.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center" style={{ padding: '34px 0', color: 'var(--console-ink-mute)', fontFamily: 'var(--font-console)' }}>
                  暂无演示用户
                </td>
              </tr>
            )}
            {demoUsers.map((u) => (
              <tr key={u.id}>
                <td className="num" style={{ textAlign: 'left', color: 'var(--console-ink-soft)' }}>
                  #{String(u.id).padStart(4, '0')}
                </td>
                <td style={{ color: 'var(--console-ink)' }}>{u.username}</td>
                <td style={{ color: 'var(--console-ink-soft)', fontFamily: 'var(--font-console)', fontSize: 12 }}>
                  {demoUserRoleLabel(u.role)}
                </td>
                <td style={{ color: 'var(--console-ink-soft)' }}>{u.merchant || '—'}</td>
                <td className="num">{u.bid_count}</td>
                <td className="num">{u.order_count}</td>
                <td className="num">{u.auction_count}</td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => handleDeleteDemoUser(u.id, u.username)} className="btn-console danger">
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
  const infraLabel = !dbOk ? '数据库异常' : !redisOk ? 'Redis 异常' : '正常'
  const alertCount = metrics.alert_count ?? 0
  const alertTone: 'healthy' | 'warn' | 'crit' = alertCount === 0 ? 'healthy' : alertCount > 2 ? 'crit' : 'warn'

  return (
    <div className="telemetry-bar">
      <div className="telemetry-cell">
        <span className="strip" />
        <span className="k">活跃竞拍</span>
        <span className="v">{metrics.active_auctions}</span>
      </div>
      <div className={`telemetry-cell ${metrics.online_ws_connections > 0 ? 'healthy' : ''}`}>
        <span className="strip" />
        <span className="k">在线连接</span>
        <div>
          <span className={`v ${metrics.online_ws_connections > 0 ? 'healthy' : ''}`}>
            {metrics.online_ws_connections}
          </span>
          <span className="sub">{metrics.active_rooms} 个房间</span>
        </div>
      </div>
      <div className="telemetry-cell">
        <span className="strip" />
        <span className="k">今日出价</span>
        <div>
          <span className="v">{metrics.total_bids_today}</span>
          {typeof metrics.total_events_today === 'number' && (
            <span className="sub">{metrics.total_events_today} 条行为</span>
          )}
        </div>
      </div>
      <div className={`telemetry-cell ${infraTone}`}>
        <span className="strip" />
        <span className="k">基础设施</span>
        <span className={`v ${infraTone}`} style={{ fontSize: 14, letterSpacing: '0.08em' }}>
          {infraLabel}
        </span>
      </div>
      <div className={`telemetry-cell ${alertTone}`}>
        <span className="strip" />
        <span className="k">告警</span>
        <span className={`v ${alertTone}`}>{alertCount}</span>
      </div>
    </div>
  )
}

function ConsoleStatus({ status }: { status: Auction['status'] }) {
  const label =
    status === 'active' ? '进行中' : status === 'pending' ? '待开始' : status === 'finished' ? '已成交' : '已停止'
  return (
    <span className={`console-status ${status === 'active' ? 'live' : status}`}>
      <span className="dot" />
      {label}
    </span>
  )
}

function demoUserRoleLabel(role: DemoUser['role']): string {
  return role === 'merchant' ? '商家' : '买家'
}

function alertSeverityLabel(severity: AdminAlert['severity']): string {
  if (severity === 'critical') return '严重告警'
  if (severity === 'warning') return '风险提示'
  return '提示'
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const r = (e as { response?: { data?: { error?: string } } }).response
    return r?.data?.error ?? '请求失败'
  }
  return String(e)
}
