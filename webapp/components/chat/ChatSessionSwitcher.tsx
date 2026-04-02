'use client'

import { useEffect, useRef, useState } from 'react'
import { formatSessionTime, type StoredSession } from '@/lib/localChatSessions'

interface ChatSessionSwitcherProps {
  sessions: StoredSession[]
  activeSessionId: string
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  disabled?: boolean
}

export function ChatSessionSwitcher({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
  disabled = false,
}: ChatSessionSwitcherProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        title="查看与切换历史对话"
        className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        会话
        <span className="ml-0.5 text-gray-400">({sessions.length})</span>
      </button>

      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(100vw-2rem,18rem)] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          <p className="border-b border-gray-100 px-3 py-2 text-[11px] text-gray-400">
            本机保存 · 仅当前浏览器
          </p>
          <ul className="max-h-64 overflow-y-auto py-1">
            {sorted.map((s) => {
              const active = s.id === activeSessionId
              return (
                <li key={s.id} className="group flex items-start gap-1 px-2">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onSelect(s.id)
                      setOpen(false)
                    }}
                    className={
                      'min-w-0 flex-1 rounded-md px-2 py-2 text-left text-sm transition-colors ' +
                      (active ? 'bg-indigo-50 text-indigo-900' : 'text-gray-800 hover:bg-gray-50')
                    }
                  >
                    <span className="line-clamp-2 font-medium leading-snug">{s.title}</span>
                    <span className="mt-0.5 block text-[11px] text-gray-400">
                      {formatSessionTime(s.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    title="删除此会话"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(s.id)
                      setOpen(false)
                    }}
                    className="shrink-0 rounded p-1.5 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                  >
                    <span className="sr-only">删除</span>
                    <span aria-hidden className="text-base leading-none">
                      ×
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
