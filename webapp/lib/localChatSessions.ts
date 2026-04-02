import type { Message } from '@/components/chat/MessageBubble'

export const STORAGE_VERSION = 1 as const
export const MAX_CHAT_SESSIONS = 50

export const storageKeyForGame = (gameId: string) => `brg-chat-sessions:${gameId}`

export interface StoredSession {
  id: string
  title: string
  updatedAt: number
  conversationId?: string
  messages: Message[]
}

export interface StoredGameSessions {
  version: number
  sessions: StoredSession[]
  activeSessionId: string
}

export function createEmptySession(): StoredSession {
  return {
    id: crypto.randomUUID(),
    title: '新对话',
    updatedAt: Date.now(),
    messages: [],
  }
}

export function deriveTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser?.content?.trim()) return '新对话'
  const line = firstUser.content.trim().split(/\n/)[0] ?? ''
  return line.length > 40 ? `${line.slice(0, 40)}…` : line
}

export function sanitizeMessagesForStorage(messages: Message[]): Message[] {
  return messages.map((m) => ({ ...m, isStreaming: false }))
}

function normalizeSession(s: Partial<StoredSession>): StoredSession {
  const id = typeof s.id === 'string' && s.id ? s.id : crypto.randomUUID()
  const raw = Array.isArray(s.messages) ? (s.messages as Message[]) : []
  return {
    id,
    title: typeof s.title === 'string' ? s.title : '新对话',
    updatedAt: typeof s.updatedAt === 'number' ? s.updatedAt : Date.now(),
    conversationId: typeof s.conversationId === 'string' ? s.conversationId : undefined,
    messages: sanitizeMessagesForStorage(raw),
  }
}

/** 保留最近更新的若干条会话（本机容量与性能） */
export function trimSessionsToLimit(sessions: StoredSession[]): StoredSession[] {
  if (sessions.length <= MAX_CHAT_SESSIONS) return sessions
  const sorted = [...sessions].sort((a, b) => a.updatedAt - b.updatedAt)
  return sorted.slice(-MAX_CHAT_SESSIONS)
}

export function loadGameChatState(gameId: string): StoredGameSessions {
  if (typeof window === 'undefined') {
    const s = createEmptySession()
    return { version: STORAGE_VERSION, sessions: [s], activeSessionId: s.id }
  }
  try {
    const raw = localStorage.getItem(storageKeyForGame(gameId))
    if (!raw) {
      const s = createEmptySession()
      return { version: STORAGE_VERSION, sessions: [s], activeSessionId: s.id }
    }
    const parsed = JSON.parse(raw) as Partial<StoredGameSessions>
    if (!parsed.sessions || !Array.isArray(parsed.sessions) || parsed.sessions.length === 0) {
      const s = createEmptySession()
      return { version: STORAGE_VERSION, sessions: [s], activeSessionId: s.id }
    }
    const sessions = parsed.sessions.map(normalizeSession)
    const activeFromStore =
      typeof parsed.activeSessionId === 'string' ? parsed.activeSessionId : ''
    const activeSessionId = sessions.some((x) => x.id === activeFromStore)
      ? activeFromStore
      : sessions[0]!.id
    return { version: STORAGE_VERSION, sessions, activeSessionId }
  } catch {
    const s = createEmptySession()
    return { version: STORAGE_VERSION, sessions: [s], activeSessionId: s.id }
  }
}

export function saveGameChatState(gameId: string, state: StoredGameSessions): void {
  try {
    let sessions = trimSessionsToLimit(
      state.sessions.map((s) => ({ ...s, messages: sanitizeMessagesForStorage(s.messages) })),
    )
    let activeSessionId = state.activeSessionId
    if (!sessions.some((s) => s.id === activeSessionId)) {
      activeSessionId = sessions[0]?.id ?? activeSessionId
    }
    if (sessions.length === 0) {
      const s = createEmptySession()
      sessions = [s]
      activeSessionId = s.id
    }
    localStorage.setItem(
      storageKeyForGame(gameId),
      JSON.stringify({
        version: STORAGE_VERSION,
        sessions,
        activeSessionId,
      }),
    )
  } catch (e) {
    console.warn('local chat save failed', e)
  }
}

export function formatSessionTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return d.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
