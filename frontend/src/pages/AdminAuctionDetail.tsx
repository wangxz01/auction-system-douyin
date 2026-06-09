import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Auction, Bid, Order } from '../lib/types'
import { StatusBadge } from '../components/StatusBadge'
import { paddleNumberOf } from '../lib/paddle'

export function AdminAuctionDetail() {
  const { id } = useParams<{ id: string }>()
  const auctionId = Number(id)
  const nav = useNavigate()

  const [auction, setAuction] = useState<Auction | null>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    image_url: '',
    stream_url: '',
    start_price: 0,
    price_step: 10,
    ceiling_price: '',
    duration_seconds: 300,
    auto_extend_seconds: 30,
  })

  const load = useCallback(() => {
    Promise.all([
      api.get<{ data: Auction }>(`/auctions/${auctionId}`),
      api.get<{ data: Bid[] }>(`/auctions/${auctionId}/bids`),
    ])
      .then(([a, b]) => {
        setAuction(a.data.data)
        setEditForm({
          title: a.data.data.title,
          description: a.data.data.description,
          image_url: a.data.data.image_url,
          stream_url: a.data.data.stream_url,
          start_price: a.data.data.start_price,
          price_step: a.data.data.price_step,
          ceiling_price: a.data.data.ceiling_price ? String(a.data.data.ceiling_price) : '',
          duration_seconds: a.data.data.duration_seconds,
          auto_extend_seconds: a.data.data.auto_extend_seconds ?? 30,
        })
        setBids(b.data.data)
        if (a.data.data.status === 'finished') {
          api
            .get<{ data: Order }>(`/auctions/${auctionId}/order`)
            .then((o) => setOrder(o.data.data))
            .catch(() => setOrder(null))
        }
        setError(null)
      })
      .catch((e) => setError(extractError(e)))
      .finally(() => setLoading(false))
  }, [auctionId])

  useEffect(() => {
    load()
  }, [load])

  const onStart = async () => {
    try {
      await api.post(`/auctions/${auctionId}/start`)
      load()
    } catch (e) {
      alert(extractError(e))
    }
  }

  const onCancel = async () => {
    if (!confirm('确认取消该竞拍？此操作不可撤销。')) return
    try {
      await api.post(`/auctions/${auctionId}/cancel`)
      load()
    } catch (e) {
      alert(extractError(e))
    }
  }

  const updateEdit = (k: keyof typeof editForm, v: string | number) => {
    setEditForm({ ...editForm, [k]: v })
  }

  const onSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const body: Record<string, unknown> = {
        title: editForm.title,
        description: editForm.description,
        image_url: editForm.image_url,
        stream_url: editForm.stream_url,
        start_price: Number(editForm.start_price),
        price_step: Number(editForm.price_step),
        duration_seconds: Number(editForm.duration_seconds),
        auto_extend_seconds: Number(editForm.auto_extend_seconds),
      }
      if (editForm.ceiling_price !== '') body.ceiling_price = Number(editForm.ceiling_price)
      await api.put(`/auctions/${auctionId}`, body)
      setEditing(false)
      load()
    } catch (e) {
      alert(extractError(e))
    }
  }

  if (loading)
    return <div className="p-12 text-center text-[#8E8E93]">加载中...</div>
  if (error)
    return (
      <div className="p-12 text-center text-[#FF3B30]">
        {error}
        <div className="mt-4">
          <button onClick={() => nav('/admin')} className="btn-default px-4 py-2 rounded-full text-sm">
            返回列表
          </button>
        </div>
      </div>
    )
  if (!auction) return null

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <Link to="/admin" className="text-xs text-[#FF9500] mb-2 inline-block">
        ← 返回列表
      </Link>

      <div className="admin-page-header">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="ios-large-title">{auction.title}</h1>
            <StatusBadge status={auction.status} />
          </div>
          <p className="text-sm text-[#8E8E93] mt-1">竞拍 #{auction.id}</p>
        </div>

        <div className="flex gap-2">
          {auction.status === 'pending' && (
            <>
              <button onClick={onStart} className="btn-accent px-5 py-2 rounded-full text-sm">
                ▶ 开始竞拍
              </button>
              <button onClick={() => setEditing((v) => !v)} className="btn-default px-5 py-2 rounded-full text-sm">
                {editing ? '收起编辑' : '编辑规则'}
              </button>
              <button onClick={onCancel} className="btn-default px-5 py-2 rounded-full text-sm">
                取消
              </button>
            </>
          )}
          {auction.status === 'active' && (
            <button onClick={onCancel} className="btn-danger px-5 py-2 rounded-full text-sm">
              强制取消
            </button>
          )}
          {(auction.status === 'finished' || auction.status === 'cancelled') && (
            <span className="text-[#8E8E93] text-sm self-center">竞拍已结束</span>
          )}
        </div>
      </div>

      {auction.status === 'pending' && editing && (
        <form onSubmit={onSaveEdit} className="mb-6">
          <div className="ios-section-header" style={{ padding: '0 4px 8px' }}>编辑未开始竞拍</div>
          <div className="ios-list ios-list-flush">
            <EditInput label="名称" value={editForm.title} onChange={(v) => updateEdit('title', v)} />
            <EditInput label="图片 URL" value={editForm.image_url} onChange={(v) => updateEdit('image_url', v)} />
            <EditInput label="推流地址" value={editForm.stream_url} onChange={(v) => updateEdit('stream_url', v)} />
            <EditInput label="起拍价" type="number" value={String(editForm.start_price)} onChange={(v) => updateEdit('start_price', v)} suffix="¥" />
            <EditInput label="加价幅度" type="number" value={String(editForm.price_step)} onChange={(v) => updateEdit('price_step', v)} suffix="¥" />
            <EditInput label="封顶价" type="number" value={editForm.ceiling_price} onChange={(v) => updateEdit('ceiling_price', v)} suffix="¥" />
            <EditInput label="竞拍时长" type="number" value={String(editForm.duration_seconds)} onChange={(v) => updateEdit('duration_seconds', v)} suffix="秒" />
            <EditInput label="延时机制" type="number" value={String(editForm.auto_extend_seconds)} onChange={(v) => updateEdit('auto_extend_seconds', v)} suffix="秒" min={10} max={30} step="1" />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setEditing(false)} className="btn-default px-5 py-2 rounded-full text-sm">
              取消编辑
            </button>
            <button type="submit" className="btn-accent px-5 py-2 rounded-full text-sm">
              保存修改
            </button>
          </div>
        </form>
      )}

      {/* 商品信息 */}
      <div className="ios-section-header" style={{ padding: '0 4px 8px' }}>商品信息</div>
      <div className="bg-white rounded-2xl overflow-hidden">
        {auction.image_url && (
          <img
            src={auction.image_url}
            alt={auction.title}
            loading="lazy"
            decoding="async"
            width={1280}
            height={500}
            className="w-full h-56 object-cover bg-[#F2F2F7]"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        )}
        <div className="ios-list ios-list-flush">
          <Row label="名称" value={auction.title} />
          <Row label="图片 URL" value={auction.image_url || '—'} mono />
          <Row
            label="推流地址"
            value={auction.stream_url || '— (使用默认演示视频)'}
            mono
          />
          {auction.description && <Row label="描述" value={auction.description} multiline />}
        </div>
      </div>

      {/* 价格规则 */}
      <div className="ios-section-header mt-6" style={{ padding: '0 4px 8px' }}>价格规则</div>
      <div className="ios-list ios-list-flush">
        <Row label="起拍价" value={`¥${auction.start_price}`} />
        <Row label="加价幅度" value={`¥${auction.price_step}`} />
        <Row
          label="封顶价"
          value={auction.ceiling_price ? `¥${auction.ceiling_price}` : '无封顶'}
        />
        <Row label="持续时长" value={`${auction.duration_seconds} 秒`} />
        <Row label="延时机制" value={`${auction.auto_extend_seconds ?? 30} 秒`} />
        <Row
          label="当前最高价"
          value={
            <span className="text-[#FF9500] text-base font-bold">¥{auction.current_price}</span>
          }
        />
        <Row label="领先者" value={auction.winner_id ? paddleNumberOf(auction.winner_id) : '尚无'} />
      </div>

      {/* 时间 */}
      <div className="ios-section-header mt-6" style={{ padding: '0 4px 8px' }}>时间</div>
      <div className="ios-list ios-list-flush">
        <Row label="创建于" value={fmt(auction.created_at)} mono />
        <Row label="开始于" value={fmt(auction.started_at)} mono />
        <Row label="结束于" value={fmt(auction.ends_at)} mono />
      </div>

      {/* 出价历史 */}
      <div className="ios-section-header mt-6" style={{ padding: '0 4px 8px' }}>
        <span>出价历史</span>
        <span className="text-[#8E8E93]">{bids.length} 条</span>
      </div>
      {bids.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-[#8E8E93] text-sm">
          还没有出价
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden">
          {bids.slice(0, 30).map((b, i) => (
            <div
              key={b.id}
              className="ios-list-item"
              style={{ borderTop: i === 0 ? 'none' : undefined }}
            >
              <span className="w-8 text-xs text-[#8E8E93]">#{i + 1}</span>
              <span className="flex-1 text-[15px]">{paddleNumberOf(b.user_id)}</span>
              <span className="font-semibold">¥{b.amount}</span>
              <span className="text-xs text-[#8E8E93] w-32 text-right">
                {fmt(b.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 订单 */}
      <div className="ios-section-header mt-6" style={{ padding: '0 4px 8px' }}>订单</div>
      {order ? (
        <div className="ios-list ios-list-flush">
          <Row label="订单号" value={`#${order.id}`} mono />
          <Row label="买家" value={paddleNumberOf(order.user_id)} />
          <Row
            label="成交价"
            value={
              <span className="text-[#FF9500] text-base font-bold">¥{order.final_price}</span>
            }
          />
          <Row label="状态" value={order.status} />
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-10 text-center text-[#8E8E93] text-sm">
          {auction.status === 'finished'
            ? '订单尚未生成或加载失败'
            : '竞拍结束后会自动生成订单'}
        </div>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  mono,
  multiline,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  multiline?: boolean
}) {
  return (
    <div className="ios-list-item" style={multiline ? { alignItems: 'flex-start', paddingTop: 14, paddingBottom: 14 } : undefined}>
      <span className="text-[#000] w-28 shrink-0 text-[15px]">{label}</span>
      <span
        className={`flex-1 text-[15px] text-right text-[#3C3C43] ${
          mono ? 'font-mono text-[13px]' : ''
        } ${multiline ? 'text-left whitespace-pre-line' : 'truncate'}`}
      >
        {value}
      </span>
    </div>
  )
}

function EditInput({
  label,
  value,
  onChange,
  type = 'text',
  suffix,
  min,
  max,
  step,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  suffix?: string
  min?: number
  max?: number
  step?: string
}) {
  return (
    <label className="ios-list-item">
      <span className="text-[#000] w-28 shrink-0 text-[15px]">{label}</span>
      <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          step={step ?? (type === 'number' ? '0.01' : undefined)}
          className="flex-1 bg-transparent outline-none text-right text-[15px] placeholder:text-[#C7C7CC]"
        />
        {suffix && <span className="text-[#8E8E93] text-[13px]">{suffix}</span>}
      </div>
    </label>
  )
}

function fmt(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function pad(n: number) {
  return n.toString().padStart(2, '0')
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const r = (e as { response?: { data?: { error?: string } } }).response
    return r?.data?.error ?? '请求失败'
  }
  return String(e)
}
