'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { GAME_TYPES } from '@/lib/game-types'

const SOURCE_TYPES = [
  { value: 'url', label: '集石页面链接（自动获取规则图片）' },
  { value: 'images', label: '上传多张规则图片' },
  { value: 'pdf', label: '上传 PDF' },
]

type Props = {
  open: boolean
  onClose: () => void
}

export function AddGameModal({ open, onClose }: Props) {
  const router = useRouter()
  const [sourceType, setSourceType] = useState('url')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const formData = new FormData(e.currentTarget)
      const res = await fetch('/api/tasks', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error((json as { error?: string }).error ?? '提交失败')
      onClose()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="添加游戏" size="lg">
      <p className="mb-5 text-sm text-slate-500">
        提交后将整理规则并生成可查询内容，完成后可在「规则助手」中提问。
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            游戏名称 <span className="text-red-500">*</span>
          </label>
          <input
            name="gameName"
            type="text"
            required
            placeholder="例：卡坦岛"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">封面图片地址</label>
          <input
            name="coverUrl"
            type="url"
            placeholder="https://…（可选）"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">推荐人数</label>
          <input
            name="playerCount"
            type="text"
            placeholder="例：3–4 人（可选）"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">游戏类型</label>
          <select
            name="gameType"
            defaultValue="general"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            {GAME_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">规则来源</label>
          <select
            name="sourceType"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {sourceType === 'url' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              集石页面 URL <span className="text-red-500">*</span>
            </label>
            <input
              name="sourceUrl"
              type="url"
              required
              placeholder="https://www.gstonegames.com/..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
        )}

        {(sourceType === 'images' || sourceType === 'pdf') && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              上传文件 <span className="text-red-500">*</span>
            </label>
            <input
              name="sourceFiles"
              type="file"
              required
              multiple={sourceType === 'images'}
              accept={
                sourceType === 'images'
                  ? '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'
                  : '.pdf,application/pdf'
              }
              className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <p className="mt-1 text-xs text-slate-400">
              {sourceType === 'images'
                ? '支持多图；建议文件名带页序。单次最多 20 张。'
                : 'PDF 将按页处理，建议不超过 20 页。'}
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? '提交中…' : '开始处理'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            取消
          </button>
        </div>
      </form>
    </Modal>
  )
}
