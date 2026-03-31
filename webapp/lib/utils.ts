import { randomUUID } from 'crypto'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * URL-safe slug for storage paths and DB uniqueness.
 * NOTE: Do NOT use `[\W]+` — in JS `\w` is only ASCII [A-Za-z0-9_], so CJK names
 * would collapse to a single "-" and different games would overwrite each other.
 */
export function slugify(text: string): string {
  const s = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (s.length > 0) return s
  return `game-${randomUUID().slice(0, 8)}`
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
