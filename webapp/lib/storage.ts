/**
 * Storage abstraction layer.
 *
 * All data artifacts (raw images, extracted Markdown, Dify segment snapshots)
 * are written here. The base path is configured via STORAGE_BASE_PATH.
 *
 * Default (local demo): ../storage  →  <project-root>/storage/
 * Future (cloud):        s3://bucket  →  swap this module's implementation
 *
 * storage_manifests/games.json (one level up from STORAGE_BASE_PATH) is a
 * lightweight Git-committed index that tracks each game's current version and
 * datasetId without storing bulky artifacts.
 */

import fs from 'fs'
import path from 'path'

// Resolved at server startup; process.cwd() is the webapp/ directory when
// running `next dev` or `next build`.
const BASE = path.resolve(
  process.cwd(),
  process.env.STORAGE_BASE_PATH ?? '../storage',
)

const MANIFESTS_DIR = path.resolve(process.cwd(), '../storage_manifests')

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

/** Save extracted Markdown to storage/output/<slug>/rules_V<n>.md */
export function saveMarkdown(slug: string, version: number, content: string): string {
  const dir = path.join(BASE, 'output', slug)
  ensureDir(dir)
  const filePath = path.join(dir, `rules_V${version}.md`)
  fs.writeFileSync(filePath, content, 'utf-8')
  return filePath
}

/** Save Dify segment snapshot to storage/output/<slug>/segments_V<n>.json */
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

/** Update storage_manifests/games.json with metadata for a given slug */
export function updateManifest(slug: string, meta: Record<string, unknown>): void {
  ensureDir(MANIFESTS_DIR)
  const filePath = path.join(MANIFESTS_DIR, 'games.json')
  let manifest: Record<string, unknown> = {}
  if (fs.existsSync(filePath)) {
    manifest = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }
  manifest[slug] = {
    ...((manifest[slug] as Record<string, unknown>) ?? {}),
    ...meta,
    updatedAt: new Date().toISOString(),
  }
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf-8')
}
