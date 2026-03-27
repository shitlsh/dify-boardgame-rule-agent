## 1. 系统架构概览 (System Architecture)

本项目采用前后端分离 + AI 引擎编排的架构，核心分为三层：

### 1.1 前端展现层 (Frontend - Next.js App Router)
* **技术栈：** Next.js (React), TailwindCSS, Shadcn UI
* **核心模块：**
    * **管理后台 (Admin Dashboard)：** 提交抓取任务（输入集石 URL / 上传 PDF / 上传图片压缩包），实时查看 ETL 处理进度。
    * **C端问答界面 (Chat UI)：** 用户选择特定的桌游，进入专属聊天室进行规则问答（支持多轮连续提问）。

### 1.2 业务逻辑与中间件层 (Backend - Next.js API Routes)
* **技术栈：** Next.js API, Prisma (ORM), SQLite (轻量级本地数据库)
* **核心模块：**
    * **数据库 (Database)：** 存储游戏元数据（名称、封面、玩家人数、游戏类型）、任务状态（Pending/Processing/Completed）、以及与 Dify 系统绑定的 `dataset_id`。
    * **文件处理中心：** 接收上传的压缩包/PDF，解压、图片排序、本地/对象存储暂存。支持超大规则书的分批处理调度。
    * **Dify API 调度器：** 负责与底层 Dify 引擎进行安全通信（鉴权、轮询、错误重试），以及编排两步 RAG 查询流程。

### 1.3 底层 AI 引擎层 (AI Engine - Self-hosted Dify)
* **技术栈：** Docker 部署的私有化 Dify
* **核心模块：**
    * **提取工作流 (Extractor Workflow)：** 接收图片批次 + 游戏类型参数，挂载【通用桌游术语知识库】辅助提取，输出标准化 Markdown。针对不同游戏类型（抽牌、工人放置、合作类等）可扩展独立子流。
    * **规则向量知识库 (Datasets)：** 每款游戏对应一个独立的 Knowledge Base，通过 Datasets API 自动创建与维护。
    * **上下文注入问答机器人 (Context-Injected Q&A Chatbot)：** 一个无预挂载知识库的 Chatbot，通过严苛的 System Prompt 指导其基于动态注入的规则原文片段进行回答，由 Next.js 后端在每次请求时注入检索结果。
    * **自定义工具 API (Custom Tools API)：** 预留扩展槽位，未来为问答 Agent 提供复杂桌游辅助计算能力（如血量跟踪、得分计算等），通过 OpenAPI Spec 注册至 Dify。Demo 阶段留空。

---

## 2. 实施演进路径 (5步走 Roadmap)

### Phase 1: 基础设施搭建 (Infra & Foundation)
* **目标：** 准备好开发与 AI 环境。
* **Action：**
    1. 使用 Docker 本地/云端自部署 Dify（熟悉界面、API 密钥管理）。
    2. 使用 `npx create-next-app` 初始化前端工程，配置 Prisma 和 SQLite。
    3. 设计基础数据库表结构：`Game` 表（存名称、封面、game_type、dataset_id）和 `Task` 表（存提炼进度）。

### Phase 2: 提取引擎构建 (The Extractor Workflow)
* **目标：** 在 Dify 内构建知识库增强的、可扩展的高质量清洗流水线。
* **Action：**
    1. 在 Dify 创建【通用桌游术语知识库】（Glossary KB），录入常见机制的中英文对照及标准定义。
    2. 在 Dify 中建立一个 **Workflow（工作流）**，接受两个输入参数：**图片批次数组**和 **`game_type`（游戏类型）**。
    3. 工作流节点设计：输入节点 → 知识检索节点（查 Glossary KB） → LLM 节点（Gemini，基于检索结果提炼 Markdown） → 输出节点。
    4. **游戏类型路由（可扩展）：** 通过 `game_type` 参数，未来可 fork 出针对不同游戏结构的专用子流（例如抽牌游戏强调卡牌描述格式，工人放置游戏强调阶段与行动空间结构）。
    5. **大型规则书处理策略：** 单次 Workflow 调用建议不超过 20 张图片（受 LLM context window 限制）。超大规则书（40+页）应在 Next.js 后端按章节分批调用 Workflow，将多次返回的 Markdown 有序合并后再进行后续步骤。

