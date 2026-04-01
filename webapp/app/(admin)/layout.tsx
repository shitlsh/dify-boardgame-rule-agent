import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { ConnectionStatus } from '@/components/admin/ConnectionStatus'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-100/90">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-auto px-6 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
      <ConnectionStatus />
    </div>
  )
}
