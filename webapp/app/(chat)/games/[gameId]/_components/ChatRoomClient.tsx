'use client'

import { useState, useCallback } from 'react'
import { MessageList } from '@/components/chat/MessageList'
import { ChatInput } from '@/components/chat/ChatInput'
import { type Message } from '@/components/chat/MessageBubble'

interface ChatRoomClientProps {
  gameId: string
  gameName: string
}

export function ChatRoomClient({ gameId, gameName }: ChatRoomClientProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()

  const sendMessage = useCallback(
    async (text: string) => {
      if (isStreaming) return

      // Append user message
      const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
      setMessages((prev) => [...prev, userMsg])
      setIsStreaming(true)

      // Create placeholder assistant message for streaming
      const assistantId = crypto.randomUUID()
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', isStreaming: true },
      ])

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId, message: text, conversationId }),
        })

        if (!res.ok || !res.body) {
          const err = await res.text()
          throw new Error(err || `HTTP ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (raw === '[DONE]') break

            let chunk: { type: string; value: string }
            try {
              chunk = JSON.parse(raw) as { type: string; value: string }
            } catch {
              continue
            }

            if (chunk.type === 'conversation_id') {
              setConversationId(chunk.value)
            } else if (chunk.type === 'text') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + chunk.value } : m,
                ),
              )
            } else if (chunk.type === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: `⚠️ 出错了：${chunk.value}`, isStreaming: false }
                    : m,
                ),
              )
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '请求失败，请重试'
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `⚠️ 出错了：${msg}`, isStreaming: false }
              : m,
          ),
        )
      } finally {
        // Mark streaming done
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m)),
        )
        setIsStreaming(false)
      }
    },
    [gameId, conversationId, isStreaming],
  )

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Chat header */}
      <div className="shrink-0 px-5 py-3 bg-white border-b border-gray-200 flex items-center gap-3">
        <span className="text-2xl">🎲</span>
        <div>
          <h2 className="font-semibold text-gray-900 text-sm leading-tight">{gameName}</h2>
          <p className="text-xs text-gray-400">AI 规则裁判</p>
        </div>
        {conversationId && (
          <button
            onClick={() => {
              setMessages([])
              setConversationId(undefined)
            }}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors"
            title="开始新对话"
          >
            新对话
          </button>
        )}
      </div>

      {/* Messages */}
      <MessageList messages={messages} />

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        disabled={isStreaming}
        placeholder={isStreaming ? 'AI 正在回答...' : '输入规则问题，按 Enter 发送'}
      />
    </div>
  )
}
