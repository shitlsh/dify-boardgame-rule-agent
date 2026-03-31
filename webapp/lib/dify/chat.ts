/**
 * Two-Step RAG Chat
 *
 * Step 1 — Retrieve: POST /v1/datasets/{datasetId}/retrieve
 *   Query the game-specific Knowledge Base for Top-K relevant rule chunks.
 *
 * Step 2 — Generate: POST /v1/chat-messages (streaming)
 *   Prepend retrieved chunks to the user message and stream the response from
 *   the Context-Injected Q&A Chatbot (no KB attached).
 *   Pass conversation_id to maintain multi-turn history on the Dify side.
 *
 * Mock mode (DIFY_MOCK_MODE=true): returns a synthetic streamed response so
 * the full chat UI can be developed without a running Dify instance.
 */

import { sleep } from '@/lib/utils'

const MOCK = process.env.DIFY_MOCK_MODE === 'true'
const DIFY_BASE_URL = process.env.DIFY_BASE_URL ?? 'http://localhost/v1'
const DATASET_API_KEY = process.env.DIFY_DATASET_API_KEY ?? ''
const CHATBOT_API_KEY = process.env.DIFY_CHATBOT_API_KEY ?? ''

export interface ChatChunk {
  type: 'text' | 'conversation_id' | 'error'
  value: string
}

const MOCK_ANSWERS = [
  '根据规则原文，在**准备阶段**，每位玩家需要：\n\n1. 将所有资源标记归零\n2. 从牌库抽取 4 张手牌\n3. 将行动标记放置在起始位置\n\n如果牌库不足，请先将弃置堆洗牌后重置为牌库。',
  '关于**战斗结算**的详细规则如下：\n\n- 攻击方宣布攻击目标\n- 防守方可选择是否格挡（消耗 1 行动点）\n- 双方同时掷骰，攻击方骰值 ≥ 防守方骰值 + 护甲值时，判定命中\n- 命中后造成武器基础伤害，扣除目标剩余护甲\n\n> 💡 提示：特殊技能"背刺"可无视护甲值，但只能在对方未行动时使用。',
  '规则原文对于**得分计算**的说明：\n\n| 得分项 | 分值 |\n|-------|------|\n| 每块领地控制 | +2 分 |\n| 城市建设 | +5 分 |\n| 完成任务卡 | 卡面标注 |\n| 剩余资源 | 每 3 个资源 +1 分 |\n\n游戏结束时，拥有最多**连续领地**的玩家额外获得 3 分的区域奖励。',
]

let mockAnswerIndex = 0

async function* mockStream(datasetId: string): AsyncGenerator<ChatChunk> {
  await sleep(400)
  // First yield the conversation_id
  yield { type: 'conversation_id', value: `mock-conv-${datasetId}-${Date.now()}` }

  const answer = MOCK_ANSWERS[mockAnswerIndex % MOCK_ANSWERS.length]
  mockAnswerIndex++

  // Stream the answer character by character in chunks
  const words = answer.split('')
  let buffer = ''
  for (const char of words) {
    buffer += char
    if (buffer.length >= 4 || char === '\n') {
      await sleep(20)
      yield { type: 'text', value: buffer }
      buffer = ''
    }
  }
  if (buffer) yield { type: 'text', value: buffer }
}

/** Step 1: Retrieve relevant rule chunks from the game's Knowledge Base */
async function retrieveChunks(datasetId: string, query: string, topK = 5): Promise<string[]> {
  const res = await fetch(`${DIFY_BASE_URL}/datasets/${datasetId}/retrieve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DATASET_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      retrieval_model: {
        search_method: 'hybrid_search',
        reranking_enable: true,
        top_k: topK,
        score_threshold_enabled: true,
        score_threshold: 0.3,
      },
    }),
  })
  if (!res.ok) throw new Error(`Retrieve failed ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const records = (data.records ?? []) as Array<{ segment: { content: string } }>
  return records.map((r) => r.segment.content).filter(Boolean)
}

/** Assemble the context-injected query string sent to the Chatbot */
function assembleQuery(chunks: string[], userMessage: string): string {
  if (chunks.length === 0) {
    // Fallback: let the Chatbot acknowledge it has no reference material
    return `[规则参考]\n（未检索到相关规则片段）\n\n[玩家问题]\n${userMessage}`
  }
  const context = chunks.map((c, i) => `[片段 ${i + 1}]\n${c}`).join('\n\n')
  return `[规则参考]\n${context}\n\n[玩家问题]\n${userMessage}`
}

/**
 * Step 2: Stream the chatbot response.
 * Yields ChatChunk items: first the conversation_id, then text delta chunks.
 */
async function* streamChatbot(
  assembledQuery: string,
  conversationId?: string,
): AsyncGenerator<ChatChunk> {
  const body: Record<string, unknown> = {
    inputs: {},
    query: assembledQuery,
    response_mode: 'streaming',
    user: 'end-user',
  }
  if (conversationId) body.conversation_id = conversationId

  const res = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CHATBOT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`Chat API error ${res.status}: ${await res.text()}`)
  if (!res.body) throw new Error('No response body from Chat API')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let conversationIdEmitted = false
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? '' // keep last (possibly incomplete) line

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (raw === '[DONE]') return

      let event: Record<string, unknown>
      try {
        event = JSON.parse(raw) as Record<string, unknown>
      } catch {
        continue
      }

      // Emit conversation_id once (present on first message event)
      if (!conversationIdEmitted && event.conversation_id) {
        yield { type: 'conversation_id', value: event.conversation_id as string }
        conversationIdEmitted = true
      }

      if (event.event === 'message' && typeof event.answer === 'string') {
        yield { type: 'text', value: event.answer }
      }
    }
  }
}

/**
 * Main entry point: perform two-step RAG and return an async generator of chunks.
 * Callers stream chunks to the client via SSE.
 */
export async function* twoStepRAG(params: {
  datasetId: string
  userMessage: string
  conversationId?: string
}): AsyncGenerator<ChatChunk> {
  const { datasetId, userMessage, conversationId } = params

  if (MOCK) {
    yield* mockStream(datasetId)
    return
  }

  try {
    const chunks = await retrieveChunks(datasetId, userMessage)
    const assembled = assembleQuery(chunks, userMessage)
    yield* streamChatbot(assembled, conversationId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    yield { type: 'error', value: msg }
  }
}
