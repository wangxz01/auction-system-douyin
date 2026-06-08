import type { ReactNode } from 'react'
import { useTitle } from '../lib/useTitle'

// 仅在桌面端（md+）显示 iPhone 形状的边框，
// 移动设备宽度 <768px 时变成 pass-through，不影响真机体验。
export function PhoneFrame({ children }: { children: ReactNode }) {
  useTitle('Auction — 用户版')
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
