# Jarvis Cognitive Memory Architecture
## 开发、部署与 AI IDE 接入说明

## 1. 项目目标

Jarvis Cognitive Memory Architecture（JCMA）是一个独立运行的 **Personal Cognitive Runtime**。

它不依赖 Codex、Cursor、Antigravity、Claude Code 或任何具体模型。

这些 AI IDE / Agent 都只是 Jarvis 的客户端。

核心关系：

```text
Codex
Cursor
Antigravity
Claude Code
自研 Agent
本地模型
     │
     │ MCP / HTTP
     ▼
┌──────────────────────┐
│       Jarvis         │
│  Cognitive Runtime   │
├──────────────────────┤
│ Memory               │
│ Goals                │
│ Experience            │
│ Skills                │
│ Context               │
│ Self Model            │
│ Evaluation            │
│ Reflection            │
└──────────────────────┘
```

因此：

```text
Codex 负责 Coding

Cursor 负责 Coding

Antigravity 负责 Agent Workflow

Jarvis 负责：
“我是谁”
“用户是谁”
“这个项目是什么”
“以前发生过什么”
“做过什么决定”
“学会了什么”
“现在应该继续什么”
```

---

# 2. 核心架构

建议最终服务拓扑：

```text
                     AI Clients
                          
     Codex       Cursor      Antigravity
        │           │             │
        └───────────┼─────────────┘
                    │
                   MCP
                    │
              ┌─────▼─────┐
              │ Jarvis MCP │
              │  Gateway   │
              └─────┬─────┘
                    │
              Internal API
                    │
        ┌───────────▼───────────┐
        │     Jarvis Runtime    │
        ├───────────────────────┤
        │ Context Engine        │
        │ Memory Engine         │
        │ Goal Engine           │
        │ Experience Engine     │
        │ Skill Engine          │
        │ Agent Manager         │
        │ Evaluation Engine     │
        │ Reflection Engine     │
        │ Permission Engine     │
        │ Cognitive Router      │
        └───────────┬───────────┘
                    │
      ┌─────────────┼──────────────┐
      ▼             ▼              ▼
 Markdown/Git    PostgreSQL     Local Models
                 + pgvector       Ollama
```

Jarvis Runtime 是唯一核心。

MCP 只是其中一个 Adapter。

以后还可以增加：

```text
REST API
WebSocket
Desktop Client
Mobile Client
Voice Client
Browser Extension
```

---

# 3. 推荐技术栈

建议使用：

```text
Runtime:
Node.js 22+
TypeScript

Monorepo:
pnpm workspace

HTTP:
Fastify

MCP:
@modelcontextprotocol/sdk

Database:
PostgreSQL

Vector Search:
pgvector

Markdown Memory:
Filesystem + Git

Local Model:
Ollama

Background Job:
pg-boss

Schema:
Zod

Logging:
Pino

Testing:
Vitest
```

选择 TypeScript 的原因是：

Jarvis 未来需要大量：

```text
MCP
Plugin
CLI
Web API
Desktop integration
Agent integration
```

TypeScript 生态非常适合这一层。

---

# 4. 项目目录

建议：

```text
jarvis/

├── apps/
│
│   ├── server/
│   │   └── Jarvis Runtime 服务
│   │
│   ├── mcp/
│   │   └── MCP Gateway
│   │
│   ├── worker/
│   │   └── 后台任务
│   │
│   └── cli/
│       └── jarvis CLI
│
├── packages/
│
│   ├── core/
│   ├── context/
│   ├── memory/
│   ├── goals/
│   ├── events/
│   ├── experience/
│   ├── skills/
│   ├── agents/
│   ├── tools/
│   ├── providers/
│   ├── evaluation/
│   ├── reflection/
│   ├── permissions/
│   └── shared/
│
├── data/
│
│   ├── memory/
│   ├── skills/
│   ├── workflows/
│   ├── goals/
│   └── archive/
│
├── docker/
│
├── scripts/
│
├── docs/
│
├── docker-compose.yml
│
└── package.json
```

---

