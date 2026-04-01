'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RebuildKbButton } from './RebuildKbButton'
import { TaskRefresher } from './TaskRefresher'
import { GAME_TYPE_LABEL } from '@/lib/game-types'
import { AddGameModal } from './AddGameModal'
import { EditGameModal, type EditGamePayload } from './EditGameModal'
import { tableActionButtonClass, tableActionColumnClass } from './action-styles'

export type DashboardGameRow = {
  id: string
  name: string
  slug: string
  coverUrl: string | null
  playerCount: string | null
  gameType: string
  datasetId: string | null
  version: number
  rulesMarkdownPath: string | null
  createdAt: string
  tasks: { status: string; errorMsg: string | null }[]
  /** 服务端计算：本地是否已有规则文件可重建 */
  canRebuild: boolean
}

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  PROCESSING: 'bg-blue-100 text-blue-700 animate-pulse',
  PENDING: 'bg-amber-100 text-amber-700',
  FAILED: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: '已完成',
  PROCESSING: '处理中',
  PENDING: '等待中',
  FAILED: '失败',
}

type Props = {
  games: DashboardGameRow[]
}

export function DashboardClient({ games }: Props) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<EditGamePayload | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('add') === '1') setAddOpen(true)
    const eid = params.get('edit')
    if (eid) {
      const g = games.find((x) => x.id === eid)
      if (g) {
        setEditing({
          id: g.id,
          name: g.name,
          coverUrl: g.coverUrl,
          playerCount: g.playerCount,
          gameType: g.gameType,
        })
        setEditOpen(true)
      }
    }
    if (params.get('add') === '1' || params.get('edit')) {
      router.replace('/dashboard', { scroll: false })
    }
    // 仅处理 URL 中的打开指令一次（首屏）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasActiveTasks = games.some((g) => {
    const s = g.tasks[0]?.status
    return s === 'PENDING' || s === 'PROCESSING'
  })

  function openEdit(g: DashboardGameRow) {
    setEditing({
      id: g.id,
      name: g.name,
      coverUrl: g.coverUrl,
      playerCount: g.playerCount,
      gameType: g.gameType,
    })
    setEditOpen(true)
  }

  function closeEdit() {
    setEditOpen(false)
    setEditing(null)
  }

  return (
    <>
      <TaskRefresher hasActiveTasks={hasActiveTasks} />

      <AddGameModal open={addOpen} onClose={() => setAddOpen(false)} />
      <EditGameModal game={editing} open={editOpen && editing !== null} onClose={closeEdit} />

      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">游戏管理</h1>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          添加游戏
        </button>
      </div>

      {games.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/80 py-28 text-slate-400">
          <span className="mb-4 text-6xl">🎲</span>
          <p className="mb-2 text-lg text-slate-600">还没有游戏</p>
          <p className="mb-6 text-sm">添加一款游戏即可开始使用</p>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            添加游戏
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/90">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {' '}
                </th>
                <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  游戏名称
                </th>
                <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  类型
                </th>
                <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  知识库
                </th>
                <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  状态
                </th>
                <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  版本
                </th>
                <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  添加时间
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {games.map((game) => {
                const task = game.tasks[0]
                const status = task?.status ?? null
                const canRebuild = game.canRebuild
                return (
                  <tr key={game.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="w-12 px-4 py-2">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                        {game.coverUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={game.coverUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-lg">🎲</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(game)}
                        className="text-left font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {game.name}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {GAME_TYPE_LABEL[game.gameType] ?? game.gameType}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {game.datasetId ? (
                        <span className="text-emerald-700">已建立</span>
                      ) : (
                        <span className="text-slate-400">未建立</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {status ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {STATUS_LABEL[status] ?? status}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                      {status === 'FAILED' && task?.errorMsg && (
                        <p
                          className="mt-1 max-w-[240px] truncate text-xs text-red-500"
                          title={task.errorMsg}
                        >
                          {task.errorMsg}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">V{game.version}</td>
                    <td className="px-3 py-3 text-slate-500">
                      {new Date(game.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className={tableActionColumnClass}>
                        <button
                          type="button"
                          onClick={() => openEdit(game)}
                          className={tableActionButtonClass}
                        >
                          编辑信息
                        </button>
                        <RebuildKbButton gameId={game.id} canRebuild={canRebuild} />
                      </div>
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
