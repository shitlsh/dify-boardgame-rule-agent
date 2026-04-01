import { useEffect, useRef } from 'react'
import { MessageBubble, type Message } from './MessageBubble'

interface MessageListProps {
  messages: Message[]
  /** When quick-start Hero is shown, use a lighter empty state. */
  minimalEmpty?: boolean
}

export function MessageList({ messages, minimalEmpty }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages / streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    if (minimalEmpty) {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-4 py-6 text-center text-sm text-gray-400 select-none">
          <p>在下方输入问题，或点选推荐问题</p>
          <p className="text-xs text-gray-400/90">回答仅依据规则书原文</p>
        </div>
      )
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-gray-400 select-none">
        <span className="text-5xl">🎲</span>
        <p className="text-base font-medium">有什么规则问题，尽管问我！</p>
        <p className="text-sm">我只根据规则书原文作答，不猜测</p>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
