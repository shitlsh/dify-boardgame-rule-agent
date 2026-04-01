'use client'

import { MarkdownContent } from '@/components/chat/MarkdownContent'

export interface QuickStartSection {
  title: string
  body: string
}

/** Split quick-start Markdown into intro (before first ##) and ## sections. */
export function splitQuickStartMarkdown(markdown: string): {
  intro: string | null
  sections: QuickStartSection[]
} {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const introLines: string[] = []
  let i = 0
  while (i < lines.length && !/^##\s+/.test(lines[i])) {
    introLines.push(lines[i])
    i++
  }
  const introRaw = introLines.join('\n').trim()
  const sections: QuickStartSection[] = []
  while (i < lines.length) {
    const m = lines[i].match(/^##\s+(.+)/)
    if (!m) {
      i++
      continue
    }
    const title = m[1].trim()
    i++
    const bodyLines: string[] = []
    while (i < lines.length && !/^##\s+/.test(lines[i])) {
      bodyLines.push(lines[i])
      i++
    }
    sections.push({ title, body: bodyLines.join('\n').trim() })
  }
  return { intro: introRaw || null, sections }
}

interface QuickStartHeroProps {
  markdown: string
}

export function QuickStartHero({ markdown }: QuickStartHeroProps) {
  const trimmed = markdown.trim()
  const { intro, sections } = splitQuickStartMarkdown(trimmed)
  const noSections = sections.length === 0

  return (
    <div className="shrink-0 border-b border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-indigo-50/90 px-4 py-3">
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            📖
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-gray-900">3 分钟快速上手</h2>
        </div>
        <div className="max-h-[min(46vh,440px)] overflow-y-auto rounded-2xl border border-amber-100/90 bg-white/75 shadow-md backdrop-blur-[2px]">
          <div className="p-4 space-y-3">
            {noSections ? (
              <MarkdownContent content={trimmed} className="text-sm" />
            ) : (
              <>
                {intro && (
                  <div className="rounded-xl border border-amber-100/80 bg-amber-50/40 p-3">
                    <MarkdownContent content={intro} className="text-sm" />
                  </div>
                )}
                <div className="space-y-1.5">
                  {sections.map((sec, idx) => (
                    <details
                      key={`${sec.title}-${idx}`}
                      className="rounded-xl border border-gray-100/90 bg-white/90 open:shadow-sm"
                      open={idx === 0}
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-900 [&::-webkit-details-marker]:hidden">
                        <span className="text-gray-400" aria-hidden>
                          ▸
                        </span>
                        <span className="min-w-0 flex-1">{sec.title}</span>
                      </summary>
                      <div className="border-t border-gray-100/80 px-3 py-2 pb-3">
                        <MarkdownContent content={sec.body || '\u00a0'} className="text-sm" />
                      </div>
                    </details>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
