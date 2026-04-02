'use client'

import { useState, useCallback, useEffect } from 'react'
import { MessageList } from '@/components/chat/MessageList'
import { ChatInput } from '@/components/chat/ChatInput'
import { QuickStartHero } from '@/components/chat/QuickStartHero'
import { SuggestedPrompts } from '@/components/chat/SuggestedPrompts'
import { ConversationExport } from '@/components/chat/ConversationExport'
import { ChatSessionSwitcher } from '@/components/chat/ChatSessionSwitcher'
import { type Message } from '@/components/chat/MessageBubble'
import {
  createEmptySession,
  deriveTitle,
  loadGameChatState,
  MAX_CHAT_SESSIONS,
  saveGameChatState,
  trimSessionsToLimit,
  type StoredSession,
} from '@/lib/localChatSessions'

interface ChatRoomClientProps {
  gameId: string
  gameName: string
  quickStartGuide: string
  startQuestions: string[]
}

export function ChatRoomClient({
  gameId,
  gameName,
  quickStartGuide,
  startQuestions,
}: ChatRoomClientProps) {
  const [sessions, setSessions] = useState<StoredSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const [hydrated, setHydrated] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)

  useEffect(() => {
    const state = loadGameChatState(gameId)
    setSessions(state.sessions)
    setActiveSessionId(state.activeSessionId)
    setHydrated(true)
  }, [gameId])

  useEffect(() => {
    if (!hydrated) return
    if (sessions.length > MAX_CHAT_SESSIONS) {
      setSessions((prev) => trimSessionsToLimit(prev))
      return
    }
    saveGameChatState(gameId, {
      version: 1,
      sessions,
      activeSessionId,
    })
  }, [gameId, hydrated, sessions, activeSessionId])

  useEffect(() => {
    if (!hydrated) return
    if (sessions.length === 0) return
    if (!sessions.some((s) => s.id === activeSessionId)) {
      setActiveSessionId(sessions[0]!.id)
    }
  }, [hydrated, sessions, activeSessionId])

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const messages = activeSession?.messages ?? []
  const conversationId = activeSession?.conversationId

  const sendMessage = useCallback(
    async (text: string) => {
      if (isStreaming) return

      const sid = activeSessionId
      const convId = conversationId

      const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sid) return s
          const nextMessages = [...s.messages, userMsg]
          return {
            ...s,
            messages: nextMessages,
            title: deriveTitle(nextMessages),
            updatedAt: Date.now(),
          }
        }),
      )
      setIsStreaming(true)

      const assistantId = crypto.randomUUID()
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sid) return s
          const nextMessages = [
            ...s.messages,
            { id: assistantId, role: 'assistant' as const, content: '', isStreaming: true },
          ]
          return {
            ...s,
            messages: nextMessages,
            title: deriveTitle(nextMessages),
            updatedAt: Date.now(),
          }
        }),
      )

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId, message: text, conversationId: convId }),
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
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === sid ? { ...s, conversationId: chunk.value, updatedAt: Date.now() } : s,
                ),
              )
            } else if (chunk.type === 'text') {
              setSessions((prev) =>
                prev.map((s) => {
                  if (s.id !== sid) return s
                  const nextMessages = s.messages.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + chunk.value } : m,
                  )
                  return {
                    ...s,
                    messages: nextMessages,
                    title: deriveTitle(nextMessages),
                    updatedAt: Date.now(),
                  }
                }),
              )
            } else if (chunk.type === 'error') {
              setSessions((prev) =>
                prev.map((s) => {
                  if (s.id !== sid) return s
                  const nextMessages = s.messages.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: `⚠️ 出错了：${chunk.value}`, isStreaming: false }
                      : m,
                  )
                  return {
                    ...s,
                    messages: nextMessages,
                    title: deriveTitle(nextMessages),
                    updatedAt: Date.now(),
                  }
                }),
              )
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '请求失败，请重试'
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== sid) return s
            const nextMessages = s.messages.map((m) =>
              m.id === assistantId
                ? { ...m, content: `⚠️ 出错了：${msg}`, isStreaming: false }
                : m,
            )
            return {
              ...s,
              messages: nextMessages,
              title: deriveTitle(nextMessages),
              updatedAt: Date.now(),
            }
          }),
        )
      } finally {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== sid) return s
            const nextMessages = s.messages.map((m) =>
              m.id === assistantId ? { ...m, isStreaming: false } : m,
            )
            return {
              ...s,
              messages: nextMessages,
              title: deriveTitle(nextMessages),
              updatedAt: Date.now(),
            }
          }),
        )
        setIsStreaming(false)
      }
    },
    [gameId, conversationId, isStreaming, activeSessionId],
  )

  const startNewSession = useCallback(() => {
    if (isStreaming) return
    const next = createEmptySession()
    setSessions((prev) => [...prev, next])
    setActiveSessionId(next.id)
  }, [isStreaming])

  const switchSession = useCallback(
    (id: string) => {
      if (isStreaming) return
      setActiveSessionId(id)
    },
    [isStreaming],
  )

  const deleteSession = useCallback(
    (id: string) => {
      if (isStreaming) return
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== id)
        return filtered.length === 0 ? [createEmptySession()] : filtered
      })
    },
    [isStreaming],
  )

  const showSuggested =
    hydrated && messages.length === 0 && startQuestions.length > 0
  const showExport = hydrated && messages.length > 0

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col bg-gray-50">
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-5 py-3">
        <span className="text-2xl">🎲</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold leading-tight text-gray-900">{gameName}</h2>
          <p className="text-xs text-gray-400">规则助手</p>
        </div>
        {hydrated ? (
          <div className="flex shrink-0 items-center gap-2">
            <ChatSessionSwitcher
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelect={switchSession}
              onDelete={deleteSession}
              disabled={isStreaming}
            />
            {showExport ? (
              <ConversationExport
                gameName={gameName}
                messages={messages}
                disabled={isStreaming}
              />
            ) : null}
            <button
              type="button"
              onClick={startNewSession}
              disabled={isStreaming}
              className="text-xs text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
              title="开始新对话（本机保留当前会话，可在「会话」中切回）"
            >
              新对话
            </button>
          </div>
        ) : null}
      </div>

      {quickStartGuide ? <QuickStartHero markdown={quickStartGuide} /> : null}

      <div className="flex min-h-0 flex-1 flex-col">
        <MessageList messages={messages} minimalEmpty={Boolean(quickStartGuide)} />
      </div>

      {showSuggested ? (
        <SuggestedPrompts prompts={startQuestions} onPick={sendMessage} disabled={isStreaming} />
      ) : null}

      <ChatInput
        onSend={sendMessage}
        disabled={isStreaming || !hydrated}
        placeholder={
          !hydrated ? '加载中…' : isStreaming ? 'AI 正在回答...' : '输入规则问题，按 Enter 发送'
        }
      />
    </div>
  )
}
