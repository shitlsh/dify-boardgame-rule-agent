import { redirect } from 'next/navigation'

/** 旧链接 /games/:id → 统一为后台内 /chat/:id */
export default async function LegacyGameChatRedirect({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = await params
  redirect(`/chat/${gameId}`)
}
