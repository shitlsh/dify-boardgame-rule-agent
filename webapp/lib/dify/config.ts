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

export const difyDatasetConfig = {
  create: {
    permission: process.env.DIFY_DATASET_PERMISSION ?? 'only_me',
  },
  document: {
    indexingTechnique: process.env.DIFY_DATASET_INDEXING_TECHNIQUE ?? 'high_quality',
    processMode: process.env.DIFY_DATASET_PROCESS_MODE ?? 'custom',
    segmentationSeparator: process.env.DIFY_DATASET_SEGMENT_SEPARATOR ?? '\n# ',
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
