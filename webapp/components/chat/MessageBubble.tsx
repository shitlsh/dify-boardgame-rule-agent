import { cn } from '@/lib/utils'
import { MarkdownContent } from '@/components/chat/MarkdownContent'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isError = !isUser && message.content.startsWith('⚠️')

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm',
          isUser ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600',
        )}
      >
        {isUser ? '你' : '🎲'}
      </div>

      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed break-words',
          isUser
            ? 'bg-indigo-600 text-white rounded-tr-sm whitespace-pre-wrap'
            : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm',
        )}
      >
        {isUser || isError ? (
          <>
            {message.content}
            {message.isStreaming && (
              <span className="inline-block w-1 h-4 ml-0.5 bg-current animate-pulse align-middle" />
            )}
          </>
        ) : (
          <>
            <MarkdownContent content={message.content} />
            {message.isStreaming && (
              <span className="inline-block w-1 h-4 ml-1 bg-gray-400 animate-pulse align-middle" />
            )}
          </>
        )}
      </div>
    </div>
  )
}
