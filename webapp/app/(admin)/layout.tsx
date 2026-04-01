import Link from 'next/link'

const isMock = process.env.DIFY_MOCK_MODE === 'true'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-200">
          <span className="text-xl mr-2">🎲</span>
          <span className="font-bold text-gray-900 text-sm">桌游管理后台</span>
        </div>

        <nav className="p-3 flex flex-col gap-1 flex-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            📚 游戏库
          </Link>
          <Link
            href="/games/new"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            ＋ 添加游戏
          </Link>
          <Link
            href="/chat"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            💬 规则问答测试
          </Link>
        </nav>

        {/* Mock mode indicator */}
        <div className="p-3 border-t border-gray-100">
          {isMock ? (
            <span className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-amber-50 text-amber-700 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Mock 模式
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-green-50 text-green-700 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              Dify 已连接
            </span>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  )
}
