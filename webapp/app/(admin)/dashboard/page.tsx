import { prisma } from '@/lib/db'
import Link from 'next/link'
import { readRulesMarkdown } from '@/lib/storage'
import { RebuildKbButton } from './_components/RebuildKbButton'
import { TaskRefresher } from './_components/TaskRefresher'

export const dynamic = 'force-dynamic'

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  PROCESSING: 'bg-blue-100 text-blue-700 animate-pulse',
  PENDING:    'bg-amber-100 text-amber-700',
  FAILED:     'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: '✓ 已完成',
  PROCESSING: '⟳ 处理中',
  PENDING:    '○ 等待中',
  FAILED:     '✕ 失败',
}

export default async function DashboardPage() {
  const games = await prisma.game.findMany({
    include: {
      tasks: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  })

  const hasActiveTasks = games.some((g) => {
    const s = g.tasks[0]?.status
    return s === 'PENDING' || s === 'PROCESSING'
  })

  return (
    <>
      {/* Auto-refresh while ETL tasks are running */}
      <TaskRefresher hasActiveTasks={hasActiveTasks} />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">游戏库</h1>
        <Link
          href="/games/new"
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          ＋ 添加游戏
        </Link>
      </div>

      {games.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-gray-400">
          <span className="text-6xl mb-4">🎲</span>
          <p className="text-lg mb-2">还没有游戏</p>
          <p className="text-sm">点击右上角「添加游戏」开始构建知识库</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-gray-500">游戏名称</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">类型</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Dataset ID</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">ETL 状态</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">版本</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">添加时间</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {games.map((game) => {
                const task = game.tasks[0]
                const status = task?.status ?? null
                const canRebuild =
                  !!readRulesMarkdown(game.slug, game.version, game.rulesMarkdownPath)?.trim()
                return (
                  <tr key={game.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{game.name}</td>
                    <td className="px-5 py-3 text-gray-500">{game.gameType}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-400 max-w-[200px] truncate">
                      {game.datasetId ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      {status ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {STATUS_LABEL[status] ?? status}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                      {status === 'FAILED' && task?.errorMsg && (
                        <p className="mt-1 text-xs text-red-500 max-w-[240px] truncate" title={task.errorMsg}>
                          {task.errorMsg}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-500">V{game.version}</td>
                    <td className="px-5 py-3 text-gray-400">
                      {new Date(game.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-5 py-3 align-top">
                      <RebuildKbButton gameId={game.id} canRebuild={canRebuild} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
