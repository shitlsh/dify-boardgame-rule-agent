function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]
  if (raw == null || raw === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())
}

function envNum(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw == null || raw === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Markdown 自定义分段分隔符。
 *
 * 注意：`.env` 里若写 `DIFY_DATASET_SEGMENT_SEPARATOR=\n# ` **未加引号**，
 * `#` 会被多数 dotenv 解析为**注释起点**，值会变成只剩换行符 `\n`，
 * 导致按「每一行」切段而非按一级标题。
 *
 * 推荐二选一：
 * - 设置 `DIFY_DATASET_HEADING_LEVEL=1`（按 `# ` 一级标题分段，与 blueprint 一致）
 * - 或 `DIFY_DATASET_SEGMENT_SEPARATOR="\n# "`（双引号包住，含 `#` 与末尾空格）
 */
function segmentationSeparator(): string {
  const levelRaw = process.env.DIFY_DATASET_HEADING_LEVEL
  if (levelRaw != null && levelRaw !== '') {
    const n = Number(levelRaw)
    if (n === 1) return '\n# '
    if (n === 2) return '\n## '
    if (n === 3) return '\n### '
  }

  const raw = process.env.DIFY_DATASET_SEGMENT_SEPARATOR
  if (raw == null || raw === '') return '\n# '

  // 常见误配：未加引号导致只剩「换行」，等价于按行切段
  if (raw === '\n' || raw === '\r\n' || raw === '\\n') {
    return '\n# '
  }

  return raw
}

export const difyDatasetConfig = {
  create: {
    permission: process.env.DIFY_DATASET_PERMISSION ?? 'only_me',
  },
  document: {
    indexingTechnique: process.env.DIFY_DATASET_INDEXING_TECHNIQUE ?? 'high_quality',
    processMode: process.env.DIFY_DATASET_PROCESS_MODE ?? 'custom',
    segmentationSeparator: segmentationSeparator(),
    segmentationMaxTokens: envNum('DIFY_DATASET_SEGMENT_MAX_TOKENS', 1000),
    removeExtraSpaces: envBool('DIFY_DATASET_PREPROC_REMOVE_EXTRA_SPACES', true),
    removeUrlsEmails: envBool('DIFY_DATASET_PREPROC_REMOVE_URLS_EMAILS', false),
  },
  retrieval: {
    searchMethod: process.env.DIFY_RETRIEVE_SEARCH_METHOD ?? 'hybrid_search',
    rerankingEnable: envBool('DIFY_RETRIEVE_RERANKING_ENABLE', true),
    topK: envNum('DIFY_RETRIEVE_TOP_K', 5),
    scoreThresholdEnabled: envBool('DIFY_RETRIEVE_SCORE_THRESHOLD_ENABLED', true),
    scoreThreshold: envNum('DIFY_RETRIEVE_SCORE_THRESHOLD', 0.3),
  },
}
