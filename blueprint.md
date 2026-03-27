## 1. 系统架构概览 (System Architecture)

本项目采用前后端分离 + AI 引擎编排的架构，核心分为三层：

### 1.1 前端展现层 (Frontend - Next.js App Router)
* **技术栈：** Next.js (React), TailwindCSS, Shadcn UI
* **核心模块：**
    * **管理后台 (Admin Dashboard)：** 提交抓取任务（输入集石 URL / 上传 PDF / 上传图片压缩包），实时查看 ETL 处理进度。
    * **C端问答界面 (Chat UI)：** 用户选择特定的桌游，进入专属聊天室进行规则问答。

### 1.2 业务逻辑与中间件层 (Backend - Next.js API Routes)
* **技术栈：** Next.js API, Prisma (ORM), SQLite (轻量级本地数据库)
* **核心模块：**
    * **数据库 (Database)：** 存储游戏元数据（名称、封面、玩家人数）、任务状态（Pending/Processing/Completed）、以及与 Dify 系统绑定的 `dataset_id`。
    * **文件处理中心：** 接收上传的压缩包/PDF，解压、图片排序、本地/对象存储暂存。
    * **Dify API 调度器：** 负责与底层 Dify 引擎的 OpenAPI 进行安全通信（鉴权、轮询、错误重试）。

### 1.3 底层 AI 引擎层 (AI Engine - Self-hosted Dify)
* **技术栈：** Docker 部署的私有化 Dify
* **核心模块：**
    * **提取工作流 (Extractor Workflow)：** 接收图片，挂载【通用桌游术语知识库】，清洗并输出标准化 Markdown。
    * **规则向量知识库 (Datasets)：** 每一个游戏对应一个独立的 Knowledge Base。
    * **问答智能体 (Q&A Agent)：** 接收前端传来的玩家问题和选定的 `dataset_id`，进行混合检索并回答。

---

## 2. 实施演进路径 (5步走 Roadmap)

### Phase 1: 基础设施搭建 (Infra & Foundation)
* **目标：** 准备好开发与 AI 环境。
* **Action：**
    1. 使用 Docker 本地/云端自部署 Dify（熟悉界面、API 密钥管理）。
    2. 使用 `npx create-next-app` 初始化前端工程，配置 Prisma 和 SQLite。
    3. 设计基础数据库表结构：`Game` 表（存名称、封面、dataset_id）和 `Task` 表（存提炼进度）。

### Phase 2: 提取引擎构建 (The Extractor Workflow)
* **目标：** 在 Dify 内部构建高质量的清洗流水线。
* **Action：**
    1. 在 Dify 创建一个【通用桌游术语知识库】（Glossary KB），录入常见机制的中英文对照。
    2. 在 Dify 中建立一个 **Workflow (工作流)**，而非 Chatbot。
    3. 工作流节点设计：输入节点（接收图片数组） -> 知识检索节点（查术语库） -> LLM 节点（Gemini 提炼 Markdown） -> 输出节点。

### Phase 3: 全自动 ETL 闭环 (Next.js + Dify API)
* **目标：** 让 Next.js 后端接管繁琐的建库流程。
* **Action：**
    1. **前端开发：** 开发“添加游戏”表单页面。
    2. **后端开发 (难点)：**
        * 接收前端任务，调用 Dify 的 Workflow API，将图片传给“提取工作流”。
        * 拿到返回的 Markdown 文本后，存入本地文件系统以作备份。
        * 调用 Dify 的 **Datasets API**：自动新建一个知识库，上传 Markdown，强制指定切分标识符为 `\n# `。
        * 将 Dify 返回的 `dataset_id` 存入本地 SQLite 数据库。

### Phase 4: 问答引擎接入 (The Q&A Agent)
* **目标：** 构建能动态读取知识库的终端大脑。
* **Action：**
    1. 在 Dify 中创建一个 **Chatbot Agent**。
    2. 编写极其严苛的 System Prompt（桌游裁判人设、防幻觉声明、强制结构化输出）。
    3. **关键设计：** 这个 Agent 默认不挂载任何知识库。知识库的挂载动作，将由下一步的 Next.js API 在发起对话时动态传入。

### Phase 5: C端问答交互 (User-Facing Chat UI)
* **目标：** 最终的成品展示页面。
* **Action：**
    1. **前端开发：** 游戏大厅页面（读取 SQLite 渲染游戏列表），聊天室页面（类似 ChatGPT 的流式打字机效果 UI）。
    2. **后端开发：** * 接收用户消息，从数据库查出该游戏对应的 `dataset_id`。
        * 调用 Dify 的 **Chat Messages API**，在请求体 (Payload) 中动态传入 `dataset_ids: ["你的dataset_id"]`，实现精准路由。
        * 将 Dify 的流式响应 (SSE) 透传回前端界面。