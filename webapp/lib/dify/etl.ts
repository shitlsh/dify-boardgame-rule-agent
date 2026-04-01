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
 *   7. Update Game in SQLite（datasetId、路径等；检索 /chat 只读数据库）
 *
 * This function is intended to run as a fire-and-forget background task
 * in the Next.js API route (local dev only—see caveat in tasks/route.ts).
 */

import { prisma } from '@/lib/db'
import { runExtractorWorkflow, WorkflowFileInput } from '@/lib/dify/workflow'
import {
  createDataset,
  uploadDocument,
  pollDocumentIndexing,
  exportSegments,
} from '@/lib/dify/datasets'
import {
  saveMarkdown,
  saveQuickStartGuide,
  saveStartQuestions,
  saveSegments,
} from '@/lib/storage'

export async function runETL(
  taskId: string,
  gameId: string,
  params: {
    slug: string
    gameName: string
    ruleFiles: WorkflowFileInput[]
    version: number
  },
) {
  const { slug, gameName, ruleFiles, version } = params

  async function setStatus(status: string, errorMsg?: string) {
    await prisma.task.update({
      where: { id: taskId },
      data: { status, errorMsg: errorMsg ?? null, updatedAt: new Date() },
    })
  }

  try {
    await setStatus('PROCESSING')

    // Step 1: Extract Markdown
    const extractorOutput = await runExtractorWorkflow(ruleFiles, gameName)
    const markdown = extractorOutput.fullMarkdown

    // Step 2: Backup Markdown to local storage
    const rulesMarkdownPath = saveMarkdown(slug, version, markdown)
    const quickStartGuide = extractorOutput.quickStartGuide?.trim() ?? ''
    const startQuestions = extractorOutput.startQuestions ?? []
    let quickStartGuidePath: string | null = null
    let startQuestionsPath: string | null = null
    if (quickStartGuide) {
      quickStartGuidePath = saveQuickStartGuide(slug, version, quickStartGuide)
    }
    if (startQuestions.length > 0) {
      startQuestionsPath = saveStartQuestions(slug, version, startQuestions)
    }

    // Step 3: Create Dify Knowledge Base
    const datasetId = await createDataset(`${slug}-v${version}`)

    // Step 4: Upload Markdown with custom segmentation
    const uploaded = await uploadDocument(datasetId, markdown, `${slug}-rules-v${version}`)

    // Step 5: Wait for indexing
    await pollDocumentIndexing(datasetId, uploaded)

    // Step 6: Snapshot segments for future migration (skips costly re-indexing)
    const segments = await exportSegments(datasetId, uploaded.documentId)
    saveSegments(slug, version, segments)

    // Step 7: Persist datasetId to Game record
    await prisma.game.update({
      where: { id: gameId },
      data: {
        datasetId,
        version,
        quickStartGuide: quickStartGuide || null,
        startQuestions: startQuestions.length > 0 ? startQuestions : [],
        rulesMarkdownPath,
        quickStartGuidePath,
        startQuestionsPath,
        updatedAt: new Date(),
      },
    })

    await setStatus('COMPLETED')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[ETL] Task ${taskId} failed:`, msg)
    await setStatus('FAILED', msg).catch(() => null) // don't throw on cleanup failure
  }
}
