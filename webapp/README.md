# webapp — 桌游规则问答 Web 应用

基于 **Next.js 15 App Router** 的全栈 Web 应用，提供桌游规则知识库的管理后台与 C 端问答界面。

完整的系统架构与演进路径见项目根目录的 [blueprint.md](../blueprint.md)。

---

## 功能列表

### 管理后台 (Admin)

| 功能 | 状态 | 路由 |
|------|------|------|
| 游戏库总览（列表 + 任务状态 + 自动刷新） | ✅ 已实现 | `/dashboard` |
| 添加游戏表单（URL / 多图 / PDF 三种来源） | ✅ 已实现 | `/games/new` |
| ETL 任务触发与状态轮询 API | ✅ 已实现 | `POST /api/tasks` |
| 单任务状态查询 API | ✅ 已实现 | `GET /api/tasks/[taskId]` |
| 游戏列表查询 API | ✅ 已实现 | `GET /api/games` |
| URL 来源实际爬取（调用集石爬虫） | ⬜ 待实现 | — |
| PDF 逐页渲染为图片后送入 Extractor | ✅ 已实现 | `lib/dify/input-preprocess.ts` |
| 游戏封面上传 / 编辑 | ⬜ 待实现 | — |
| ETL 进度实时推送（WebSocket / SSE） | ⬜ 待实现（当前为 2.5s 轮询） | — |

### 规则问答测试（管理员，与后台同侧边栏）

| 功能 | 状态 | 路由 |
|------|------|------|
| 测试大厅（仅展示已建库游戏） | ✅ 已实现 | `/chat` |
| 聊天室（检索 + Chatbot `context` 输入，SSE） | ✅ 已实现 | `/chat/[gameId]` |
| 旧链接兼容 | ✅ 已实现 | `/games/[gameId]` → 重定向至 `/chat/[gameId]` |
| 根路径 | ✅ 已实现 | `/` → 重定向至 `/dashboard` |

### 核心库 / 服务层

| 模块 | 状态 | 路径 |
|------|------|------|
| Prisma DB 单例 | ✅ 已实现 | `lib/db.ts` |
| 本地存储抽象（`storage/` 读写） | ✅ 已实现 | `lib/storage.ts` |
| Dify Extractor Workflow 调用（`rule_files`/`game_name`） | ✅ 已实现 | `lib/dify/workflow.ts` |
| Dify Datasets API（建库 / 上传 / 轮询 / 导出段落，可选参数后端配置） | ✅ 已实现 | `lib/dify/datasets.ts` |
| ETL 编排器（8 步全流程 + quick_start_guide 持久化） | ✅ 已实现 | `lib/dify/etl.ts` |
| 两步 RAG 问答（Retrieve + Chat） | ✅ 已实现 | `lib/dify/chat.ts` |
| 聊天 API Route（SSE 端点） | ✅ 已实现 | `app/api/chat/route.ts` |

---

## 技术架构

```
webapp/
├── app/
│   ├── (admin)/              # 路由组：管理后台（含规则问答测试）
│   │   ├── layout.tsx        # 侧边栏导航 + Mock 模式指示灯
│   │   ├── dashboard/        # 游戏库总览
│   │   ├── games/new/        # 添加游戏表单
│   │   └── chat/             # 规则问答测试大厅 + 聊天室
│   ├── api/
│   │   ├── games/            # 游戏元数据 CRUD
│   │   ├── tasks/            # ETL 任务：触发 + 状态查询
│   │   └── chat/             # 两步 RAG SSE 端点（Phase 4 实现）
│   ├── layout.tsx            # 根布局
│   ├── page.tsx              # 根路由 → 重定向至 /dashboard
│   └── games/[gameId]/       # 旧聊天链接 → 重定向至 /chat/[gameId]
├── components/
│   ├── ui/                   # Shadcn UI 基础组件（待引入）
│   ├── admin/                # 管理后台专用组件
│   └── chat/                 # 聊天室组件（Phase 5 实现）
├── lib/
│   ├── db.ts                 # Prisma Client 单例（防止 dev 热重载多实例）
│   ├── storage.ts            # storage/ 读写抽象，路径由 STORAGE_BASE_PATH 控制
│   ├── utils.ts              # cn(), slugify(), sleep()
│   └── dify/
│       ├── workflow.ts       # Extractor Workflow（Mock / Real 双模式，自动分批）
│       ├── datasets.ts       # Datasets API（Mock / Real 双模式）
│       ├── etl.ts            # ETL 编排（fire-and-forget，本地 dev 适用）
│       └── chat.ts           # 两步 RAG（Phase 4 实现）
└── prisma/
    ├── schema.prisma         # Game / Task 数据模型
    └── migrations/           # 自动生成的 SQL 迁移文件
```

### 数据模型

```prisma
model Game {
  id          String   // cuid
  name        String
  slug        String   @unique   // URL-safe 标识符
  gameType    String             // general / deck-building / worker-placement / ...
  datasetId   String?            // ETL 完成后写入的 Dify KB ID
  version     Int                // 每次重新建库自增
  tasks       Task[]
}

model Task {
  id       String
  gameId   String
  status   String   // PENDING | PROCESSING | COMPLETED | FAILED
  errorMsg String?
}
```

### Mock 模式

所有 Dify API 调用均内置 Mock 实现。通过 `DIFY_MOCK_MODE=true` 启用后：

