import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChatRoomClient } from '@/components/chat/ChatRoomClient'
import type { Prisma } from '@prisma/client'

function startQuestionsFromJson(value: Prisma.JsonValue | null | undefined): string[] {
  if (value == null || !Array.isArray(value)) return []
  return value.filter((x): x is string => typeof x === 'string')
}

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
        <p className="font-medium">规则尚在整理中</p>
        <p className="text-sm text-gray-400">完成后即可在此提问，请稍候或返回查看进度</p>
        <Link
          href="/chat"
          className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white transition-colors hover:bg-indigo-700"
        >
          返回规则助手
        </Link>
      </div>
    )
  }

  return (
    <ChatRoomClient
      gameId={game.id}
      gameName={game.name}
      quickStartGuide={game.quickStartGuide ?? ''}
      startQuestions={startQuestionsFromJson(game.startQuestions)}
    />
  )
}
