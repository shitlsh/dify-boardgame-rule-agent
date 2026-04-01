import { redirect } from 'next/navigation'

/** 根路径进入游戏管理；规则助手见 /chat */
export default function HomePage() {
  redirect('/dashboard')
}
