/** 操作列固定宽度，避免单个按钮被拉伸占满整列 */
export const tableActionColumnClass = 'flex w-[7rem] flex-col gap-2'

/** 表格内次要操作按钮（编辑 / 重建知识库等）统一圆角描边样式，同列内等宽 */
export const tableActionButtonClass =
  'inline-flex w-full items-center justify-center whitespace-nowrap rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-800 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40'
