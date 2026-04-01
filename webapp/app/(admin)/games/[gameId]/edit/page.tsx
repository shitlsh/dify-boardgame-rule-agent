import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ gameId: string }>
}

/** 编辑改为仪表盘内弹窗，保留旧链接跳转 */
export default async function EditGameRedirectPage({ params }: Props) {
  const { gameId } = await params
  redirect(`/dashboard?edit=${encodeURIComponent(gameId)}`)
}
