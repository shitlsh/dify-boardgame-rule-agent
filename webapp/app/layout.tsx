import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '桌游规则助手',
  description: '基于 AI 的桌游规则问答系统',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  )
}
