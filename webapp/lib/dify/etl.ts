/**
 * ETL Pipeline Orchestrator
 *
 * Coordinates the full ingestion flow for one game:
 *   1. Extract Markdown via Dify Extractor Workflow
 *   2. Save Markdown backup to storage/
 *   3. Create Dify Knowledge Base
 *   4. Upload Markdown (high_quality indexing, split on \n# )
 *   5. Poll until indexing is complete
 *   6. Export segment snapshot (cost-efficient migration support)
 *   7. Update Game.datasetId in SQLite
 *   8. Update storage_manifests/games.json
 *
 * This function is intended to run as a fire-and-forget background task
 * in the Next.js API route (local dev only—see caveat in tasks/route.ts).
 */

import { prisma } from '@/lib/db'
import { runExtractorWorkflow } from '@/lib/dify/workflow'
import {
  createDataset,
  uploadDocument,
  pollDocumentIndexing,
  exportSegments,
} from '@/lib/dify/datasets'
import { saveMarkdown, saveSegments, updateManifest } from '@/lib/storage'

export async function runETL(
  taskId: string,
  gameId: string,
  params: {
    slug: string
    gameType: string
    imageBase64s: string[]
    version: number
  },
) {
  const { slug, gameType, imageBase64s, version } = params

  async function setStatus(status: string, errorMsg?: string) {
    await prisma.task.update({
      where: { id: taskId },
      data: { status, errorMsg: errorMsg ?? null, updatedAt: new Date() },
    })
  }

  try {
    await setStatus('PROCESSING')

    // Step 1: Extract Markdown
    const markdown = await runExtractorWorkflow(imageBase64s, gameType)

    // Step 2: Backup Markdown to local storage
    saveMarkdown(slug, version, markdown)

    // Step 3: Create Dify Knowledge Base
    const datasetId = await createDataset(`${slug}-v${version}`)

    // Step 4: Upload Markdown with custom segmentation
    const documentId = await uploadDocument(datasetId, markdown, `${slug}-rules-v${version}`)

    // Step 5: Wait for indexing
    await pollDocumentIndexing(datasetId, documentId)

    // Step 6: Snapshot segments for future migration (skips costly re-indexing)
    const segments = await exportSegments(datasetId, documentId)
    saveSegments(slug, version, segments)

    // Step 7: Persist datasetId to Game record
    await prisma.game.update({
      where: { id: gameId },
      data: { datasetId, version, updatedAt: new Date() },
    })

    // Step 8: Update lightweight manifest index
    updateManifest(slug, { version, datasetId })

    await setStatus('COMPLETED')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[ETL] Task ${taskId} failed:`, msg)
    await setStatus('FAILED', msg).catch(() => null) // don't throw on cleanup failure
  }
}
