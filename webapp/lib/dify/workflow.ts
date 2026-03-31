/**
 * Dify Extractor Workflow API (rule-extractor-engine)
 *
 * Workflow inputs:
 *   - rule_files: file-list
 *   - game_name: text
 *
 * Workflow outputs:
 *   - full_markdown
 *   - quick_start_guide
 */

import { sleep } from '@/lib/utils'

const MOCK = process.env.DIFY_MOCK_MODE === 'true'
const DIFY_BASE_URL = process.env.DIFY_BASE_URL ?? 'http://localhost/v1'
const WORKFLOW_API_KEY = process.env.DIFY_WORKFLOW_API_KEY ?? ''

export interface WorkflowFileInput {
  name: string
  bytes: Buffer
  mimeType: string
}

export interface ExtractorWorkflowResult {
  fullMarkdown: string
  quickStartGuide: string
}

function buildMockMarkdown(gameName: string): string {
  return `# 游戏规则（Mock 示例）

> ⚠️ 当前为 **Mock 模式**（\`DIFY_MOCK_MODE=true\`），此文档由系统自动生成，非真实规则。

## 游戏概述

这是一款 **${gameName}** 的示例规则文档。

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

function buildMockQuickStart(gameName: string): string {
  return `## 一句话目标
率先达成游戏胜利条件即可获胜。

## 核心配件认一认
- 玩家板：记录你的资源和行动状态
- 主牌库：提供行动与事件
- 计分标记：跟踪当前分数

## 回合三步曲
1. 抽牌并补充手牌
2. 执行 1-2 个行动
3. 结算回合并检查胜利

## 新手第一回合建议
优先做“稳健增益”行动（抽牌或拿基础资源），不要过早消耗高价值牌。

## 边玩边学清单
- 特殊边缘判定
- 平局细则
- 高级组合技（第二局再看）

> 以上为 ${gameName} 的 Mock 快速开始。`
}

async function uploadWorkflowFile(file: WorkflowFileInput): Promise<Record<string, string>> {
  const form = new FormData()
  const fileView = new Uint8Array(file.bytes)
  form.append(
    'file',
    new Blob([fileView], { type: file.mimeType }),
    file.name,
  )
  form.append('user', 'etl-pipeline')

  const res = await fetch(`${DIFY_BASE_URL}/files/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WORKFLOW_API_KEY}` },
    body: form,
  })
  if (!res.ok) throw new Error(`File upload failed ${res.status}: ${await res.text()}`)

  const data = (await res.json()) as { id?: string }
  if (!data.id) throw new Error('File upload failed: missing upload file id')

  return {
    type: file.mimeType.startsWith('image/') ? 'image' : 'document',
    transfer_method: 'local_file',
    upload_file_id: data.id,
  }
}

async function pollWorkflowTask(taskId: string): Promise<ExtractorWorkflowResult> {
  for (let i = 0; i < 30; i++) {
    await sleep(2000)
    const res = await fetch(`${DIFY_BASE_URL}/workflows/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${WORKFLOW_API_KEY}` },
    })
    if (!res.ok) throw new Error(`Workflow poll error: ${res.status}`)
    const data = await res.json()
    if (data.status === 'succeeded') {
      return {
        fullMarkdown: (data.outputs?.full_markdown as string) ?? '',
        quickStartGuide: (data.outputs?.quick_start_guide as string) ?? '',
      }
    }
    if (data.status === 'failed') throw new Error(`Workflow failed: ${data.error ?? 'unknown'}`)
  }
  throw new Error('Workflow polling timeout after 60s')
}

/**
 * Run the extractor workflow using already-prepared file inputs.
 */
export async function runExtractorWorkflow(
  ruleFiles: WorkflowFileInput[],
  gameName: string,
): Promise<ExtractorWorkflowResult> {
  if (MOCK) {
    await sleep(1500) // simulate processing time
    return {
      fullMarkdown: buildMockMarkdown(gameName),
      quickStartGuide: buildMockQuickStart(gameName),
    }
  }

  if (!WORKFLOW_API_KEY) throw new Error('Missing DIFY_WORKFLOW_API_KEY')
  if (ruleFiles.length === 0) throw new Error('No files provided for extractor workflow')

  const uploadedFiles: Record<string, string>[] = []
  for (const file of ruleFiles) {
    uploadedFiles.push(await uploadWorkflowFile(file))
  }

  const res = await fetch(`${DIFY_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WORKFLOW_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: { rule_files: uploadedFiles, game_name: gameName },
      response_mode: 'blocking',
      user: 'etl-pipeline',
    }),
  })
  if (!res.ok) throw new Error(`Workflow API error ${res.status}: ${await res.text()}`)

  const data = await res.json()
  if (data.task_id) {
    return await pollWorkflowTask(data.task_id as string)
  }

  return {
    fullMarkdown: (data.data?.outputs?.full_markdown as string) ?? '',
    quickStartGuide: (data.data?.outputs?.quick_start_guide as string) ?? '',
  }
}
