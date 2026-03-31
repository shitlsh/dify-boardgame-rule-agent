import sharp from 'sharp'
import { fromBuffer } from 'pdf2pic'
import { load as loadHtml } from 'cheerio'
import { WorkflowFileInput } from '@/lib/dify/workflow'

const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_IMAGES = 20

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

function toImageInput(images: ImageAsset[]): WorkflowFileInput[] {
  return images.map((img) => ({
    name: img.name,
    bytes: img.bytes,
    mimeType: 'image/jpeg',
  }))
}

async function packImages(images: ImageAsset[]): Promise<WorkflowFileInput[]> {
  for (const level of COMPRESSION_LEVELS) {
    const optimized: ImageAsset[] = []
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      let output: Buffer
      try {
        output = await optimizeImage(image.bytes, level)
      } catch {
        throw new Error(
          `图片 ${image.name} 格式无法解析（Input buffer contains unsupported image format）。` +
            '若是 macOS 压缩包，请移除 __MACOSX/._* 文件后重试。',
        )
      }
      optimized.push({
        name: normalizeImageName(image.name, i).replace(/\.\w+$/, '.jpg'),
        bytes: output,
      })
    }

    const asImages = toImageInput(optimized)
    const imageFitsLimits = asImages.every((f) => f.bytes.byteLength <= MAX_FILE_BYTES)
    if (imageFitsLimits) return asImages
  }

  throw new Error(
    '规则图片过大，自动压缩后仍有单张超过 15MB。请降低图片分辨率后重试。',
  )
}

function isImagePath(filePath: string) {
  return /\.(png|jpe?g|webp)$/i.test(filePath)
}

function getPageNo(name: string): number | null {
  const base = name.split('/').pop() ?? name
  const match = base.match(/^(\d+)_/)
  if (!match) return null
  return Number(match[1])
}

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return items.sort((a, b) => a.name.localeCompare(b.name, 'en'))
}

function validateAndSortPageNamed(images: ImageAsset[]): ImageAsset[] {
  const withPage = images.map((i) => ({ ...i, pageNo: getPageNo(i.name) }))
  const invalid = withPage.filter((i) => i.pageNo == null)
  if (invalid.length > 0) {
    throw new Error(
      `图片命名需以页码开头，例如 1_xxx.jpg 或 01_xxx.jpg。以下文件不符合：${invalid
        .slice(0, 3)
        .map((v) => v.name)
        .join(', ')}`,
    )
  }
  return withPage
    .sort((a, b) => (a.pageNo as number) - (b.pageNo as number) || a.name.localeCompare(b.name, 'en'))
    .map(({ name, bytes }) => ({ name, bytes }))
}

async function rasterizePdfToImages(pdfBytes: Buffer, fileName: string): Promise<ImageAsset[]> {
  const convert = fromBuffer(pdfBytes, {
    density: 180,
    format: 'jpeg',
    width: 1800,
    height: 2400,
    quality: 85,
  })
  let pages: Array<{ page: number; buffer?: Buffer }> = []
  try {
    pages = (await convert.bulk(-1, { responseType: 'buffer' })) as Array<{
      page: number
      buffer?: Buffer
    }>
  } catch {
    throw new Error(
      'PDF 转图片失败。请确认系统已安装 GraphicsMagick（pdf2pic 依赖），或先手动转为图片上传。',
    )
  }

  const valid = pages.filter((p) => p.buffer)
  if (valid.length === 0) throw new Error(`PDF ${fileName} 未转换出任何页面图片`)
  return valid.map((p) => ({
    name: `${String(p.page).padStart(2, '0')}_${fileName.replace(/\.pdf$/i, '')}.jpg`,
    bytes: p.buffer as Buffer,
  }))
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
  sourceFiles?: File[]
}): Promise<WorkflowFileInput[]> {
  const { sourceType, sourceUrl, sourceFiles = [] } = params

  if (sourceType === 'pdf') {
    const sourceFile = sourceFiles[0]
    if (!sourceFile) throw new Error('请上传 PDF 文件')
    const pdfBytes = Buffer.from(await sourceFile.arrayBuffer())
    const imageAssets = await rasterizePdfToImages(pdfBytes, sourceFile.name || 'rules.pdf')
    if (imageAssets.length > MAX_IMAGES) {
      throw new Error(`PDF 页数超过当前上限（${imageAssets.length}/${MAX_IMAGES}）`)
    }
    return packImages(imageAssets)
  }

  let imageAssets: ImageAsset[] = []
  if (sourceType === 'images') {
    if (sourceFiles.length === 0) throw new Error('请至少上传一张图片')
    imageAssets = []
    for (const file of sourceFiles) {
      if (!isImagePath(file.name)) continue
      imageAssets.push({
        name: file.name,
        bytes: Buffer.from(await file.arrayBuffer()),
      })
    }
    imageAssets = validateAndSortPageNamed(imageAssets)
  } else if (sourceType === 'url') {
    if (!sourceUrl) throw new Error('请提供集石 URL')
    imageAssets = await fetchRuleImagesFromGstone(sourceUrl)
  } else {
    throw new Error(`不支持的 sourceType: ${sourceType}`)
  }

  const ordered = sortByName(imageAssets)
  if (ordered.length > MAX_IMAGES) {
    throw new Error(`图片数量超过当前上限（${ordered.length}/${MAX_IMAGES}）`)
  }
  const files = await packImages(ordered)
  files.forEach((f) => ensureFileSize(f.bytes, f.name))
  return files
}
