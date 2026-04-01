'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  gameId: string
  canRebuild: boolean
}

export function RebuildKbButton({ gameId, canRebuild }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onClick() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/games/${gameId}/rebuild-kb`, { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? `请求失败 (${res.status})`)
        return
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={!canRebuild || loading}
        onClick={onClick}
        title={
          canRebuild
            ? '仅重建知识库（不跑 Extractor），会删除旧 Dataset 后重新索引'
            : '本地无规则 Markdown 文件'
        }
        className="px-2.5 py-1 text-xs font-medium rounded-md border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? '…' : '重建知识库'}
      </button>
      {error && <span className="text-[10px] text-red-500 max-w-[140px] leading-tight">{error}</span>}
    </div>
  )
}
