/**
 * Chat test section: cancel parent main padding so the room can use full width/height.
 */
export default function AdminChatSectionLayout({ children }: { children: React.ReactNode }) {
  return <div className="-m-8">{children}</div>
}
