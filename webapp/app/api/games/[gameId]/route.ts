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
