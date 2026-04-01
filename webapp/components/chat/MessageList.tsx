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
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8 text-center text-sm text-slate-400 select-none">
          <p>在下方输入问题，或点选推荐问题开始</p>
        </div>
      )
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-slate-400 select-none">
        <span className="text-5xl">🎲</span>
        <p className="text-base font-medium text-slate-500">有什么想了解的，直接问我就好</p>
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
