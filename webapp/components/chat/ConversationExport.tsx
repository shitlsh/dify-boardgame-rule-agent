'use client'

import { useCallback, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { MessageBubble, type Message } from '@/components/chat/MessageBubble'
import {
  downloadMarkdown,
  messagesToMarkdown,
  sanitizeFilename,
} from '@/lib/chatExport'

interface ConversationExportProps {
  gameName: string
  messages: Message[]
  /** 流式输出中时不建议导出 */
  disabled?: boolean
}

export function ConversationExport({
  gameName,
  messages,
  disabled = false,
}: ConversationExportProps) {
  const captureRef = useRef<HTMLDivElement>(null)
  const [pngBusy, setPngBusy] = useState(false)

  const base = sanitizeFilename(gameName)
  const canExport = messages.length > 0 && !disabled

  const onMarkdown = useCallback(() => {
    if (!canExport) return
    downloadMarkdown(`${base}-对话.md`, messagesToMarkdown(gameName, messages))
  }, [base, canExport, gameName, messages])

  const onLongImage = useCallback(async () => {
    const el = captureRef.current
    if (!el || !canExport) return
    setPngBusy(true)
    // 视口外节点常被浏览器跳过绘制，html-to-image 会截到空白；导出时短暂移到视口内再截图
    const prevInline = el.style.cssText
    try {
      if (document.fonts?.ready) {
        await document.fonts.ready
      }
      el.style.cssText = [
        prevInline,
        'position:fixed!important',
        'left:16px!important',
        'top:16px!important',
        'z-index:2147483647!important',
        'pointer-events:none!important',
        'opacity:1!important',
        'visibility:visible!important',
        'width:min(560px,calc(100vw - 32px))!important',
        'max-width:min(560px,calc(100vw - 32px))!important',
      ]
        .filter(Boolean)
        .join(';')

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })

      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: '#f3f4f6',
        cacheBust: true,
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${base}-对话.png`
      a.click()
    } catch {
      console.error('导出长图失败，可改用 Markdown 导出')
      window.alert('长图导出失败，请改用「Markdown」导出或稍后重试。')
    } finally {
      el.style.cssText = prevInline
      setPngBusy(false)
    }
  }, [base, canExport])

  if (messages.length === 0) return null

  const snapshotMessages = messages.map((m) => ({ ...m, isStreaming: false }))

  return (
    <>
      {pngBusy ? (
        <div
          className="fixed inset-0 z-[2147483640] bg-black/35"
          aria-hidden
        />
      ) : null}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onMarkdown}
          disabled={!canExport}
          title="下载 .md，完整保留 Markdown 与对话顺序"
          className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Markdown
        </button>
        <button
          type="button"
          onClick={onLongImage}
          disabled={!canExport || pngBusy}
          title="生成长图 PNG（与界面样式相近）"
          className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pngBusy ? '生成中…' : '长图'}
        </button>
      </div>

      {/* 离屏渲染供 html-to-image 截取；勿用 display:none */}
      <div
        ref={captureRef}
        className="pointer-events-none fixed left-[-120vw] top-0 z-0 w-[min(560px,calc(100vw-32px))] rounded-xl border border-gray-200 bg-gray-100 p-5 shadow-sm"
        aria-hidden
      >
        <div className="mb-4 border-b border-gray-200 pb-3">
          <p className="text-xs text-gray-400">规则助手 · 对话导出</p>
          <p className="text-sm font-semibold text-gray-900">{gameName}</p>
          <p className="mt-1 text-[11px] text-gray-400">
            {new Date().toLocaleString('zh-CN', { hour12: false })}
          </p>
        </div>
        <div className="space-y-4">
          {snapshotMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>
      </div>
    </>
  )
}
