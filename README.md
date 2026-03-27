# dify-boardgame-rule-agent

基于 [Dify](https://github.com/langgenius/dify) 的「桌游规则问答」全栈应用。覆盖完整产品链路：**ETL 数据管道**（规则书图片/PDF → Dify知识库）、**Next.js 全栈 Web 应用**（管理后台 + C端问答 UI）、以及**两步 RAG 问答引擎**（动态多游戏知识库路由 + 多轮对话）。

详细架构设计与演进路径见 [blueprint.md](./blueprint.md)。

---

## 项目简介

用户可在 Web 界面选择一款桌游，与 AI 规则助手进行多轮规则问答。系统通过两步 RAG 架构实现动态知识库路由：每次提问先检索该游戏专属知识库，再将规则原文片段注入 Dify Chatbot 生成回答，从而支持无限扩展游戏品类而无需修改 AI 配置。

**核心数据流：**

```
[规则书图片/PDF]
     │
     ▼
[Dify Extractor Workflow]  ←─ 挂载 Glossary KB（术语增强）
     │                         支持按游戏类型路由子流
     ▼
[结构化 Markdown]  ──backup──▶  data_pipeline/output/
     │
     ▼
[Dify Datasets API]  ──创建──▶  每款游戏独立 Knowledge Base
     │
     ▼  dataset_id 存入 SQLite
     
[用户提问]
     │
     ▼  Step 1: Retrieve API → Top-K 规则片段
     ▼  Step 2: 片段注入 → Context-Injected Chatbot (SSE)
     │
     ▼
[流式回答 → 前端打字机效果]
```

---

## 核心架构

| 层级 | 目录 / 组件 | 职责 |
|------|----------------|------|
| **前端展现层** | `webapp/app/(admin)/` | 管理后台：添加游戏、提交爬取/上传任务、查看 ETL 进度 |
| **前端展现层** | `webapp/app/(chat)/` | C 端问答：游戏大厅 + 多轮聊天室（SSE 流式打字机） |
| **业务逻辑层** | `webapp/app/api/` | Next.js API Routes：游戏 CRUD、ETL 任务调度、两步 RAG 问答 |
| **数据层** | `webapp/prisma/` | Prisma + SQLite：Game / Task 表结构与迁移 |
| **AI 引擎层** | 外部 Dify（Docker） | Extractor Workflow、规则知识库、Context-Injected Chatbot |
| **ETL 脚本** | `data_pipeline/` | 离线爬取脚本（集石）、POC 阶段验证脚本（保留） |
| **工具扩展** | `custom_tools_api/` | 未来为 Dify Agent 提供复杂计算工具（计分、骰子等），Demo 阶段留空 |
| **配置固化** | `dify_config/` | Dify 应用/工作流导出 YAML，版本化管理 |

---

## 目录结构

```
dify-boardgame-rule-agent/
├── README.md
├── blueprint.md              # 架构设计与演进路径文档
├── TODO.md                   # Step-by-step 实施清单
├── LICENSE
├── .gitignore
├── .env.example
│
├── webapp/                   # Next.js 全栈应用（Phase 1–5 主战场）
│   ├── app/
│   │   ├── (admin)/          # 路由组：管理后台（不暴露在 URL 中）
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/    # 游戏列表 + 任务进度总览
│   │   │   └── games/new/    # 添加游戏表单（URL / PDF / ZIP 上传）
│   │   ├── (chat)/           # 路由组：C 端问答
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx      # 游戏大厅（卡片列表）
│   │   │   └── games/[gameId]/  # 专属聊天室
│   │   ├── api/
│   │   │   ├── games/        # GET/POST 游戏元数据
│   │   │   ├── tasks/        # ETL 任务创建与状态轮询
│   │   │   └── chat/         # 两步 RAG 端点（SSE 流式响应）
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/               # Shadcn UI 基础组件
│   │   ├── admin/            # 管理后台专用组件
│   │   └── chat/             # 聊天室组件（消息列表、输入框、打字机等）
│   ├── lib/
│   │   ├── db.ts             # Prisma Client 单例
│   │   ├── utils.ts
│   │   └── dify/
│   │       ├── workflow.ts   # Extractor Workflow API 调用（含分批逻辑）
│   │       ├── datasets.ts   # Datasets API（建库、上传文档）
│   │       └── chat.ts       # 两步 RAG：Retrieve → Context Inject → Chat
│   ├── prisma/
│   │   ├── schema.prisma     # Game / Task 数据模型
│   │   └── migrations/
│   ├── public/
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── data_pipeline/            # ETL 数据管道（离线脚本）
│   ├── raw/                  # 原始规则书素材（.gitignore 忽略内容）
│   ├── output/               # 转换后 Markdown（可按需提交）
│   ├── prompt_templates/     # Gemini 提炼用 System Prompt（版本化管理）
│   │   └── general/
│   │       └── base_V1.md
│   └── scripts/
│       ├── fetch_gstone_rules.py   # 集石游戏规则书爬取
│       └── extract_rules_to_md.py  # 图片/PDF → Markdown（Gemini，POC 验证用）
│
├── custom_tools_api/         # 未来扩展：Dify 工具 API（Demo 阶段留空）
│   ├── openapi/              # OpenAPI YAML Spec
│   └── src/                  # 工具服务实现
│
└── dify_config/              # Dify 配置即代码
    ├── apps/                 # Chatbot / Agent 导出
    └── workflows/            # Extractor Workflow 导出
```

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端 | Next.js 15 (App Router), TailwindCSS, Shadcn UI |
| 后端 | Next.js API Routes, Prisma ORM, SQLite |
| AI 引擎 | Self-hosted Dify (Docker), Gemini (LLM/Vision) |
| 数据脚本 | Python 3.10+, google-genai |

---

## 快速开始

### 1. 环境准备

- 本地 Docker 运行 **Dify**（参考 [Dify 官方文档](https://docs.dify.ai/getting-started/install-self-hosted/docker-compose)）。
- 准备 **Gemini API Key**（用于 Dify LLM 配置及 data_pipeline 脚本）。
- Node.js 20+ 和 Python 3.10+。

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入以下内容
```

| 变量 | 说明 |
|------|------|
| `DIFY_API_KEY` | Dify 应用的 API Key |
| `DIFY_BASE_URL` | Dify 实例地址，如 `http://localhost/v1` |
| `DIFY_DATASET_API_KEY` | Dify Knowledge Base API Key（与应用 Key 独立） |
| `DIFY_CHATBOT_API_KEY` | Q&A Chatbot 应用的 API Key |
| `GEMINI_API_KEY` | Google Gemini API Key（data_pipeline 脚本使用） |
| `STORAGE_BASE_PATH` | 数据产物存储目录，默认 `./storage`（本地 demo） |

**切勿将 `.env` 提交到 Git。**

### 3. 启动 Web 应用

```bash
cd webapp
npm install
npx prisma migrate dev
npm run dev
```

### 4. 运行数据管道脚本（按需）

```bash
cd data_pipeline
pip install -r requirements.txt

# 爬取集石规则书图片
python scripts/fetch_gstone_rules.py --url <集石页面URL> --game <游戏名>

# 本地离线提炼 Markdown（POC 验证用）
python scripts/extract_rules_to_md.py --category general
```

### 3. 数据管道（占位）

1. 将规则书 PDF 或图片放入 `data_pipeline/raw/`。
2. 运行 `data_pipeline/scripts/` 下转换脚本（待实现）生成 Markdown 至 `data_pipeline/output/`。
3. 调用 Dify Datasets API 将文档写入目标知识库（待实现）。

### 4. 启动自定义工具 API（占位）

```bash
# 进入 custom_tools_api/src，按选定技术栈安装依赖并启动（待补充）
# 将 OpenAPI 文件路径或内容提供给 Dify Agent 的 Tool 配置
```

### 5. 导入 Dify 配置（占位）

1. 在 Dify 中关联知识库与 Tool（指向 `custom_tools_api` 暴露的地址）。
2. 将导出 YAML 保存到 `dify_config/workflows/` 或 `dify_config/apps/`，并提交到本仓库。

---

## 贡献与约定（建议）

- 配置与提示词变更尽量通过 `dify_config` 可追溯，避免仅在线上控制台修改。
- 工具接口保持**幂等与可测试**：输入输出在 OpenAPI 中写清楚，便于 Agent 稳定调用。
- 原始规则书版权归权利人所有；本仓库仅提供工程化流程，请遵守授权与使用范围。

---

## 许可证

本项目采用 [MIT License](LICENSE) 授权。

## 远程仓库

- GitHub：<https://github.com/shitlsh/dify-boardgame-rule-agent>
