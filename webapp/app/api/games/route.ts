import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const games = await prisma.game.findMany({
    include: {
      tasks: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(games)
}