### Phase 3: 全自动 ETL 闭环 (Next.js + Dify API)
* **目标：** 让 Next.js 后端接管繁琐的建库流程。
* **Action：**
    1. **前端开发：** 开发"添加游戏"表单页面（填写游戏名称、游戏类型、来源 URL 或上传文件）。
    2. **后端开发 (难点)：**
        * 接收前端任务，按分批策略调用 Dify 的 **Workflow API**，将图片传给"提取工作流"。
        * 将多批次返回的 Markdown 合并，存入本地文件系统作为备份（`data_pipeline/output/`）。
        * 调用 Dify 的 **Datasets API**：自动新建一个知识库，上传合并后的 Markdown，强制指定切分标识符为 `\n# `（按一级标题切段）。
        * 将 Dify 返回的 `dataset_id` 存入本地 SQLite 数据库并更新 Task 状态为 Completed。

### Phase 4: 问答引擎接入 (Two-Step RAG Q&A)
* **目标：** 构建能动态路由至任意游戏知识库、支持多轮对话的问答引擎。
* **架构说明（两步 RAG）：**
    * **为什么不直接用 Chatbot 挂载知识库？** Dify Chatbot/Agent 的知识库绑定是应用配置层的静态设置，Chat Messages API 不支持运行时动态传入 `dataset_id`，无法实现多游戏路由。
    * **为什么不用 Workflow 做问答？** Workflow 不原生支持多轮会话历史，需要大量手动状态管理，不适合连续问答场景。
    * **两步 RAG 方案：** Next.js 后端在每次用户提问时，先显式调用检索，再将检索结果注入问答请求，将动态路由与多轮对话的能力分离管理。
* **Action：**
    1. 在 Dify 中创建一个无预挂载知识库的 **Chatbot**（普通对话模式）。
    2. 编写严苛的 System Prompt：桌游裁判人设、防幻觉声明（"仅基于提供的规则原文回答，原文未提及的内容必须明确声明不确定"）、强制结构化输出格式。Prompt 中定义接收注入上下文的结构标记，例如 `[规则参考]\n...\n[玩家问题]\n...`。
    3. **两步调用流程（由 Next.js 后端实现）：**
        * **Step 1 - 检索：** `POST /v1/datasets/{dataset_id}/retrieve`，以用户问题为 query，检索该游戏知识库，获取 Top-K 相关规则片段。
        * **Step 2 - 生成：** 将检索到的片段拼装为上下文前缀，构成 `assembled_query = "[规则参考]\n{chunks}\n[玩家问题]\n{user_message}"`，然后 `POST /v1/chat-messages`（携带 `conversation_id`），发送给上述 Chatbot，获取流式回答。
        * Dify Chatbot 侧通过 `conversation_id` 原生维护多轮对话历史，Next.js 无需自行管理 history 数组。

### Phase 5: C端问答交互 (User-Facing Chat UI)
* **目标：** 最终的成品展示页面，支持多轮连续问答。
* **Action：**
    1. **前端开发：**
        * 游戏大厅页面：读取 SQLite 渲染游戏卡片列表，点击进入该游戏的聊天室。
        * 聊天室页面：类似 ChatGPT 的流式打字机效果 UI（基于 SSE）。
        * 会话管理：`conversation_id` 存储在**前端 React state**（非数据库），用户刷新页面或重新进入聊天室时开启新会话。如未来需要持久化历史，可扩展为存入 DB。
    2. **后端开发：**
        * 接收用户消息 + `game_id`，从数据库查出对应 `dataset_id`。
        * 执行 Phase 4 定义的两步 RAG 流程。
        * 将 Dify 响应的 SSE 流式透传回前端。
        * **首次消息响应头中包含 `conversation_id`**，前端存储并在后续每条消息中回传，实现多轮上下文连续性。
    3. **用户隔离设计：**
        * Demo 阶段为单用户场景，`conversation_id` 仅存于前端状态，天然隔离（不同浏览器标签页 = 不同会话）。
        * 生产化时，若需多用户并发访问同一游戏，应将 `(session_token, game_id, conversation_id)` 三元组存入数据库，确保不同用户的对话上下文严格隔离，避免会话混用。