import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { tasks: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  return NextResponse.json(game)
}

/** Update display-only fields (name, cover, player count, type). Does not touch Dify dataset. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '无效的 JSON' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '请求体无效' }, { status: 400 })
  }

  const { name, coverUrl: coverRaw, playerCount, gameType } = body as Record<string, unknown>

  const data: {
    name?: string
    coverUrl?: string | null
    playerCount?: string | null
    gameType?: string
  } = {}

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: '游戏名称不能为空' }, { status: 400 })
    }
    data.name = name.trim()
  }

  if (coverRaw !== undefined) {
    if (coverRaw === null || coverRaw === '') {
      data.coverUrl = null
    } else if (typeof coverRaw === 'string') {
      const t = coverRaw.trim()
      if (!t) {
        data.coverUrl = null
      } else {
        try {
          const u = new URL(t)
          if (u.protocol !== 'http:' && u.protocol !== 'https:') {
            return NextResponse.json({ error: '封面地址需为 http 或 https 链接' }, { status: 400 })
          }
          data.coverUrl = u.toString()
        } catch {
          return NextResponse.json({ error: '封面地址格式无效' }, { status: 400 })
        }
      }
    } else {
      return NextResponse.json({ error: '封面地址格式无效' }, { status: 400 })
    }
  }

  if (playerCount !== undefined) {
    if (playerCount === null || playerCount === '') {
      data.playerCount = null
    } else if (typeof playerCount === 'string') {
      data.playerCount = playerCount.trim() || null
    } else {
      return NextResponse.json({ error: '人数格式无效' }, { status: 400 })
    }
  }

  if (gameType !== undefined) {
    if (typeof gameType !== 'string' || !gameType.trim()) {
      return NextResponse.json({ error: '游戏类型无效' }, { status: 400 })
    }
    data.gameType = gameType.trim()
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 })
  }

  try {
    const game = await prisma.game.update({
      where: { id: gameId },
      data,
    })
    return NextResponse.json(game)
  } catch {
    return NextResponse.json({ error: '游戏不存在或更新失败' }, { status: 404 })
  }
}
