import { prisma } from '@/lib/db'
import { readRulesMarkdown } from '@/lib/storage'
import { DashboardClient, type DashboardGameRow } from './_components/DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const games = await prisma.game.findMany({
    include: {
      tasks: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows: DashboardGameRow[] = games.map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    coverUrl: g.coverUrl,
    playerCount: g.playerCount,
    gameType: g.gameType,
    datasetId: g.datasetId,
    version: g.version,
    rulesMarkdownPath: g.rulesMarkdownPath,
    createdAt: g.createdAt.toISOString(),
    tasks: g.tasks.map((t) => ({ status: t.status, errorMsg: t.errorMsg })),
    canRebuild: !!readRulesMarkdown(g.slug, g.version, g.rulesMarkdownPath)?.trim(),
  }))

  return <DashboardClient games={rows} />
}
