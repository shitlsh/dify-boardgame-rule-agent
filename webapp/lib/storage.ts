/**
 * Storage abstraction layer.
 *
 * All data artifacts (raw images, extracted Markdown, Dify segment snapshots)
 * are written here. The base path is configured via STORAGE_BASE_PATH.
 *
 * Default (local demo): ../storage  →  <project-root>/storage/
 * Future (cloud):        s3://bucket  →  swap this module's implementation
 *
 * datasetId / version 等业务字段以 Prisma `Game` 表为准；不再维护 storage_manifests/games.json。
 */

import fs from 'fs'
import path from 'path'

// Resolved at server startup; process.cwd() is the webapp/ directory when
// running `next dev` or `next build`.
const BASE = path.resolve(
  process.cwd(),
  process.env.STORAGE_BASE_PATH ?? '../storage',
)

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

/**
 * Read existing rules markdown for KB-only rebuild.
 * Uses `rulesMarkdownPath` when set and file exists; otherwise `storage/output/<slug>/rules_V<n>.md`.
 */
export function readRulesMarkdown(
  slug: string,
  version: number,
  rulesMarkdownPath?: string | null,
): string | null {
  const candidates: string[] = []
  if (rulesMarkdownPath) {
    const p = path.isAbsolute(rulesMarkdownPath)
      ? rulesMarkdownPath
      : path.resolve(process.cwd(), rulesMarkdownPath)
    candidates.push(p)
  }
  candidates.push(path.join(BASE, 'output', slug, `rules_V${version}.md`))
  const seen = new Set<string>()
  for (const p of candidates) {
    const abs = path.normalize(p)
    if (seen.has(abs)) continue
    seen.add(abs)
    if (fs.existsSync(abs)) {
      return fs.readFileSync(abs, 'utf-8')
    }
  }
  return null
}

/** Save extracted Markdown to storage/output/<slug>/rules_V<n>.md */
export function saveMarkdown(slug: string, version: number, content: string): string {
  const dir = path.join(BASE, 'output', slug)
  ensureDir(dir)
  const filePath = path.join(dir, `rules_V${version}.md`)
  fs.writeFileSync(filePath, content, 'utf-8')
  return filePath
}

/** Save quick-start guide to storage/output/<slug>/quick_start_V<n>.md */
export function saveQuickStartGuide(slug: string, version: number, content: string): string {
  const dir = path.join(BASE, 'output', slug)
  ensureDir(dir)
  const filePath = path.join(dir, `quick_start_V${version}.md`)
  fs.writeFileSync(filePath, content, 'utf-8')
  return filePath
}

/**
 * Save Dify segment export snapshot to storage/output/<slug>/segments_V<n>.json
 * 用于跨实例迁移（Layer 2）：可用自定义分段把段落导入新 Dataset，通常只需重 Embedding。
 * 日常问答检索只使用 Game.datasetId，不读此文件。
 */
export function saveSegments(slug: string, version: number, segments: unknown[]): void {
  const dir = path.join(BASE, 'output', slug)
  ensureDir(dir)
  const filePath = path.join(dir, `segments_V${version}.json`)
  fs.writeFileSync(filePath, JSON.stringify(segments, null, 2), 'utf-8')
}

/** Ensure storage/raw/<slug>/ exists and return its absolute path */
export function ensureRawDir(slug: string): string {
  const dir = path.join(BASE, 'raw', slug)
  ensureDir(dir)
  return dir
}

