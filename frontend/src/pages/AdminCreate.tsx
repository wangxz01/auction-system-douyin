import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

export function AdminCreate() {
  const nav = useNavigate()
  const [form, setForm] = useState({
    title: '',
    description: '',
    image_url: '',
    start_price: 0,
    price_step: 10,
    ceiling_price: '',
    duration_seconds: 300,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onChange =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [k]: e.target.value })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        image_url: form.image_url,
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">发布新竞拍</h1>
        <p className="text-sm text-ink-500 mt-1">填写商品信息和竞拍规则</p>
      </div>

      <form onSubmit={onSubmit} className="card p-6 space-y-4">
        <Field label="商品名称" required>
          <input
            type="text"
            value={form.title}
            onChange={onChange('title')}
            required
            className="input-default"
          />
        </Field>
        <Field label="商品描述">
          <textarea
            value={form.description}
            onChange={onChange('description')}
            rows={3}
            className="input-default resize-none"
          />
        </Field>
        <Field label="图片 URL">
          <input
            type="url"
            value={form.image_url}
            onChange={onChange('image_url')}
            placeholder="https://..."
            className="input-default"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="起拍价 (¥)">
            <input
              type="number"
              value={form.start_price}
              onChange={onChange('start_price')}
              min={0}
              step="0.01"
              className="input-default"
            />
          </Field>
          <Field label="加价幅度 (¥)" required>
            <input
              type="number"
              value={form.price_step}
              onChange={onChange('price_step')}
              min={0.01}
              step="0.01"
              required
              className="input-default"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="封顶价 (¥, 选填)">
            <input
              type="number"
              value={form.ceiling_price}
              onChange={onChange('ceiling_price')}
              min={0}
              step="0.01"
              placeholder="留空则无封顶"
              className="input-default"
            />
          </Field>
          <Field label="竞拍时长 (秒)" required>
            <input
              type="number"
              value={form.duration_seconds}
              onChange={onChange('duration_seconds')}
              min={1}
              required
              className="input-default"
            />
          </Field>
        </div>

        {error && (
          <div className="text-rose-600 text-sm bg-rose-50 rounded-xl px-3 py-2 border border-rose-200">
            ⚠ {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
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

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <div className="text-sm text-ink-700 mb-1.5 font-medium">
        {label}
        {required && <span className="text-accent-600 ml-1">*</span>}
      </div>
      {children}
    </label>
  )
}
