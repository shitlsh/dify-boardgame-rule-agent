'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { GAME_TYPES } from '@/lib/game-types'

export type EditGamePayload = {
  id: string
  name: string
  coverUrl: string | null
  playerCount: string | null
  gameType: string
}

type Props = {
  game: EditGamePayload | null
  open: boolean
  onClose: () => void
}

export function EditGameModal({ game, open, onClose }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [playerCount, setPlayerCount] = useState('')
  const [gameType, setGameType] = useState('general')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!game) return
    setName(game.name)
    setCoverUrl(game.coverUrl ?? '')
    setPlayerCount(game.playerCount ?? '')
    setGameType(game.gameType)
    setError('')
  }, [game])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!game) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/games/${game.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          coverUrl: coverUrl.trim() || null,
          playerCount: playerCount.trim() || null,
          gameType,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? '保存失败')
      onClose()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (!game) return null

  return (
    <Modal open={open} onClose={onClose} title="编辑游戏信息">
      <p className="mb-5 text-sm text-slate-500">
        以下信息仅用于列表与规则助手展示，不影响已生成的规则内容。
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            游戏名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">封面图片地址</label>
          <input
            type="url"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
          <p className="mt-1 text-xs text-slate-400">留空则使用默认占位图</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">推荐人数</label>
          <input
            type="text"
            value={playerCount}
            onChange={(e) => setPlayerCount(e.target.value)}
            placeholder="例：2–4 人"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">游戏类型</label>
          <select
            value={gameType}
            onChange={(e) => setGameType(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            {GAME_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            取消
          </button>
        </div>
      </form>
    </Modal>
  )
}