# 5. 数据存储设计

Jarvis 不应该把所有东西存进一个数据库。

使用三类存储。

## Markdown + Git

保存真正属于 Jarvis 的长期认知资产：

```text
data/

memory/
├── self/
├── user/
├── projects/
├── people/
├── concepts/
├── decisions/
└── workflows/

skills/

goals/
```

优点：

```text
人类可读
AI 可读
Git 可版本化
可回滚
可迁移
与模型无关
```

---

## PostgreSQL

保存动态数据：

```text
events
episodes
experiences
sessions
tasks
actions
evaluations
memory_metadata
relationships
agent_runs
```

Event Store 尽量采用 Append Only。

---

## pgvector

用于：

```text
Memory Retrieval

RAG

Experience Retrieval

Skill Retrieval

Semantic Search
```

注意：

> Vector DB 只是索引，不是真实数据源。

删除向量库以后，应该可以重新生成。

---

# 6. 核心 Runtime

Jarvis Runtime 负责完整 Cognitive Loop：

```text
Input
 ↓
Session
 ↓
Goal Resolution
 ↓
Context Build
 ↓
Memory Recall
 ↓
Skill Recall
 ↓
Plan
 ↓
Agent / Model / Tool
 ↓
Result
 ↓
Evaluation
 ↓
Experience
 ↓
Reflection
 ↓
Memory Update
 ↓
Skill Candidate
```

---

# 7. Session 是关键抽象

任何外部 Agent 使用 Jarvis 时，都应该首先建立 Session。

例如 Codex 启动：

```text
session.open
```

参数：

```json
{
  "client": "codex",
  "workspace": "/Projects/game-producer",
  "task": "继续处理市场系统刷新问题"
}
```

Jarvis 返回：

```text
session_id

project

active_goal

context

relevant_memories

relevant_decisions

relevant_experiences

recommended_skills
```

之后所有调用带：

```text
session_id
```

任务结束：

```text
session.close
```

---

# 8. Project Identity

不要只依赖文件夹名称识别项目。

建议生成：

```text
project_id
```

识别依据可以组合：

```text
Git Remote
Repository Root
Jarvis Project Metadata
Workspace Path
```

例如：

```text
project_id:
game-producer

repo:
git@github.com:xxx/game-producer.git
```

即使以后换电脑：

```text
D:/game-producer
```

变成：

```text
~/Projects/game-producer
```

Jarvis 仍然知道它是同一个项目。

---

# 9. Context Builder

这是给 AI IDE 提供 Jarvis 记忆的核心。

暴露：

```text
context.build
```

例如：

```json
{
  "session_id": "...",
  "task": "修复市场系统刷新问题",
  "token_budget": 12000
}
```

Jarvis 内部查询：

```text
Active Goal

Project Memory

Recent Episodes

Important Decisions

Relevant Experience

User Preferences

Relevant Skills

Current Project State
```

然后 Ranking：

```text
Goal Relevance
+
Project Relevance
+
Semantic Similarity
+
Recency
+
Importance
+
Confidence
```

最后生成：

```text
Context Package
```

外部 Agent 不需要自己理解 Jarvis 内部 Memory 结构。

---

# 10. 不允许外部 Agent 直接修改核心 Memory

这是非常重要的设计。

不要提供：

```text
memory.write_semantic()
```

让 Codex 自己修改：

```text
user/preferences.md
```

否则不同 Agent 很容易污染 Jarvis。

外部 Agent只能提交：

```text
Observation

Event

Experience

Session Result
```

例如：

```text
experience.record
```

或者：

```text
session.close
```

Jarvis 自己判断：

```text
是否写入 Episodic Memory

是否修改 Semantic Memory

是否修改 Project State

是否产生 Decision

是否生成 Skill Candidate
```

也就是：

> Agent 可以提供经历，但不能直接修改 Jarvis 的认知。

---

# 11. MCP Gateway

AI IDE 统一通过 MCP 使用 Jarvis。

第一批建议暴露以下 MCP Tools：

