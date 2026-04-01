/** 右下角：当前为 Mock 还是真实 Dify（服务端读取环境变量） */
export function ConnectionStatus() {
  const isMock = process.env.DIFY_MOCK_MODE === 'true'

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-40">
      <div
        className={`pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-md ${
          isMock
            ? 'border-amber-200/90 bg-amber-50/95 text-amber-900'
            : 'border-emerald-200/90 bg-emerald-50/95 text-emerald-900'
        }`}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${isMock ? 'bg-amber-400' : 'bg-emerald-500'}`}
          aria-hidden
        />
        {isMock ? 'Mock 模式' : 'Dify 已连接'}
      </div>
    </div>
  )
}
