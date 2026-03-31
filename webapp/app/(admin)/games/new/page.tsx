'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const GAME_TYPES = [
  { value: 'general',          label: '通用' },
  { value: 'deck-building',    label: '卡牌构建' },
  { value: 'worker-placement', label: '工人放置' },
  { value: 'cooperative',      label: '合作类' },
  { value: 'area-control',     label: '区域控制' },
  { value: 'engine-building',  label: '引擎构建' },
  { value: 'dungeon-crawler',  label: '地牢爬行' },
]

const SOURCE_TYPES = [
  { value: 'url', label: '集石 URL（自动爬取规则书图片）' },
  { value: 'images', label: '上传多张规则书图片' },
  { value: 'pdf', label: '上传 PDF 规则书（服务端转图片）' },
]

export default function NewGamePage() {
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
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">添加新游戏</h1>
      <p className="text-sm text-gray-500 mb-6">
        提交后系统将自动完成：获取规则书 → AI 提炼 Markdown → 建立知识库
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Game Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            游戏名称 <span className="text-red-500">*</span>
          </label>
          <input
            name="gameName"
            type="text"
            required
            placeholder="例：领土争夺战"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Game Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">游戏类型</label>
          <select
            name="gameType"
            defaultValue="general"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {GAME_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Source Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">规则书来源</label>
          <select
            name="sourceType"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Dynamic source input */}
        {sourceType === 'url' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              集石页面 URL <span className="text-red-500">*</span>
            </label>
            <input
              name="sourceUrl"
              type="url"
              required
              placeholder="https://www.gstonegames.com/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              将自动爬取该页面的规则书图片（Mock 模式下跳过爬取）
            </p>
          </div>
        )}

        {(sourceType === 'images' || sourceType === 'pdf') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
              className="w-full text-sm text-gray-600
                file:mr-3 file:py-2 file:px-3
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-indigo-50 file:text-indigo-700
                hover:file:bg-indigo-100"
            />
            <p className="mt-1 text-xs text-gray-400">
              {sourceType === 'images'
                ? '支持多图上传；文件名需以页码开头（如 1_xxx.jpg、01_xxx.png），最多 20 张'
                : 'PDF 将在服务端逐页渲染为 JPG 后送入 AI 提炼流程，最多 20 页'}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? '提交中...' : '开始处理'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  )
}