```text
jarvis_session_open

jarvis_context_build

jarvis_memory_search

jarvis_project_context

jarvis_goal_get

jarvis_skill_search

jarvis_skill_load

jarvis_event_record

jarvis_experience_record

jarvis_session_close
```

后续增加：

```text
jarvis_agent_spawn

jarvis_goal_create

jarvis_action_history

jarvis_self_capabilities
```

---

# 12. MCP Resource

除了 Tools，还可以暴露 Resources：

```text
jarvis://user/profile

jarvis://projects/current

jarvis://goals/active

jarvis://memory/recent

jarvis://skills/index
```

Agent 可以直接读取。

---

# 13. MCP Prompt

还可以暴露 Jarvis 自己维护的 Prompt Templates：

```text
jarvis-debug

jarvis-project-review

jarvis-research

jarvis-code-review
```

这样某些 Skill 可以通过 MCP Prompt 提供给不同 IDE。

---

# 14. 同时支持两种 MCP Transport

Jarvis MCP Server 建议同时支持：

```text
stdio
```

和：

```text
Streamable HTTP
```

## stdio

适合同一台电脑：

```text
IDE
 ↓
启动 jarvis-mcp
 ↓
Jarvis Runtime
```

## Streamable HTTP

适合：

```text
开发电脑
       │
       ▼
Jarvis Server
```

例如：

```text
http://127.0.0.1:7331/mcp
```

或者局域网：

```text
http://192.168.1.10:7331/mcp
```

未来专门的 Jarvis 主机：

```text
https://jarvis.xxx/mcp
```

Cursor 当前官方支持 stdio、SSE 和 Streamable HTTP，因此这两种模式都可以直接覆盖。citeturn795474search0

---

# 15. Internal HTTP API

MCP 不应该直接调用数据库。

结构：

```text
MCP
 ↓
Jarvis Service
 ↓
Domain Layer
 ↓
Database
```

同时暴露内部 REST：

```text
POST /v1/sessions
POST /v1/context/build

GET  /v1/memory/search

GET  /v1/projects/:id/context

GET  /v1/goals/active

GET  /v1/skills/search

POST /v1/events

POST /v1/experiences

POST /v1/sessions/:id/close
```

这样以后：

```text
Desktop App
Mobile App
Web
Voice
```

不用走 MCP。

---

# 16. 本地模型

Jarvis 本身也需要 Cognitive Provider。

推荐首先支持：

```text
Ollama
OpenAI Compatible API
OpenAI
Anthropic
Gemini
```

统一接口：

```ts
interface CognitiveProvider {
  reason(input: ReasonInput): Promise<ReasonResult>;

  generate(input: GenerateInput): Promise<GenerateResult>;

  evaluate(input: EvaluateInput): Promise<EvaluationResult>;

  extract(input: ExtractInput): Promise<ExtractResult>;
}
```

不要在其他模块直接调用：

```text
OpenAI SDK
Ollama API
Claude SDK
```

统一经过：

```text
CognitiveRouter
```

---

# 17. Model Router

例如配置：

```yaml
models:

  local-small:
    provider: ollama
    model: xxx

  local-large:
    provider: ollama
    model: xxx

  cloud-strong:
    provider: openai
    model: xxx
```

Router 根据：

```text
Task Complexity

Privacy

Cost

Context Length

Required Capability
```

决定模型。

---

# 18. 本地运行

推荐通过 Docker Compose 运行基础设施。

```text
docker-compose.yml

postgres
pgvector
```

模型使用：

```text
Ollama
```

直接运行在宿主机。

Jarvis Runtime 本身开发环境直接：

```bash
pnpm install
pnpm dev
```

生产模式：

```bash
pnpm build
pnpm start
```

---

# 19. 环境变量

例如：

```env
JARVIS_PORT=7330

JARVIS_MCP_PORT=7331

DATABASE_URL=postgresql://jarvis:jarvis@localhost:5432/jarvis

MEMORY_ROOT=/data/jarvis/memory

SKILLS_ROOT=/data/jarvis/skills

OLLAMA_BASE_URL=http://127.0.0.1:11434

DEFAULT_COGNITIVE_PROVIDER=ollama

JARVIS_API_TOKEN=xxxx
```

