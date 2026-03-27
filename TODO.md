# TODO — 桌游规则问答 Step-by-Step 实施清单

> 按 Phase 顺序执行。每项完成后打勾 `[x]`。

---

## Phase 1：基础设施搭建 (Infra & Foundation)

### Dify 环境
- [ ] 使用 Docker Compose 在本地启动 Dify（参考官方文档）
- [ ] 登录 Dify 控制台，熟悉界面：应用、知识库、工作流入口
- [ ] 在 Dify 中创建一个 API Key（应用级），记录至 `.env`
- [ ] 在 Dify 中创建一个 Knowledge Base API Key（独立），记录至 `.env`
- [ ] 配置 Dify 的 LLM Provider → 添加 Gemini API Key

### Next.js 应用初始化
- [ ] 在 `webapp/` 目录下运行 `npx create-next-app@latest . --typescript --tailwind --app` 初始化项目
- [ ] 安装 Shadcn UI：`npx shadcn@latest init`
- [ ] 安装 Prisma：`npm install prisma @prisma/client` 并运行 `npx prisma init --datasource-provider sqlite`

### 数据库设计
- [ ] 在 `webapp/prisma/schema.prisma` 中定义 `Game` 模型：
  - `id`, `name`, `coverUrl`, `playerCount`, `gameType`, `datasetId`, `createdAt`
- [ ] 在 `webapp/prisma/schema.prisma` 中定义 `Task` 模型：
  - `id`, `gameId`, `status`（Pending/Processing/Completed/Failed）, `errorMsg`, `createdAt`, `updatedAt`
- [ ] 运行 `npx prisma migrate dev --name init` 生成首次迁移
- [ ] 运行 `npx prisma generate` 生成 Prisma Client

### 环境变量
- [ ] 更新 `.env.example`，补充所有需要的变量键名（`DIFY_API_KEY`, `DIFY_BASE_URL`, `DIFY_DATASET_API_KEY`, `GEMINI_API_KEY`）
- [ ] 在本地 `.env` 中填入真实值

---

## Phase 2：提取引擎构建 (Dify Extractor Workflow)

### Dify 知识库
- [ ] 在 Dify 中创建【通用桌游术语知识库】（Glossary KB）
- [ ] 录入常见桌游机制术语（抽牌、工人放置、合作、引擎构建等中英文对照及定义）
- [ ] 测试知识库检索效果，确认相关术语能够被命中

### Dify Workflow 构建
- [ ] 在 Dify 中创建新 Workflow，命名为 `boardgame-extractor`
- [ ] 添加**输入节点**，定义两个参数：`images`（图片 Base64 数组）和 `game_type`（字符串）
- [ ] 添加**知识检索节点**，绑定 Glossary KB，用 `game_type` 或固定 query 检索相关术语
- [ ] 添加 **LLM 节点**（Gemini），构建 System Prompt：
  - 引用 `data_pipeline/prompt_templates/general/base_V1.md` 的内容
  - 在 Prompt 中注入知识检索结果（术语对照）
  - 接收 `images` 作为视觉输入
- [ ] 添加**输出节点**，输出字段 `markdown_content`
- [ ] 在 Dify 中测试工作流（用 1-2 张规则书图片验证）
- [ ] 将工作流导出 YAML 保存至 `dify_config/workflows/boardgame-extractor.yml`

---

## Phase 3：全自动 ETL 闭环 (Next.js + Dify API)

### Dify API 封装（`webapp/lib/dify/`）
- [ ] 实现 `workflow.ts`：
  - `runExtractorWorkflow(images: string[], gameType: string): Promise<string>` — 调用 Workflow API，处理轮询（异步模式）
  - 实现分批逻辑：单批不超过 20 张图，多批结果有序拼接
- [ ] 实现 `datasets.ts`：
  - `createDataset(name: string): Promise<string>` — 创建知识库，返回 `datasetId`
  - `uploadDocument(datasetId: string, markdown: string, gameName: string): Promise<string>` — 上传 Markdown，指定切分符 `\n# `，返回 `documentId`
  - `pollDocumentIndexing(datasetId: string, documentId: string): Promise<void>` — 轮询直至索引完成

### 管理后台前端
- [ ] 实现 `webapp/app/(admin)/dashboard/page.tsx`：游戏列表 + 任务状态表格
- [ ] 实现 `webapp/app/(admin)/games/new/page.tsx`：添加游戏表单
  - 字段：游戏名称、游戏类型（下拉）、来源（URL / 上传 PDF / 上传 ZIP）
  - 提交后调用 `/api/tasks` 创建任务，跳转返回 Dashboard 查看进度

