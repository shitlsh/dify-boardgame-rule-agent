/** 规则助手区域：与主内容区保持统一内边距，不再用负边距顶满屏 */
export default function AdminChatSectionLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>
}