---

# 20. 本地启动流程

完整过程：

```bash
docker compose up -d
```

启动 PostgreSQL。

然后：

```bash
ollama serve
```

启动本地模型服务。

然后：

```bash
pnpm dev
```

启动：

```text
Jarvis Runtime
Worker
MCP Gateway
```

最终：

```text
Jarvis API

http://127.0.0.1:7330

Jarvis MCP

http://127.0.0.1:7331/mcp
```

---

# 21. Jarvis CLI

建议自己写一个 CLI：

```bash
jarvis
```

主要命令：

```text
jarvis start

jarvis stop

jarvis status

jarvis doctor

jarvis memory search

jarvis memory inspect

jarvis project list

jarvis skill list

jarvis session list
```

例如：

```bash
jarvis doctor
```

检查：

```text
Database
Vector
Memory Directory
Git
Ollama
Embedding Model
MCP Server
Permissions
```

---

# 22. Codex 接入

Codex 当前支持 MCP，同时会读取 `AGENTS.md` 作为持久项目指令。citeturn765576search3turn765576search6

直接添加 Jarvis：

```bash
codex mcp add jarvis \
  --url http://127.0.0.1:7331/mcp
```

Codex 当前也使用：

```text
~/.codex/config.toml
```

维护 MCP 配置。OpenAI Codex 自身代码和文档中仍使用 `mcp_servers` 作为配置项。citeturn403449search4turn403449search6

对应：

```toml
[mcp_servers.jarvis]
url = "http://127.0.0.1:7331/mcp"
```

然后：

```bash
codex mcp list
```

检查。

---

# 23. Codex AGENTS.md

项目里建议加入：

```md
# Jarvis Integration

This project uses Jarvis Cognitive Memory Architecture.

For non-trivial tasks:

1. Open a Jarvis session for the current workspace.
2. Retrieve the Jarvis context package before making architectural decisions.
3. Search Jarvis memory when historical project context is relevant.
4. Search Jarvis Skills before implementing repeated workflows.

When completing a meaningful task:

1. Record important events and outcomes.
2. Record failures and final solutions as experience.
3. Close the Jarvis session with:
   - summary
   - decisions
   - changed files
   - unresolved issues
   - next steps

Do not directly modify Jarvis semantic memory.
Jarvis decides which information becomes long-term memory.
```

这样以后你只需要：

```bash
cd game-producer

codex
```

然后说：

```text
继续昨天市场系统的问题。
```

Codex 会：

```text
Codex
 ↓
Jarvis session.open
 ↓
Jarvis context.build
 ↓
获取昨天的状态
 ↓
开始 Coding
```

---

# 24. Cursor 接入

Cursor 官方 MCP 配置支持：

```text
~/.cursor/mcp.json
```

作为全局配置。

项目级配置：

```text
.cursor/mcp.json
```

Cursor 当前也原生支持 MCP Tools、Prompts 和 Resources。citeturn795474search0

配置：

```json
{
  "mcpServers": {
    "jarvis": {
      "url": "http://127.0.0.1:7331/mcp"
    }
  }
}
```

然后在 Cursor Agent 中：

```text
继续处理这个项目，先从 Jarvis 获取项目上下文。
```

Cursor 会自动看到 Jarvis MCP Tools。

Cursor 默认在 MCP Tool 执行前会请求授权，也可以通过自身 Run Mode 控制自动执行策略。citeturn795474search0

---

# 25. Cursor Rules

建议项目加入：

```text
.cursor/rules/jarvis.mdc
```

内容类似：

```text
This workspace uses Jarvis.

Before complex tasks:
- open Jarvis session
- retrieve project context
- retrieve relevant skills

After meaningful tasks:
- record experience
- close session

Never directly treat conversation context as permanent Jarvis memory.
```

这样不用每次提醒 Cursor。

---

# 26. Antigravity 接入

