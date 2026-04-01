'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownContentProps {
  content: string
  className?: string
}

/** Shared prose styles for rule / chat markdown */
const proseClass =
  'prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-900 ' +
  'prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-gray-900 ' +
  'prose-table:text-xs prose-th:px-2 prose-td:px-2 prose-blockquote:border-indigo-200 prose-blockquote:text-gray-600'

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  if (!content.trim()) return null
  return (
    <div className={`${proseClass} ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
