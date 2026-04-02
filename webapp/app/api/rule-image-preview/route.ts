import { NextRequest, NextResponse } from 'next/server'
import { fetchGstoneRuleImageUrls } from '@/lib/dify/input-preprocess'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求体需为 JSON' }, { status: 400 })
  }

  const sourceUrl =
    typeof body === 'object' && body !== null && 'sourceUrl' in body
      ? String((body as { sourceUrl?: unknown }).sourceUrl ?? '').trim()
      : ''

  if (!sourceUrl) {
    return NextResponse.json({ error: '请提供集石页面 URL（sourceUrl）' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(sourceUrl)
  } catch {
    return NextResponse.json({ error: 'URL 格式无效' }, { status: 400 })
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ error: '仅支持 http 或 https 链接' }, { status: 400 })
  }

  try {
    const urls = await fetchGstoneRuleImageUrls(sourceUrl)
    return NextResponse.json({ urls })
  } catch (err) {
    const message = err instanceof Error ? err.message : '解析规则图片失败'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