Antigravity 当前原生支持 MCP，本地和远程 MCP 都可以接。citeturn926307search0

Workspace 配置：

```text
.agents/mcp_config.json
```

全局配置可由 Antigravity 的 MCP 管理界面维护；官方目前文档给出的 IDE 全局位置是：

```text
~/.gemini/config/mcp_config.json
``` citeturn926307search0


远程 MCP 注意：

Antigravity 当前配置使用：

```text
serverUrl
```

而不是 Cursor 的：

```text
url
```

例如：

```json
{
  "mcpServers": {
    "jarvis": {
      "serverUrl": "http://127.0.0.1:7331/mcp"
    }
  }
}
```

Antigravity 官方目前明确支持 `command` 形式的 stdio Server 和 `serverUrl` 形式的 Streamable HTTP / SSE Server。citeturn926307search0

---

# 27. Antigravity Workspace Context

建议项目同时提供：

```text
AGENTS.md
```

Antigravity 当前同样能够读取 workspace 中的 `AGENTS.md` 规则。citeturn926307search4

因此可以直接复用前面的：

```text
Jarvis Integration Rules
```

不用维护两套规范。

---

# 28. 其他 AI IDE

任何支持 MCP 的 Agent 都采用同一个思路：

```text
AI IDE
 ↓
Jarvis MCP
 ↓
Jarvis Runtime
```

如果支持 HTTP MCP：

```text
http://127.0.0.1:7331/mcp
```

如果只支持 stdio：

```text
node /path/to/jarvis/apps/mcp/dist/stdio.js
```

Jarvis 不需要知道：

```text
这个客户端究竟是 Cursor
还是 Codex
还是其他 IDE
```

只要 `session.open` 时带：

```text
client
```

即可。

---

# 29. 外部 Agent 身份

每个客户端建议传：

```text
client_id

client_type

workspace

session_id
```

例如：

```json
{
  "client_type": "codex",
  "workspace": "/Projects/game-producer"
}
```

这样以后 Jarvis 可以知道：

```text
昨天这段代码是 Codex 修改的。

今天这段分析来自 Antigravity。

最后 Review 是 Cursor 完成的。
```

---

# 30. 多 Agent 共享 Memory

最终：

```text
              Jarvis

         Shared Cognitive State

      ┌──────────┼───────────┐
      ▼          ▼           ▼

    Codex      Cursor    Antigravity

     │           │            │
     └──── Experience ────────┘
               ↓
             Jarvis
```

上午：

```text
Codex 修改代码
```

下午：

```text
Cursor Review
```

晚上：

```text
Antigravity 继续开发
```

全部共享：

```text
Project Memory

Decisions

Goals

Experience

Skills
```

---

# 31. Session Close

这是最重要的写入入口之一。

例如：

```text
jarvis_session_close
```

输入：

```json
{
  "session_id": "...",

  "result": "success",

  "summary": "完成市场刷新逻辑重构",

  "decisions": [
    "市场刷新改成事件驱动"
  ],

  "changed_files": [
    "MarketManager.ts"
  ],

  "failures": [
    "最初使用定时轮询导致性能问题"
  ],

  "next_steps": [
    "补充市场刷新测试"
  ]
}
```

Jarvis 后台：

```text
Event Store
 ↓
Experience
 ↓
Evaluation
 ↓
Reflection
 ↓
Project Memory
 ↓
Decision
 ↓
Goal Update
```

---

# 32. Memory Consolidation Worker

后台 Worker 周期运行：

```text
memory.consolidate
```

读取：

```text
Recent Events

Sessions

Episodes

Experiences
```

执行：

```text
Deduplicate

Conflict Detection

Importance Evaluation

Memory Promotion

Memory Decay

Archive

Semantic Memory Update
```

这样长期运行不会无限积累垃圾 Memory。

---

# 33. Skill Learning Worker

后台检查：

```text
Experience Cluster
```

例如发现：

```text
过去一个月出现 18 次类似 Cocos UI Bug
```

生成：

```text
Candidate Skill
```

但不直接成为正式 Skill。

必须：

