import Link from 'next/link'

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top nav */}
      <header className="h-12 shrink-0 bg-white border-b border-gray-200 flex items-center px-5 gap-4">
        <Link href="/" className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors">
          <span className="text-xl">🎲</span>
          <span className="font-semibold text-sm">桌游规则助手</span>
        </Link>
        <span className="text-gray-300 text-sm">|</span>
        <Link
          href="/dashboard"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          管理后台 →
        </Link>
      </header>

      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
