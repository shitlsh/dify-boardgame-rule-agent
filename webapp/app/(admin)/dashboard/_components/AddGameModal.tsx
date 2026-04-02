'use client'

import { useEffect, useState } from 'react'
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

type GstonePreview = {
  sourceUrl: string
  imageUrls: string[]
}

export function AddGameModal({ open, onClose }: Props) {
  const router = useRouter()
  const [sourceType, setSourceType] = useState('url')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [error, setError] = useState('')
  const [gstonePreview, setGstonePreview] = useState<GstonePreview | null>(null)
  /** 勾选 = 剔除该页 */
  const [excludedPageIndices, setExcludedPageIndices] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!open) {
      setGstonePreview(null)
      setExcludedPageIndices(new Set())
      setError('')
      setIsLoadingPreview(false)
    }
  }, [open])

  useEffect(() => {
    setGstonePreview(null)
    setExcludedPageIndices(new Set())
  }, [sourceType])

  function toggleExcluded(index: number) {
    setExcludedPageIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    const form = e.currentTarget
    const fd = new FormData(form)

    if (sourceType === 'url' && !gstonePreview) {
      const sourceUrl = (fd.get('sourceUrl') as string)?.trim()
      if (!sourceUrl) {
        setError('请填写集石页面 URL')
        return
      }
      setIsLoadingPreview(true)
      try {
        const res = await fetch('/api/rule-image-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceUrl }),
        })
        const json = (await res.json()) as { urls?: string[]; error?: string }
        if (!res.ok) throw new Error(json.error ?? '加载预览失败')
        const urls = json.urls ?? []
        if (urls.length === 0) throw new Error('未解析到规则图片')
        setGstonePreview({ sourceUrl, imageUrls: urls })
        setExcludedPageIndices(new Set())
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载预览失败')
      } finally {
        setIsLoadingPreview(false)
      }
      return
    }

    setIsSubmitting(true)
    try {
      const submitFd = new FormData(form)
      if (sourceType === 'url' && gstonePreview) {
        submitFd.set(
          'excludedIndices',
          JSON.stringify(Array.from(excludedPageIndices).sort((a, b) => a - b)),
        )
      }
      const res = await fetch('/api/tasks', { method: 'POST', body: submitFd })
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

  function handleBackFromPreview() {
    setGstonePreview(null)
    setExcludedPageIndices(new Set())
    setError('')
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
              readOnly={!!gstonePreview}
              placeholder="https://www.gstonegames.com/..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm read-only:bg-slate-50 read-only:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            {gstonePreview && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm font-medium text-slate-800">请剔除无关的故事页</p>
                <p className="mt-1 text-xs text-slate-500">
                  勾选背景故事、全页插图、鸣谢等不需要参与解析的页；未勾选页将上传并用于后续流程。
                </p>
                <div className="mt-3 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                  {gstonePreview.imageUrls.map((imgUrl, i) => (
                    <label
                      key={`${i}-${imgUrl.slice(-24)}`}
                      className={`flex cursor-pointer flex-col gap-1 rounded-lg border bg-white p-2 text-xs shadow-sm transition-colors ${
                        excludedPageIndices.has(i)
                          ? 'border-amber-400 ring-1 ring-amber-200'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="relative aspect-[3/4] w-full overflow-hidden rounded bg-slate-100">
                        <img
                          src={imgUrl}
                          alt={`第 ${i + 1} 页`}
                          className="h-full w-full object-contain"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={excludedPageIndices.has(i)}
                          onChange={() => toggleExcluded(i)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
                        />
                        <span className="text-slate-600">第 {i + 1} 页 · 剔除</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
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

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting || isLoadingPreview}
            className="min-w-0 flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sourceType === 'url' && (
              <>
                {isLoadingPreview && '加载预览中…'}
                {!isLoadingPreview && gstonePreview && (isSubmitting ? '提交中…' : '确认并上传')}
                {!isLoadingPreview && !gstonePreview && '加载预览并选择页面'}
              </>
            )}
            {sourceType !== 'url' && (isSubmitting ? '提交中…' : '开始处理')}
          </button>
          {sourceType === 'url' && gstonePreview && (
            <button
              type="button"
              onClick={handleBackFromPreview}
              disabled={isSubmitting || isLoadingPreview}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              返回修改
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || isLoadingPreview}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            取消
          </button>
        </div>
      </form>
    </Modal>
  )
}