```text
Candidate

↓

Evaluation

↓

Sandbox

↓

Compare

↓

Promote
```

---

# 34. Permission Engine

Jarvis MCP 未来如果不仅提供 Memory，还提供电脑控制能力，就必须统一进入 Permission Engine。

例如：

```text
READ
自动

SEARCH
自动

WRITE FILE
自动 + Audit

RUN COMMAND
Policy

DELETE
确认

GIT PUSH
确认

SEND MESSAGE
确认

PAYMENT
强确认
```

外部 Agent 永远不能绕过 Jarvis 权限系统。

---

# 35. 网络安全

同机运行：

```text
127.0.0.1
```

即可。

如果 Jarvis Server 放在专门 AI 主机：

```text
开发电脑
     │
Tailscale / VPN
     │
Jarvis Server
```

不要直接：

```text
0.0.0.0:7331
```

裸露公网。

远程 MCP 至少增加：

```text
Bearer Token
```

例如：

```http
Authorization: Bearer xxx
```

---

# 36. Jarvis Server 模式

最终你真正想要的应该是：

```text
             Jarvis AI Server

               JCMA Runtime

        Memory / Goals / Skills

          Models / RAG / Agent

                  │

      ┌───────────┼────────────┐
      │           │            │
      ▼           ▼            ▼

   PC / Codex   Mac / Cursor   Laptop
                              Antigravity
```

所有设备连接同一个 Jarvis。

---

# 37. 一次完整真实流程

你打开游戏项目：

```bash
cd game-producer
codex
```

然后：

```text
继续昨天市场系统的问题。
```

Codex：

```text
session.open
```

↓

Jarvis：

```text
识别 game-producer
```

↓

```text
context.build
```

↓

返回：

```text
当前 Goal

昨天修改内容

昨天的失败方案

最终 Decision

待解决事项

相关 Skill
```

↓

Codex 开始修改代码。

修改完成：

```text
experience.record
```

↓

```text
session.close
```

↓

Jarvis：

```text
记录 Event

生成 Episode

生成 Experience

更新 Project Memory

更新 Goal

Reflection
```

第二天你打开 Cursor：

```text
这个项目 Codex 昨天做到哪里了？
```

Cursor：

```text
Jarvis Context
```

↓

直接得到完整结果。

---

# 38. 开发时最重要的边界

一定保持：

```text
AI IDE
≠ Memory Owner

Model
≠ Memory Owner

MCP
≠ Memory Owner

Database
≠ Cognitive System
```

真正唯一拥有长期认知的必须是：

```text
Jarvis Runtime
```

外部所有系统都只是：

```text
Reader
Worker
Specialist
Tool
Client
```

---

# 39. 推荐核心接口

最终核心领域接口建议保持非常干净：

```ts
interface ContextEngine {
  build(input: BuildContextInput): Promise<ContextPackage>;
}
```

```ts
interface MemoryEngine {
  recall(input: RecallInput): Promise<Memory[]>;
  observe(input: Observation): Promise<void>;
  consolidate(): Promise<void>;
}
```

```ts
interface ExperienceEngine {
  record(input: ExperienceInput): Promise<Experience>;
}
```

```ts
interface GoalEngine {
  resolve(input: GoalContext): Promise<Goal>;
  update(input: GoalUpdate): Promise<void>;
}
```

```ts
interface SkillEngine {
  search(input: SkillQuery): Promise<Skill[]>;
  evaluate(id: string): Promise<Evaluation>;
}
```

```ts
interface CognitiveRouter {
  route(task: CognitiveTask): Promise<CognitiveProvider>;
}
```

MCP、REST、CLI 都只调用这些领域接口。

---

# 40. 最终运行结构

最终仓库运行起来应该类似：

```text
jarvis-runtime
     │
     ├── HTTP :7330
     │
     ├── MCP :7331
     │
     ├── Worker
     │
     ├── PostgreSQL
     │
     ├── Memory Git Repo
     │
     └── Ollama
```

客户端：

```text
Codex
Cursor
Antigravity
Claude Code
其他 MCP Agent
```