- `runExtractorWorkflow` → 返回预设的 Markdown 样本（~1.5s 延迟）
- `createDataset` → 返回 `mock-dataset-<name>-<ts>`
- `uploadDocument` / `pollDocumentIndexing` / `exportSegments` → 立即 resolve

整个 ETL 流程（含 DB 写入、文件存储）可在无 Dify 实例的情况下完整运行。

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 环境变量

```bash
# webapp/.env 已预置，默认 Mock 模式，开箱即用
# 如需修改，参考下方「环境变量说明」
```

### 3. 初始化数据库

```bash
npm run db:migrate   # 生成 SQLite dev.db + 运行迁移
```

### 4. 启动开发服务器

```bash
npm run dev          # http://localhost:3000
```

访问后自动跳转至 `/dashboard`（管理后台游戏库）。

---

## npm 脚本说明

| 脚本 | 说明 |
|------|------|
| `npm run dev` | 启动 Next.js 开发服务器（含 Hot Reload） |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务器（需先 build） |
| `npm run lint` | ESLint 检查 |
| `npm run db:migrate` | 运行 Prisma 迁移（创建/更新 SQLite 表结构） |
| `npm run db:generate` | 重新生成 Prisma Client（修改 schema 后运行） |
| `npm run db:studio` | 启动 Prisma Studio 可视化数据库浏览器 |

---

## 环境变量说明

所有变量在 `webapp/.env` 中配置（已预置，不提交 Git）。模板见项目根目录 [.env.example](../.env.example)。

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `file:./dev.db` | SQLite 数据库路径 |
| `DIFY_MOCK_MODE` | `true` | **Mock 开关**。`true` = 无需 Dify 实例，全流程使用模拟数据；`false` = 调用真实 Dify API |
| `DIFY_BASE_URL` | `http://localhost/v1` | Dify 实例地址（`DIFY_MOCK_MODE=false` 时生效） |
| `DIFY_WORKFLOW_API_KEY` | — | Extractor Workflow 应用的 API Key |
| `DIFY_DATASET_API_KEY` | — | Knowledge Base API Key（与应用 Key 独立，在 Dify 设置页获取） |
| `DIFY_CHATBOT_API_KEY` | — | Q&A Chatbot 应用的 API Key（如 `rule-chatbot`） |
| `DIFY_CHATBOT_CONTEXT_INPUT` | `context` | 与 Dify 应用「用户输入」变量名一致，用于传入检索片段 |
| `DIFY_DATASET_PERMISSION` | `only_me` | Dataset 创建权限默认值（后端可选参数） |
| `DIFY_DATASET_INDEXING_TECHNIQUE` | `high_quality` | 文档索引策略默认值 |
| `DIFY_DATASET_PROCESS_MODE` | `custom` | 分段规则模式默认值 |
| `DIFY_DATASET_SEGMENT_SEPARATOR` | `\\n#` | 分段分隔符默认值 |
| `DIFY_DATASET_SEGMENT_MAX_TOKENS` | `1000` | 分段最大 token 默认值 |
| `DIFY_DATASET_PREPROC_REMOVE_EXTRA_SPACES` | `true` | 预处理开关：去除多余空格 |
| `DIFY_DATASET_PREPROC_REMOVE_URLS_EMAILS` | `false` | 预处理开关：去除 URL/邮箱 |
| `DIFY_RETRIEVE_SEARCH_METHOD` | `hybrid_search` | 检索策略默认值 |
| `DIFY_RETRIEVE_RERANKING_ENABLE` | `true` | 是否开启重排 |
| `DIFY_RETRIEVE_TOP_K` | `5` | 检索 Top-K 默认值 |
| `DIFY_RETRIEVE_SCORE_THRESHOLD_ENABLED` | `true` | 是否启用阈值过滤 |
| `DIFY_RETRIEVE_SCORE_THRESHOLD` | `0.3` | 检索阈值默认值 |
| `STORAGE_BASE_PATH` | `../storage` | 数据产物根目录（相对于 `webapp/`）。本地默认指向项目根的 `storage/`；上云时可改为 S3 路径 |
| `GEMINI_API_KEY` | — | Google Gemini Key（供 `data_pipeline/` 脚本使用，webapp 本身不读取） |

---

## 接入真实 Dify

当 Dify 环境就绪后，修改 `webapp/.env`：

```bash
DIFY_MOCK_MODE=false
DIFY_BASE_URL=http://localhost/v1    # 或你的 Dify 实例地址
DIFY_WORKFLOW_API_KEY=app-xxxxxxxx
DIFY_DATASET_API_KEY=xxxxxxxx
DIFY_CHATBOT_API_KEY=app-xxxxxxxx   # Phase 4 完成后填入
```

无需修改任何代码，重启 `npm run dev` 即可切换到真实调用。

---

## Extractor 输入限制策略

- 后端会把 URL/多图/PDF 来源统一处理为 Workflow `rule_files` 图片输入。
- PDF 会在服务端逐页光栅化为 JPG 后再送入 workflow（不直接向模型传 PDF）。
- 当前总页数上限为 20 张（URL 抓取 / 多图上传 / PDF 转图统一执行）。
- 当自动压缩后仍无法满足约束时，API 会返回可操作错误，提示按规则书章节拆分任务。
- `quick_start_guide` 会保存到数据库并在聊天页右侧作为可折叠“保姆面板”展示，不会写入知识库。