### 后端 API Routes
- [ ] 实现 `webapp/app/api/games/route.ts`：GET（列表）、POST（创建游戏元数据）
- [ ] 实现 `webapp/app/api/tasks/route.ts`：
  - POST：接收游戏参数 → 创建 Task 记录 → 异步启动 ETL 流程
  - GET：按 `gameId` 或 `taskId` 查询任务状态（用于前端轮询）
  - ETL 流程：下载/接收素材 → 调用 Workflow（分批）→ 合并 MD + 写入 `data_pipeline/output/` → 调用 Datasets API 建库 → 更新 `Game.datasetId` + Task 状态

### 端到端测试
- [ ] 通过 Admin UI 添加一款已有规则书图片的游戏，验证 ETL 全流程
- [ ] 检查 `data_pipeline/output/` 中 Markdown 备份是否生成
- [ ] 在 Dify 控制台确认对应知识库已创建并索引完成

---

## Phase 4：问答引擎接入 (Two-Step RAG Q&A)

### Dify Chatbot 配置
- [ ] 在 Dify 中创建新 Chatbot 应用，命名为 `boardgame-qa`，**不挂载任何知识库**
- [ ] 编写 System Prompt：
  - 桌游裁判人设、权威语气
  - 防幻觉声明（"仅基于 [规则参考] 中的原文内容回答，原文未提及时明确声明"）
  - 上下文接收格式：`[规则参考]\n{chunks}\n[玩家问题]\n{user_message}`
  - 强制格式化输出（分点列举、关键术语加粗）
- [ ] 测试 Chatbot：手动粘贴一段规则文本验证 Prompt 效果
- [ ] 记录 Chatbot 的应用 API Key，更新至 `.env`（`DIFY_CHATBOT_API_KEY`）
- [ ] 将 Chatbot 配置导出保存至 `dify_config/apps/boardgame-qa.yml`

### 两步 RAG 后端实现
- [ ] 实现 `webapp/lib/dify/chat.ts`：
  - `retrieveRules(datasetId: string, query: string, topK?: number): Promise<string[]>` — 调用 `POST /v1/datasets/{datasetId}/retrieve`
  - `assembleQuery(chunks: string[], userMessage: string): string` — 拼装注入格式
  - `sendChatMessage(assembledQuery: string, conversationId?: string): AsyncIterable<string>` — 调用 `POST /v1/chat-messages`（stream 模式），返回 SSE 流
- [ ] 实现 `webapp/app/api/chat/route.ts`（SSE 端点）：
  - 接收 `{ gameId, message, conversationId? }`
  - 从 DB 查出 `datasetId`
  - 执行两步 RAG
  - 将 Dify SSE 流透传给前端，首个 chunk 响应头中携带 `conversation_id`

### 单元测试（可选但推荐）
- [ ] 用 `curl` 或 Postman 直接测试 `/api/chat` 端点，验证流式响应和多轮 `conversation_id` 连续性

---

## Phase 5：C 端问答交互 (User-Facing Chat UI)

### 游戏大厅
- [ ] 实现 `webapp/app/(chat)/page.tsx`：调用 `/api/games` 渲染游戏卡片（封面、名称、玩家人数）
- [ ] 点击卡片跳转至 `/games/[gameId]` 聊天室

### 聊天室
- [ ] 实现 `webapp/app/(chat)/games/[gameId]/page.tsx`：
  - 消息列表（区分用户消息 / AI 回答）
  - 流式打字机效果（基于 SSE，读取 `ReadableStream`）
  - 输入框 + 发送按钮（支持 Enter 发送）
  - `conversationId` 存入 React state（`useState`），首次为空，首次响应后赋值，后续消息携带
- [ ] 实现 `webapp/components/chat/` 中的子组件：
  - `MessageList.tsx`
  - `MessageBubble.tsx`（区分 user / assistant 样式）
  - `ChatInput.tsx`

### 体验优化
- [ ] 加载状态：AI 思考中显示 Skeleton 或 "..." 动画
- [ ] 错误处理：网络失败 / Dify 报错时展示友好提示，不崩溃
- [ ] 游戏大厅：未完成建库（Task 非 Completed）的游戏卡片置灰，不可进入聊天

### 最终验收
- [ ] 完整走通一次用户旅程：Admin 添加游戏 → ETL 完成 → C 端进入聊天室 → 多轮问答正常
- [ ] 将 Dify 所有应用/流配置导出更新至 `dify_config/`
- [ ] 更新 README 快速开始章节，补充完整命令
