import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { slugify } from '@/lib/utils'
import { runETL } from '@/lib/dify/etl'
import { prepareWorkflowFilesFromSource } from '@/lib/dify/input-preprocess'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const gameId = searchParams.get('gameId')

  const tasks = await prisma.task.findMany({
    where: gameId ? { gameId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: '请求格式错误，需要 multipart/form-data' }, { status: 400 })
  }

  const gameName = (formData.get('gameName') as string | null)?.trim()
  const gameType = (formData.get('gameType') as string | null) ?? 'general'
  const sourceType = (formData.get('sourceType') as string | null) ?? 'url'
  const sourceUrl = (formData.get('sourceUrl') as string | null)?.trim() ?? null
  const sourceFile = (formData.get('sourceFile') as File | null) ?? null

  if (!gameName) {
    return NextResponse.json({ error: '游戏名称不能为空' }, { status: 400 })
  }

  const slug = slugify(gameName)

  // Upsert game — allows re-ingestion (version bumps automatically)
  const existingGame = await prisma.game.findUnique({ where: { slug } })
  const newVersion = (existingGame?.version ?? 0) + 1

  const game = await prisma.game.upsert({
    where: { slug },
    update: { name: gameName, gameType, version: newVersion, updatedAt: new Date() },
    create: { name: gameName, slug, gameType, version: newVersion },
  })

  const task = await prisma.task.create({
    data: { gameId: game.id, status: 'PENDING' },
  })

  let ruleFiles
  try {
    ruleFiles = await prepareWorkflowFilesFromSource({ sourceType, sourceUrl, sourceFile })
  } catch (err) {
    const message = err instanceof Error ? err.message : '规则文件预处理失败'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Fire-and-forget ETL — non-blocking response to client.
  // NOTE: This works for local `next dev`. On serverless (Vercel/Edge), requests
  // are terminated after response; use a proper job queue for production.
  void runETL(task.id, game.id, {
    slug,
    gameName,
    ruleFiles,
    version: newVersion,
  })

  return NextResponse.json({ taskId: task.id, gameId: game.id }, { status: 202 })
}
