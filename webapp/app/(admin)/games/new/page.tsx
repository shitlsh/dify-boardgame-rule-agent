import { redirect } from 'next/navigation'

/** 添加游戏改为仪表盘内弹窗，保留旧链接跳转 */
export default function NewGameRedirectPage() {
  redirect('/dashboard?add=1')
}
