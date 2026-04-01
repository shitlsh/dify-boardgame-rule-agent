'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { tableActionButtonClass } from './action-styles'

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
    <div className="flex w-full flex-col gap-1">
      <button
        type="button"
        disabled={!canRebuild || loading}
        onClick={onClick}
        title={
          canRebuild
            ? '使用已保存的规则文件重新生成可检索内容（不重新识别图片）'
            : '本地尚无已保存的规则文件'
        }
        className={tableActionButtonClass}
      >
        {loading ? '…' : '重建知识库'}
      </button>
      {error && <span className="text-[10px] text-red-500 max-w-[140px] leading-tight">{error}</span>}
    </div>
  )
}
