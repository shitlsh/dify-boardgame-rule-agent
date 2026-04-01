import { redirect } from 'next/navigation'

/** 根路径进入管理后台；规则问答测试见 /chat */
export default function HomePage() {
  redirect('/dashboard')
}
