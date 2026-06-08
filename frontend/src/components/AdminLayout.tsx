import type { ReactNode } from 'react'
import { AdminSidebar } from './AdminSidebar'

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <AdminSidebar />
      <main className="flex-1 min-w-0 overflow-x-auto">{children}</main>
    </div>
  )
}
