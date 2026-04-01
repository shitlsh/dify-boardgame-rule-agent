'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/dashboard', label: '游戏管理', match: (p: string) => p === '/dashboard' },
  { href: '/chat', label: '规则助手', match: (p: string) => p === '/chat' || p.startsWith('/chat/') },
]

export function AdminSidebar() {
  const pathname = usePathname() ?? ''

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-slate-200/80 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white shadow-[4px_0_24px_-8px_rgba(15,23,42,0.35)]">
      <div className="px-4 py-6 lg:px-5 lg:py-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xl shadow-inner ring-1 ring-white/10">
            🎲
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-white">桌游规则助手</p>
            <p className="mt-0.5 text-[11px] text-slate-400">管理后台</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 pb-6">
        {items.map(({ href, label, match }) => {
          const active = match(pathname)
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? 'bg-white/12 text-white shadow-sm ring-1 ring-white/10'
                  : 'text-slate-300 hover:bg-white/8 hover:text-white'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
