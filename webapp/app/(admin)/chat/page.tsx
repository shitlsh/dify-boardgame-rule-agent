import { prisma } from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const GAME_TYPE_LABEL: Record<string, string> = {
  general: '通用',
  'deck-building': '卡牌构建',
  'worker-placement': '工人放置',
  cooperative: '合作类',
  'area-control': '区域控制',
  'engine-building': '引擎构建',
  'dungeon-crawler': '地牢爬行',
}

export default async function AdminChatLobbyPage() {
  const games = await prisma.game.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const readyGames = games.filter((g) => g.datasetId)
  const pendingGames = games.filter((g) => !g.datasetId)

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">规则问答测试</h1>
      <p className="text-gray-500 text-sm mb-6">
        两步流程：检索知识库片段 → 注入 Chatbot 的 <code className="text-xs bg-gray-100 px-1 rounded">context</code>{' '}
        输入项后流式回答。仅用于管理员验证流程。
      </p>

      {readyGames.length === 0 && pendingGames.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 border border-dashed border-gray-200 rounded-xl bg-white">
          <span className="text-5xl mb-3">🎲</span>
          <p className="text-sm mb-4">暂无游戏，请先添加并完成建库</p>
          <Link
            href="/games/new"
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            添加游戏
          </Link>
        </div>
      ) : (
        <>
          {readyGames.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                可测试问答
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {readyGames.map((game) => (
                  <Link
                    key={game.id}
                    href={`/chat/${game.id}`}
                    className="group flex flex-col bg-white rounded-xl border border-gray-200 hover:border-indigo-400 hover:shadow-md transition-all overflow-hidden"
                  >
                    <div className="h-28 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
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
                    <div className="p-3 flex flex-col gap-1">
                      <p className="font-medium text-sm text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                        {game.name}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400">
                          {GAME_TYPE_LABEL[game.gameType] ?? game.gameType}
                        </span>
                        {game.playerCount && (
                          <>
                            <span className="text-gray-200">·</span>
                            <span className="text-xs text-gray-400">{game.playerCount} 人</span>
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
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                建库中（暂不可测）
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {pendingGames.map((game) => (
                  <div
                    key={game.id}
                    className="flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden opacity-50 cursor-not-allowed"
                  >
                    <div className="h-28 bg-gray-100 flex items-center justify-center">
                      <span className="text-4xl grayscale">🎲</span>
                    </div>
                    <div className="p-3 flex flex-col gap-1">
                      <p className="font-medium text-sm text-gray-900 truncate">{game.name}</p>
                      <span className="text-xs text-gray-400">知识库建立中...</span>
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
