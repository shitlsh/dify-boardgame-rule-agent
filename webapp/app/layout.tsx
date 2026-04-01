import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '桌游规则助手',
  description: '查询桌游规则说明与上手提示',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  )
}
