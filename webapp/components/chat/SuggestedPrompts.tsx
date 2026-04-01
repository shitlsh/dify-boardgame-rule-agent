'use client'

interface SuggestedPromptsProps {
  prompts: string[]
  onPick: (text: string) => void
  disabled?: boolean
}

export function SuggestedPrompts({ prompts, onPick, disabled }: SuggestedPromptsProps) {
  if (prompts.length === 0) return null

  return (
    <div className="shrink-0 border-t border-gray-200 bg-white px-4 pt-3 pb-2">
      <p className="mb-2 text-xs text-gray-500">试试这样问</p>
      <div className="flex max-h-[5.75rem] flex-wrap gap-2 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300">
        {prompts.map((text, i) => (
          <button
            key={`${i}-${text.slice(0, 24)}`}
            type="button"
            disabled={disabled}
            onClick={() => onPick(text)}
            className="max-w-full shrink-0 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-left text-xs leading-snug text-gray-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-950 disabled:pointer-events-none disabled:opacity-40"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
