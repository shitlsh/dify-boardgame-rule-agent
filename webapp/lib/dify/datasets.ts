/**
 * Dify Datasets API
 *
 * Handles Knowledge Base lifecycle: create, upload Markdown, poll indexing,
 * and export segment snapshots (used for cost-efficient migration—see blueprint §3).
 *
 * Mock mode (DIFY_MOCK_MODE=true): all operations resolve immediately with
 * synthetic IDs/data, enabling full ETL flow testing without a Dify instance.
 */

import { sleep } from '@/lib/utils'
import { difyDatasetConfig } from '@/lib/dify/config'

const MOCK = process.env.DIFY_MOCK_MODE === 'true'
const DIFY_BASE_URL = process.env.DIFY_BASE_URL ?? 'http://localhost/v1'
const DATASET_API_KEY = process.env.DIFY_DATASET_API_KEY ?? ''

function authHeaders() {
  return {
    Authorization: `Bearer ${DATASET_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

export interface Segment {
  id: string
  content: string
  position: number
  word_count: number
}

/** Create a new Dify Knowledge Base and return its dataset_id. */
export async function createDataset(name: string): Promise<string> {
  if (MOCK) {
    await sleep(400)
    return `mock-dataset-${name}-${Date.now()}`
  }
  const res = await fetch(`${DIFY_BASE_URL}/datasets`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, permission: difyDatasetConfig.create.permission }),
  })
  if (!res.ok) throw new Error(`createDataset failed ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.id as string
}

/**
 * Upload a Markdown document to a dataset.
 * Uses custom segmentation: split on "\n# " (each H1 becomes one chunk).
 * high_quality indexing mode is used by default (LLM-generated summaries per chunk).
 */
export async function uploadDocument(
  datasetId: string,
  markdown: string,
  docName: string,
): Promise<string> {
  if (MOCK) {
    await sleep(600)
    return `mock-document-${Date.now()}`
  }
  const res = await fetch(
    `${DIFY_BASE_URL}/datasets/${datasetId}/document/create-by-text`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        name: docName,
        text: markdown,
        indexing_technique: difyDatasetConfig.document.indexingTechnique,
        process_rule: {
          mode: difyDatasetConfig.document.processMode,
          rules: {
            pre_processing_rules: [
              { id: 'remove_extra_spaces', enabled: difyDatasetConfig.document.removeExtraSpaces },
              { id: 'remove_urls_emails', enabled: difyDatasetConfig.document.removeUrlsEmails },
            ],
            segmentation: {
              separator: difyDatasetConfig.document.segmentationSeparator,
              max_tokens: difyDatasetConfig.document.segmentationMaxTokens,
            },
          },
        },
      }),
    },
  )
  if (!res.ok) throw new Error(`uploadDocument failed ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.document?.id as string
}

/**
 * Poll until document indexing reaches "completed".
 * Dify high_quality indexing can take several minutes for large documents.
 */
export async function pollDocumentIndexing(
  datasetId: string,
  documentId: string,
): Promise<void> {
  if (MOCK) {
    await sleep(1000)
    return
  }
  for (let i = 0; i < 40; i++) {
    await sleep(3000)
    const res = await fetch(
      `${DIFY_BASE_URL}/datasets/${datasetId}/documents/${documentId}/indexing-status`,
      { headers: { Authorization: `Bearer ${DATASET_API_KEY}` } },
    )
    if (!res.ok) throw new Error(`pollIndexing failed ${res.status}`)
    const data = await res.json()
    const status = (data.data?.[0]?.indexing_status as string) ?? ''
    if (status === 'completed') return
    if (status === 'error' || status === 'paused')
      throw new Error(`Document indexing failed with status: ${status}`)
  }
  throw new Error('Document indexing timeout (120s)')
}

/**
 * Export all segments of an indexed document.
 * Snapshot is saved to storage/output/<slug>/segments_V<n>.json and used
 * for cost-efficient migration (skip re-chunking + high_quality re-indexing).
 */
export async function exportSegments(
  datasetId: string,
  documentId: string,
): Promise<Segment[]> {
  if (MOCK) {
    await sleep(300)
    return [
      { id: 'seg-1', content: '# 游戏规则（Mock）\n\n这是 Mock 模式的示例段落。', position: 1, word_count: 18 },
      { id: 'seg-2', content: '## 游戏准备\n\n将所有组件放置在桌面中央。', position: 2, word_count: 14 },
      { id: 'seg-3', content: '## 游戏流程\n\n每回合分为准备、行动、结算三个阶段。', position: 3, word_count: 20 },
    ]
  }
  const res = await fetch(
    `${DIFY_BASE_URL}/datasets/${datasetId}/documents/${documentId}/segments`,
    { headers: { Authorization: `Bearer ${DATASET_API_KEY}` } },
  )
  if (!res.ok) throw new Error(`exportSegments failed ${res.status}`)
  const data = await res.json()
  return (data.data ?? []) as Segment[]
}
