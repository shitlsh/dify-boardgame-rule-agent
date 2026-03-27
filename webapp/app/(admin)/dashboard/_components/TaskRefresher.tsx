'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Silently refreshes the page every 2.5 s while there are active tasks.
 * Uses router.refresh() so the Server Component re-fetches from DB without
 * a full page navigation.
 */
export function TaskRefresher({ hasActiveTasks }: { hasActiveTasks: boolean }) {
  const router = useRouter()

  useEffect(() => {
    if (!hasActiveTasks) return
    const id = setInterval(() => router.refresh(), 2500)
    return () => clearInterval(id)
  }, [hasActiveTasks, router])

  return null
}
