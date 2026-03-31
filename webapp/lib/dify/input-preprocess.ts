import JSZip from 'jszip'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import { load as loadHtml } from 'cheerio'
import { WorkflowFileInput } from '@/lib/dify/workflow'

const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_FILES = 10

const IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

type ImageAsset = {
  name: string
  bytes: Buffer
}

const COMPRESSION_LEVELS = [
  { maxEdge: 2200, quality: 85 },
  { maxEdge: 1900, quality: 75 },
  { maxEdge: 1600, quality: 65 },
  { maxEdge: 1300, quality: 55 },
]

function ensureFileSize(bytes: Buffer, name: string) {
  if (bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error(`文件 ${name} 超过 15MB 限制，请拆分后重试`)
  }
}

function normalizeImageName(name: string, idx: number): string {
  const padded = String(idx + 1).padStart(3, '0')
  return `${padded}_${name.replace(/[^\w.\-]+/g, '_')}`
}

async function optimizeImage(bytes: Buffer, level: { maxEdge: number; quality: number }): Promise<Buffer> {
  return sharp(bytes, { failOn: 'none' })
    .rotate()
    .resize({
      width: level.maxEdge,
      height: level.maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: level.quality, mozjpeg: true })
    .toBuffer()
}

async function renderPdfBytes(images: ImageAsset[]): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  for (const image of images) {
    const embedded = await pdf.embedJpg(image.bytes)
    const page = pdf.addPage([embedded.width, embedded.height])
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: embedded.width,
      height: embedded.height,
    })
  }
  return Buffer.from(await pdf.save())
}

async function buildPdfFromImages(images: ImageAsset[], fileName: string): Promise<WorkflowFileInput> {
  const bytes = await renderPdfBytes(images)
  ensureFileSize(bytes, fileName)
  return { name: fileName, bytes, mimeType: 'application/pdf' }
}

async function groupImagesToPdfChunks(images: ImageAsset[]): Promise<WorkflowFileInput[]> {
  const files: WorkflowFileInput[] = []
  let chunk: ImageAsset[] = []
  let startIndex = 1

  for (let i = 0; i < images.length; i++) {
    const current = images[i]
    const candidate = [...chunk, current]
    const candidatePdfBytes = await renderPdfBytes(candidate)
    if (candidatePdfBytes.byteLength > MAX_FILE_BYTES && chunk.length > 0) {
      files.push(await buildPdfFromImages(chunk, `rules_part_${startIndex}.pdf`))
      startIndex = i + 1
      chunk = [current]
      continue
    }
    chunk = candidate
  }

  if (chunk.length > 0) {
    files.push(await buildPdfFromImages(chunk, `rules_part_${startIndex}.pdf`))
  }
  return files
}

async function packImages(images: ImageAsset[]): Promise<WorkflowFileInput[]> {
  for (const level of COMPRESSION_LEVELS) {
    const optimized: ImageAsset[] = []
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      const output = await optimizeImage(image.bytes, level)
      optimized.push({
        name: normalizeImageName(image.name, i).replace(/\.\w+$/, '.jpg'),
        bytes: output,
      })
    }

    const files = await groupImagesToPdfChunks(optimized)
    if (files.length <= MAX_FILES) return files
  }

  throw new Error(
    '规则书内容过大，自动压缩后仍超过 10 文件限制。请拆分为多个任务（例如基础规则与扩展规则分开上传）。',
  )
}

function isImagePath(filePath: string) {
  return /\.(png|jpe?g|webp)$/i.test(filePath)
}

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return items.sort((a, b) => a.name.localeCompare(b.name, 'en'))
}

async function extractImagesFromZip(zipBytes: Buffer): Promise<ImageAsset[]> {
  const zip = await JSZip.loadAsync(zipBytes)
  const imageEntries: ImageAsset[] = []
  const files = Object.values(zip.files).filter((f) => !f.dir && isImagePath(f.name))
  const ordered = files.sort((a, b) => a.name.localeCompare(b.name, 'en'))
  for (const f of ordered) {
    imageEntries.push({ name: f.name.split('/').pop() ?? f.name, bytes: await f.async('nodebuffer') })
  }
  if (imageEntries.length === 0) {
    throw new Error('ZIP 中未找到可处理图片（仅支持 png/jpg/jpeg/webp）')
  }
  return imageEntries
}

async function fetchRuleImagesFromGstone(url: string): Promise<ImageAsset[]> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })
  if (!res.ok) throw new Error(`规则页面请求失败：${res.status}`)

  const html = await res.text()
  const $ = loadHtml(html)
  const container = $('#preview_imgs').length > 0 ? $('#preview_imgs') : $('.article-all .describe').first()
  if (container.length === 0) {
    throw new Error('未找到规则图片容器（#preview_imgs 或 .article-all .describe）')
  }

  const links = new Set<string>()
  container.find('img').each((_idx, el) => {
    const src = ($(el).attr('data-original') || $(el).attr('src') || '').trim()
    if (!src) return
    if (src.startsWith('//')) {
      links.add(`https:${src}`)
      return
    }
    links.add(new URL(src, url).toString())
  })
  if (links.size === 0) throw new Error('未提取到规则图片链接')

  const results: ImageAsset[] = []
  const ordered = Array.from(links)
  for (let i = 0; i < ordered.length; i++) {
    const link = ordered[i]
    const imgRes = await fetch(link, { headers: { Referer: url, 'User-Agent': 'Mozilla/5.0' } })
    if (!imgRes.ok) throw new Error(`下载规则图片失败：${imgRes.status} ${link}`)
    const arr = Buffer.from(await imgRes.arrayBuffer())
    results.push({ name: `${String(i + 1).padStart(3, '0')}_page`, bytes: arr })
  }
  return results
}

export async function prepareWorkflowFilesFromSource(params: {
  sourceType: string
  sourceUrl?: string | null
  sourceFile?: File | null
}): Promise<WorkflowFileInput[]> {
  const { sourceType, sourceUrl, sourceFile } = params

  if (sourceType === 'pdf') {
    if (!sourceFile) throw new Error('请上传 PDF 文件')
    const bytes = Buffer.from(await sourceFile.arrayBuffer())
    ensureFileSize(bytes, sourceFile.name)
    return [{ name: sourceFile.name || 'rules.pdf', bytes, mimeType: 'application/pdf' }]
  }

  let imageAssets: ImageAsset[] = []
  if (sourceType === 'zip') {
    if (!sourceFile) throw new Error('请上传 ZIP 文件')
    imageAssets = await extractImagesFromZip(Buffer.from(await sourceFile.arrayBuffer()))
  } else if (sourceType === 'url') {
    if (!sourceUrl) throw new Error('请提供集石 URL')
    imageAssets = await fetchRuleImagesFromGstone(sourceUrl)
  } else {
    throw new Error(`不支持的 sourceType: ${sourceType}`)
  }

  const ordered = sortByName(imageAssets)
  const files = await packImages(ordered)
  files.forEach((f) => {
    if (!IMAGE_MIME.has(f.mimeType) && f.mimeType !== 'application/pdf') {
      throw new Error(`不支持的文件类型: ${f.mimeType}`)
    }
    ensureFileSize(f.bytes, f.name)
  })
  if (files.length > MAX_FILES) {
    throw new Error(`文件数量超过限制（${files.length}/${MAX_FILES}）`)
  }
  return files
}
