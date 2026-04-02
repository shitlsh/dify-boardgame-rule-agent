import type { Message } from '@/components/chat/MessageBubble'

export function sanitizeFilename(name: string): string {
  const s = name.replace(/[/\\?%*:|"<>]/g, '_').trim()
  return s || 'chat'
}

export function messagesToMarkdown(gameName: string, messages: Message[]): string {
  const header = [
    `# ${gameName} · 规则助手对话`,
    '',
    `导出时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    '',
    '---',
    '',
  ]

  const blocks: string[] = []
  for (const m of messages) {
    const title = m.role === 'user' ? '## 用户' : '## 助手'
    const body = m.content.trimEnd()
    blocks.push(title, '', body, '', '---', '')
  }

  return [...header, ...blocks].join('\n')
}

export function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
