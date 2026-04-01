import { prisma } from '@/lib/db'
import Link from 'next/link'
import { GAME_TYPE_LABEL } from '@/lib/game-types'

export const dynamic = 'force-dynamic'

export default async function AdminChatLobbyPage() {
  const games = await prisma.game.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const readyGames = games.filter((g) => g.datasetId)
  const pendingGames = games.filter((g) => !g.datasetId)

  return (
    <div className="mx-auto max-w-4xl pb-4 pt-1">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-slate-900">规则助手</h1>
      <p className="mb-8 text-sm leading-relaxed text-slate-500">
        选择一款游戏，用自然语言提问即可。
      </p>

      {readyGames.length === 0 && pendingGames.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-20 text-gray-400">
          <span className="mb-3 text-5xl">🎲</span>
          <p className="mb-4 text-sm">暂无游戏，请先在「游戏管理」中添加并完成整理</p>
          <Link
            href="/dashboard?add=1"
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            添加游戏
          </Link>
        </div>
      ) : (
        <>
          {readyGames.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                可选游戏
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {readyGames.map((game) => (
                  <Link
                    key={game.id}
                    href={`/chat/${game.id}`}
                    className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:border-indigo-400 hover:shadow-md"
                  >
                    <div className="flex h-28 items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100">
                      {game.coverUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={game.coverUrl}
                          alt={game.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-4xl">🎲</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 p-3">
                      <p className="truncate text-sm font-medium text-gray-900 transition-colors group-hover:text-indigo-600">
                        {game.name}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400">
                          {GAME_TYPE_LABEL[game.gameType] ?? game.gameType}
                        </span>
                        {game.playerCount && (
                          <>
                            <span className="text-gray-200">·</span>
                            <span className="text-xs text-gray-400">{game.playerCount}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {pendingGames.length > 0 && (
            <section>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                整理中
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {pendingGames.map((game) => (
                  <div
                    key={game.id}
                    className="flex cursor-not-allowed flex-col overflow-hidden rounded-xl border border-gray-200 bg-white opacity-50"
                  >
                    <div className="flex h-28 items-center justify-center bg-gray-100">
                      <span className="text-4xl grayscale">🎲</span>
                    </div>
                    <div className="flex flex-col gap-1 p-3">
                      <p className="truncate text-sm font-medium text-gray-900">{game.name}</p>
                      <span className="text-xs text-gray-400">规则整理中，请稍候…</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
