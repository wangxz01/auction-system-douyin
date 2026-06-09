import type { ReactNode } from 'react'
import { AdminSidebar } from './AdminSidebar'
import { useTitle } from '../lib/useTitle'

export function AdminLayout({ children }: { children: ReactNode }) {
  useTitle('Auction — 商家版')
  // 不显式设背景，让 body 的暖色 mesh 透过来，给左栏玻璃提供可模糊的内容
  return (
    <div className="min-h-screen flex surface-console">
      <AdminSidebar />
      <main className="flex-1 min-w-0 overflow-x-auto">{children}</main>
    </div>
  )
}
