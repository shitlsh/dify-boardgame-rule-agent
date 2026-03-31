# TODO — 桌游规则问答 Step-by-Step 实施清单

> 按 Phase 顺序执行。每项完成后打勾 `[x]`。

---

## Phase 1：基础设施搭建 (Infra & Foundation)

### Dify 环境
- [x] 使用 Docker Compose 在本地启动 Dify（参考官方文档）
- [x] 登录 Dify 控制台，熟悉界面：应用、知识库、工作流入口
- [ ] 在 Dify 中创建一个 API Key（应用级），记录至 `.env`
- [ ] 在 Dify 中创建一个 Knowledge Base API Key（独立），记录至 `.env`
- [ ] 配置 Dify 的 LLM Provider → 添加 Gemini API Key

### Next.js 应用初始化
- [x] `webapp/` 目录已初始化（package.json, next.config.ts, tsconfig.json, tailwind, postcss）
- [x] 依赖已安装：`cd webapp && npm install`
- [x] Prisma + SQLite 已配置
- [ ] （可选）安装 Shadcn UI：`cd webapp && npx shadcn@latest init`

### 数据库设计
- [x] `webapp/prisma/schema.prisma` 已定义 `Game` 模型（id, name, slug, gameType, datasetId, version...）
- [x] `webapp/prisma/schema.prisma` 已定义 `Task` 模型（id, gameId, status, errorMsg...）
- [x] 已运行 `npx prisma migrate dev --name init`，`dev.db` 已生成
- [x] Prisma Client 已生成

### 本地存储目录
- [x] `storage/raw/` 和 `storage/output/` 已创建（带 `.gitkeep`）
- [x] `storage_manifests/games.json` 已创建
- [x] `.gitignore` 已配置：忽略 `storage/*` 内容，保留 `storage_manifests/`

### 环境变量
- [x] `.env.example` 已更新，包含所有变量键名和说明
- [x] `webapp/.env` 已创建（本地开发用，已被 .gitignore 忽略）
  - 默认 `DIFY_MOCK_MODE=true`，无需 Dify 即可运行完整 ETL 流程

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

### 存储层封装（`webapp/lib/storage.ts`）
- [x] 实现 `storage.ts`：全部封装已完成
  - `saveMarkdown`, `saveSegments`, `ensureRawDir`, `updateManifest` 均已实现

### Dify API 封装（`webapp/lib/dify/`）
- [x] 实现 `workflow.ts`：已完成（Mock + Real 双模式，自动分批 ≤ 20 张）
- [x] 实现 `datasets.ts`：已完成（Mock + Real，createDataset / uploadDocument / pollDocumentIndexing / exportSegments）
- [x] 实现 `lib/dify/etl.ts`：ETL 流程编排已完成（含 8 个步骤）

### 管理后台前端
- [x] 实现 `webapp/app/(admin)/layout.tsx`：侧边栏导航 + Mock 模式指示器
- [x] 实现 `webapp/app/(admin)/dashboard/page.tsx`：游戏列表 + 任务状态表格 + 自动轮询（TaskRefresher）
- [x] 实现 `webapp/app/(admin)/games/new/page.tsx`：添加游戏表单（URL / ZIP / PDF ）

### 后端 API Routes
- [x] 实现 `webapp/app/api/games/route.ts`：GET（列表）
- [x] 实现 `webapp/app/api/tasks/route.ts`：已完成（GET 查询 / POST 创建任务 + 触发 ETL）
- [x] 实现 `webapp/app/api/tasks/[taskId]/route.ts`：单条任务状态查询

### 端到端测试
- [ ] 通过 Admin UI 添加一款已有规则书图片的游戏，验证 ETL 全流程
- [ ] 检查 `storage/output/<game_slug>/` 中 `rules_V1.md` 和 `segments_V1.json` 是否生成
- [ ] 检查 `storage_manifests/games.json` 是否已更新
- [ ] 在 Dify 控制台确认对应知识库已创建并索引完成

---

## Phase 4：问答引擎接入 (Two-Step RAG Q&A)

### Dify Chatbot 配置
- [ ] 在 Dify 中创建新 Chatbot 应用，命名为 `boardgame-qa`，**不挂载任何知识库**
- [ ] 编写 System Prompt：
  - AI 规则助手人设、准确亲切的语气
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

---

## 数据管理 / 运维 (Data Ops)

> 与 Phase 无关的运维操作，按需执行。

### Docker Volume 备份（Layer 1）
- [ ] 在服务器上创建 `backups/` 目录（加入 `.gitignore`）
- [ ] 配置定期备份脚本（cron 或手动）：
  ```bash
  docker run --rm \
    -v dify_db_data:/data/db \
    -v dify_weaviate_data:/data/weaviate \
    -v dify_storage_data:/data/storage \
    -v $(pwd)/backups:/backup \
    alpine tar czf /backup/dify-$(date +%Y%m%d).tar.gz /data
  ```
- [ ] 验证备份：解压后重启 Dify 确认知识库完整可用

### 段落快照迁移（Layer 2）
- [ ] 迁移时准备脚本：读取 `storage/output/<slug>/segments_V<n>.json` → 调用 Datasets API 自定义分段上传 → 仅重 Embedding（跳过 Chunking + High-quality 索引）
- [ ] 迁移后更新 SQLite 中的 `dataset_id` 新值，并同步 `storage_manifests/games.json`

### 规则书更新流程
- [ ] 规则书勘误或新扩展包时：在 Admin UI 重新提交任务，版本号自增（`rules_V2.md`, `segments_V2.json`）
- [ ] 旧版本文件保留，不覆盖，以便回滚
- [ ] `storage_manifests/games.json` 中更新 `version` 字段，提交 Git
