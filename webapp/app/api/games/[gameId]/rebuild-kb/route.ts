import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readRulesMarkdown } from '@/lib/storage'
import { runKnowledgeBaseRebuild } from '@/lib/dify/rebuild-kb'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params

  const game = await prisma.game.findUnique({ where: { id: gameId } })
  if (!game) {
    return NextResponse.json({ error: '游戏不存在' }, { status: 404 })
  }

  const markdown = readRulesMarkdown(game.slug, game.version, game.rulesMarkdownPath)
  if (!markdown?.trim()) {
    return NextResponse.json(
      { error: '未找到本地规则 Markdown，请先完成一次完整提取' },
      { status: 400 },
    )
  }

  const latest = await prisma.task.findFirst({
    where: { gameId },
    orderBy: { createdAt: 'desc' },
  })
  if (latest?.status === 'PENDING' || latest?.status === 'PROCESSING') {
    return NextResponse.json({ error: '当前已有任务进行中，请稍后再试' }, { status: 409 })
  }

  const task = await prisma.task.create({
    data: { gameId, status: 'PENDING' },
  })

  void runKnowledgeBaseRebuild(task.id, gameId, {
    slug: game.slug,
    version: game.version,
    rulesMarkdownPath: game.rulesMarkdownPath,
  })

  return NextResponse.json({ taskId: task.id, gameId }, { status: 202 })
}
