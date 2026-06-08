import type { ReactNode } from 'react'
import { useTitle } from '../lib/useTitle'

// 桌面端显示 iPhone 形状的预览外壳；真实手机 UA 直接展示移动端页面。
export function PhoneFrame({ children }: { children: ReactNode }) {
  useTitle('Auction — 用户版')
  if (isMobileUA()) {
    return <>{children}</>
  }
  return (
    <div className="phone-wrap">
      <div className="phone-bezel">
        <div className="phone-screen">
          <div className="phone-content">{children}</div>
        </div>
      </div>
    </div>
  )
}

function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)
}
