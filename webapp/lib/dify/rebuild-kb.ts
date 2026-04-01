/**
 * Knowledge-base-only rebuild: upload existing rules markdown to a new Dify dataset
 * without running the Extractor workflow (saves workflow/API cost).
 *
 * Deletes the previous dataset when `datasetId` exists, then creates + indexes + segment snapshot.
 */

import { prisma } from '@/lib/db'
import {
  createDataset,
  deleteDataset,
  uploadDocument,
  pollDocumentIndexing,
  exportSegments,
} from '@/lib/dify/datasets'
import { readRulesMarkdown, saveSegments } from '@/lib/storage'

export async function runKnowledgeBaseRebuild(
  taskId: string,
  gameId: string,
  params: { slug: string; version: number; rulesMarkdownPath?: string | null },
) {
  const { slug, version, rulesMarkdownPath } = params

  async function setStatus(status: string, errorMsg?: string) {
    await prisma.task.update({
      where: { id: taskId },
      data: { status, errorMsg: errorMsg ?? null, updatedAt: new Date() },
    })
  }

  try {
    await setStatus('PROCESSING')

    const markdown = readRulesMarkdown(slug, version, rulesMarkdownPath)
    if (!markdown?.trim()) {
      throw new Error('未找到本地规则 Markdown（rules_V*.md），请先完成一次完整提取')
    }

    const game = await prisma.game.findUnique({ where: { id: gameId } })
    if (!game) throw new Error('Game not found')

    const oldDatasetId = game.datasetId

    if (oldDatasetId) {
      try {
        await deleteDataset(oldDatasetId)
      } catch (e) {
        console.warn(`[rebuild-kb] deleteDataset ${oldDatasetId}:`, e)
      }
    }

    const datasetId = await createDataset(`${slug}-v${version}`)
    const uploaded = await uploadDocument(datasetId, markdown, `${slug}-rules-v${version}`)
    await pollDocumentIndexing(datasetId, uploaded)

    const segments = await exportSegments(datasetId, uploaded.documentId)
    saveSegments(slug, version, segments)

    await prisma.game.update({
      where: { id: gameId },
      data: {
        datasetId,
        updatedAt: new Date(),
      },
    })

    await setStatus('COMPLETED')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[rebuild-kb] Task ${taskId} failed:`, msg)
    await setStatus('FAILED', msg).catch(() => null)
  }
}
