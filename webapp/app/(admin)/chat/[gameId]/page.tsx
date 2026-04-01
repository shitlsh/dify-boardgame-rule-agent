import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChatRoomClient } from '@/components/chat/ChatRoomClient'

interface Props {
  params: Promise<{ gameId: string }>
}

export default async function AdminChatRoomPage({ params }: Props) {
  const { gameId } = await params
  const game = await prisma.game.findUnique({ where: { id: gameId } })

  if (!game) notFound()

  if (!game.datasetId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-gray-500">
        <span className="text-5xl">⏳</span>
        <p className="font-medium">知识库尚未建立完成</p>
        <p className="text-sm text-gray-400">请等待 ETL 完成后再测试问答</p>
        <Link
          href="/chat"
          className="mt-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
        >
          返回测试大厅
        </Link>
      </div>
    )
  }

  return (
    <ChatRoomClient
      gameId={game.id}
      gameName={game.name}
      quickStartGuide={game.quickStartGuide ?? ''}
    />
  )
}
