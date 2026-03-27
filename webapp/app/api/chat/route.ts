import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { twoStepRAG } from '@/lib/dify/chat'

export const dynamic = 'force-dynamic'

/**
 * POST /api/chat
 *
 * Body: { gameId: string, message: string, conversationId?: string }
 *
 * Returns a Server-Sent Events (SSE) stream with the following event types:
 *   data: {"type":"conversation_id","value":"..."}  — emitted once, on first response
 *   data: {"type":"text","value":"..."}             — streamed answer delta
 *   data: {"type":"error","value":"..."}            — error message
 *   data: [DONE]                                    — stream end
 */
export async function POST(req: NextRequest) {
  let body: { gameId?: string; message?: string; conversationId?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const { gameId, message, conversationId } = body
  if (!gameId || !message?.trim()) {
    return new Response(JSON.stringify({ error: 'gameId and message are required' }), {
      status: 400,
    })
  }

  const game = await prisma.game.findUnique({ where: { id: gameId } })
  if (!game) {
    return new Response(JSON.stringify({ error: 'Game not found' }), { status: 404 })
  }
  if (!game.datasetId) {
    return new Response(
      JSON.stringify({ error: '该游戏的知识库尚未建立，请先完成 ETL 流程' }),
      { status: 409 },
    )
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object | string) {
        const payload = typeof data === 'string' ? data : JSON.stringify(data)
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
      }

      try {
        for await (const chunk of twoStepRAG({
          datasetId: game.datasetId!,
          userMessage: message.trim(),
          conversationId,
        })) {
          send(chunk)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        send({ type: 'error', value: msg })
      } finally {
        send('[DONE]')
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