统一：

```text
              MCP

               ↓

           Jarvis

               ↓

     Cognitive Memory
```

---

# 41. 开发完成标准

这套系统真正跑通，不应该以：

> “MCP 能连上。”

作为标准。

而应该以以下场景作为验收：

```text
第一天：

Codex 处理项目 A
产生 Decision / Experience / Goal。


第二天：

重新启动电脑。

打开 Cursor。

完全新的 Cursor Session。

说：

“继续昨天 Codex 做的事情。”
```

Cursor 能准确知道：

```text
哪个项目

昨天做了什么

为什么这么做

失败过什么

最后采用什么方案

现在还剩什么

应该加载什么 Skill
```

然后继续开发。

再换 Antigravity：

```text
“Review 一下昨天 Cursor 的修改。”
```

仍然可以无缝继续。

如果这个场景稳定成立：

> **JCMA 的核心就已经真正成立了。**

---

# 42. 最终定位

整套系统的服务关系应该始终保持：

```text
       AI IDE / Agent

            ↓

      Cognitive Client

            ↓

         MCP / API

            ↓

    Jarvis Cognitive Runtime

            ↓

 Memory / Goal / Experience / Skill

            ↓

       Personal Cognitive State
```

所以未来无论：

```text
Codex 消失

Cursor 被替代

Antigravity 改架构

GPT 换代

LLM 被新的神经网络取代
```

都不会影响 Jarvis 的核心资产。

因为真正需要保存的是：

```text
你的 Memory

你的 Experience

你的 Decisions

你的 Goals

你的 Skills

你的 Workflow

以及 Jarvis 对你的长期认知
```

**AI IDE 是工具。**

**模型是算力。**

**Jarvis 才是长期存在的认知主体。**

---

# 43. 当前实现（v0.1）

此仓库已经以本文档的架构从零建立为一个唯一的 `@jarvis/*` pnpm workspace；没有 `jarvis-goose`、`jarvis-mvp` 或第二套 Agent Runtime。旧目录只作为设计与测试经验的参考，不是本项目的运行依赖。

当前可运行的首个垂直切片包括：

- `apps/server`：只监听 loopback 的 Fastify Internal API（session、context、memory search、event、experience、skill、goal）。
- `apps/mcp`：同一 Runtime API 的标准 MCP stdio 和 Streamable HTTP adapter。
- `apps/cli`：`jarvis status`、会话创建与记忆查询。
- `apps/worker`：独立的 consolidation worker 入口；自动提升候选记忆仍被明确禁止。
- `packages/memory`：Git-friendly Markdown 长期记忆、项目隔离、候选→审核→激活的版本化提升，以及 PostgreSQL/pgvector schema 入口。
- `packages/context`、`goals`、`skills`、`providers`、`permissions`：由 Runtime 组合的领域边界，而不是 MCP/CLI 的私有逻辑。

首次启动若未提供名字，Jarvis 会返回“你希望我叫什么名字？”的 onboarding 状态；MCP 客户端应将此问题展示给用户。用户可以直接回答名字，或在之后说“以后叫你 Friday”。CLI 同样支持：`pnpm cli identity name Friday` 与 `pnpm cli identity say "以后叫你 Friday"`。名字保存在本地 `data/identity.json`，重启后仍有效。

## 快速开始

```bash
cp .env.example .env
pnpm install
pnpm start
```

这会直接以本地持久化模式启动 Runtime、Worker 与 HTTP MCP。若要启用 PostgreSQL + pgvector，先执行 `docker compose up -d`，再取消 `.env` 中 `DATABASE_URL` 的注释后重启。

开发时可先不设置 `DATABASE_URL`，Runtime 会使用本地 JSONL 动态事件回退，以便验证完整 Session/API/MCP 路径；生产环境必须配置 PostgreSQL，Markdown 才仍是可 Git 化的长期认知资产，向量索引则永远是可重建的派生数据。

stdio MCP：

```bash
pnpm mcp
```

HTTP MCP：`http://127.0.0.1:7331/mcp`。
