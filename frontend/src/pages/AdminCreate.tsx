import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

export function AdminCreate() {
  const nav = useNavigate()
  const [form, setForm] = useState({
    title: '',
    description: '',
    image_url: '',
    stream_url: '',
    start_price: 0,
    price_step: 10,
    ceiling_price: '',
    duration_seconds: 300,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (k: keyof typeof form, v: string | number) => setForm({ ...form, [k]: v })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        image_url: form.image_url,
        stream_url: form.stream_url,
        start_price: Number(form.start_price),
        price_step: Number(form.price_step),
        duration_seconds: Number(form.duration_seconds),
      }
      if (form.ceiling_price !== '') body.ceiling_price = Number(form.ceiling_price)
      await api.post('/auctions', body)
      nav('/admin')
    } catch (e: unknown) {
      const r = (e as { response?: { data?: { error?: string } } }).response
      setError(r?.data?.error ?? '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-8">
      <div className="admin-page-header">
        <div>
          <h1 className="ios-large-title">发布新竞拍</h1>
          <p className="text-sm text-[#8E8E93] mt-1">填写商品信息与竞拍规则</p>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        {/* 商品信息 */}
        <div className="ios-section-header" style={{ padding: '0 4px 8px' }}>商品信息</div>
        <div className="ios-list ios-list-flush">
          <RowInput
            label="商品名称"
            value={form.title}
            onChange={(v) => update('title', v)}
            required
            placeholder="必填"
          />
          <RowTextarea
            label="商品描述"
            value={form.description}
            onChange={(v) => update('description', v)}
            placeholder="选填"
          />
          <RowInput
            label="图片 URL"
            value={form.image_url}
            onChange={(v) => update('image_url', v)}
            placeholder="https://..."
            type="url"
          />
        </div>

        {/* 直播配置 */}
        <div className="ios-section-header mt-6" style={{ padding: '0 4px 8px' }}>
          直播
        </div>
        <div className="ios-list ios-list-flush">
          <RowInput
            label="推流地址"
            value={form.stream_url}
            onChange={(v) => update('stream_url', v)}
            placeholder="留空 = 使用默认演示视频"
            type="url"
          />
        </div>
        <div className="text-[11px] text-[#8E8E93] mt-1.5 px-1">
          填写 HLS 播放地址（.m3u8），留空则使用默认演示视频
        </div>

        {/* 价格规则 */}
        <div className="ios-section-header mt-6" style={{ padding: '0 4px 8px' }}>价格规则</div>
        <div className="ios-list ios-list-flush">
          <RowInput
            label="起拍价"
            value={String(form.start_price)}
            onChange={(v) => update('start_price', v)}
            type="number"
            suffix="¥"
          />
          <RowInput
            label="加价幅度"
            value={String(form.price_step)}
            onChange={(v) => update('price_step', v)}
            type="number"
            required
            suffix="¥"
            placeholder="必填"
          />
          <RowInput
            label="封顶价"
            value={form.ceiling_price}
            onChange={(v) => update('ceiling_price', v)}
            type="number"
            suffix="¥"
            placeholder="留空 = 无封顶"
          />
        </div>

        {/* 持续时长 */}
        <div className="ios-section-header mt-6" style={{ padding: '0 4px 8px' }}>持续时间</div>
        <div className="ios-list ios-list-flush">
          <RowInput
            label="竞拍时长"
            value={String(form.duration_seconds)}
            onChange={(v) => update('duration_seconds', v)}
            type="number"
            required
            suffix="秒"
            placeholder="必填"
          />
        </div>

        {error && (
          <div className="mt-6 rounded-xl px-4 py-3 bg-[#FFE5E5] text-[#FF3B30] text-sm">
            ⚠ {error}
          </div>
        )}

        <div className="flex gap-3 mt-8">
          <button
            type="button"
            onClick={() => nav('/admin')}
            className="btn-default flex-1 py-3 rounded-full text-sm"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-accent flex-1 py-3 rounded-full text-sm"
          >
            {submitting ? '提交中...' : '发布竞拍'}
          </button>
        </div>
      </form>
    </div>
  )
}

function RowInput({
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
  suffix,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  placeholder?: string
  suffix?: string
}) {
  return (
    <label className="ios-list-item">
      <span className="text-[#000] w-28 shrink-0 text-[15px]">
        {label}
        {required && <span className="text-[#FF3B30] ml-1">*</span>}
      </span>
      <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          step={type === 'number' ? '0.01' : undefined}
          className="flex-1 bg-transparent outline-none text-right text-[15px] placeholder:text-[#C7C7CC]"
        />
        {suffix && <span className="text-[#8E8E93] text-[13px]">{suffix}</span>}
      </div>
    </label>
  )
}

function RowTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="ios-list-item items-start" style={{ alignItems: 'flex-start', paddingTop: 14, paddingBottom: 14 }}>
      <span className="text-[#000] w-28 shrink-0 text-[15px] pt-0.5">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="flex-1 bg-transparent outline-none text-right text-[15px] placeholder:text-[#C7C7CC] resize-none"
      />
    </label>
  )
}
