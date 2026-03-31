/**
 * Dify Extractor Workflow API
 *
 * Mock mode (DIFY_MOCK_MODE=true): returns synthetic Markdown without
 * calling Dify—useful for UI development without a running Dify instance.
 *
 * Real mode: calls the Dify Workflow API, batching images in groups of
 * BATCH_SIZE (≤20) to respect LLM context window limits, then concatenates
 * the Markdown output from each batch.
 */

import { sleep } from '@/lib/utils'

const MOCK = process.env.DIFY_MOCK_MODE === 'true'
const DIFY_BASE_URL = process.env.DIFY_BASE_URL ?? 'http://localhost/v1'
const WORKFLOW_API_KEY = process.env.DIFY_WORKFLOW_API_KEY ?? ''
const BATCH_SIZE = 20

function buildMockMarkdown(gameType: string): string {
  return `# 游戏规则（Mock 示例）

> ⚠️ 当前为 **Mock 模式**（\`DIFY_MOCK_MODE=true\`），此文档由系统自动生成，非真实规则。

## 游戏概述

这是一款 **${gameType}** 类桌游的示例规则文档。

## 游戏准备

1. 将所有组件放置在桌面中央
2. 每位玩家取初始资源
3. 随机确定先手玩家

## 游戏流程

### 回合结构

每位玩家在自己的回合依次执行以下阶段：

1. **准备阶段：** 补充手牌至上限
2. **行动阶段：** 最多执行 2 个行动
3. **结算阶段：** 检查胜利条件

### 可选行动

- 移动到相邻区域
- 收集资源
- 建造建筑（花费 2 资源）
- 发动攻击（消耗行动点）

## 胜利条件

率先积累 **10 分**的玩家立即赢得游戏。

## 特殊规则

> 💡 当场上出现特定条件时，触发事件牌效果。详见附录 A。
`
}

async function pollWorkflowTask(taskId: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    await sleep(2000)
    const res = await fetch(`${DIFY_BASE_URL}/workflows/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${WORKFLOW_API_KEY}` },
    })
    if (!res.ok) throw new Error(`Workflow poll error: ${res.status}`)
    const data = await res.json()
    if (data.status === 'succeeded') return (data.outputs?.markdown_content as string) ?? ''
    if (data.status === 'failed') throw new Error(`Workflow failed: ${data.error ?? 'unknown'}`)
  }
  throw new Error('Workflow polling timeout after 60s')
}

/**
 * Run the Dify Extractor Workflow on a list of base64-encoded images.
 * Automatically batches input if imageBase64s.length > BATCH_SIZE.
 * Returns concatenated Markdown from all batches.
 */
export async function runExtractorWorkflow(
  imageBase64s: string[],
  gameType: string,
): Promise<string> {
  if (MOCK) {
    await sleep(1500) // simulate processing time
    return buildMockMarkdown(gameType)
  }

  const batches: string[][] = []
  for (let i = 0; i < imageBase64s.length; i += BATCH_SIZE) {
    batches.push(imageBase64s.slice(i, i + BATCH_SIZE))
  }
  if (batches.length === 0) batches.push([]) // handle empty input gracefully

  const parts: string[] = []
  for (const batch of batches) {
    const res = await fetch(`${DIFY_BASE_URL}/workflows/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WORKFLOW_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: { images: batch, game_type: gameType },
        response_mode: 'blocking',
        user: 'etl-pipeline',
      }),
    })
    if (!res.ok) throw new Error(`Workflow API error ${res.status}: ${await res.text()}`)
    const data = await res.json()
    // Dify may return task_id (async) or outputs directly (blocking)
    if (data.task_id) {
      parts.push(await pollWorkflowTask(data.task_id as string))
    } else {
      parts.push((data.data?.outputs?.markdown_content as string) ?? '')
    }
  }

  return parts.join('\n\n')
}
