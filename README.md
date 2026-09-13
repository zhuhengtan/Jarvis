# Jarvis Cognitive Memory Architecture

## 1. 系统定位

Jarvis Cognitive Memory Architecture，简称 **JCMA**。

目标不是开发一个“本地 ChatGPT”，也不是开发一个绑定某个模型的 Agent，而是构建一个：

> **拥有独立记忆、目标、技能、经验、工具和行为能力，并可以自由更换底层认知模型的 Personal Cognitive Runtime。**

Jarvis 本身不等于任何一个大模型。

GPT、Claude、Gemini、Qwen、本地模型，甚至未来不同架构的神经网络，都只是 Jarvis 可以使用的 **Cognitive Provider**。

真正属于 Jarvis 的是：

```text
Identity
Memory
Goals
Experience
Skills
Plugins
Permissions
History
```

因此：

> 模型可以换，Jarvis 不会失忆。

> Agent 框架可以换，Jarvis 仍然是同一个 Jarvis。

---

# 2. 核心设计原则

整个系统遵循六个原则。

### 模型无关

系统不能依赖：

```text
Prompt → LLM → Text
```

而应该抽象成：

```text
Task
↓
Cognitive Runtime
↓
Cognitive Provider
↓
Structured Result / Action
```

当前 Provider 可以是 LLM。

未来可以是：

```text
LLM
Multimodal Model
World Model
Neural Cognitive Model
Neuro-symbolic Model
其他未来模型
```

---

### 记忆属于系统，而不是模型

模型自身 Context、模型 Provider、模型权重都不能作为 Jarvis 唯一记忆来源。

核心长期记忆必须保存在 Jarvis 自己控制的数据层中。

---

### 原始事实永远可追溯

Jarvis 不能只保存 AI 总结后的结果。

必须同时保存：

```text
原始事件
↓
经历
↓
理解
↓
长期认知
```

如果 AI 某次总结错误，可以从原始事件重新构建记忆。

---

### Experience ≠ Memory ≠ Knowledge

三者需要区分。

```text
Experience
我经历过什么

Memory
我记得什么

Knowledge
我认为哪些东西是真实、稳定、值得长期保留的
```

---

### 能力可以成长，但必须可控

Jarvis 可以：

- 自动学习 Skill
- 自动修改 Skill
- 自动形成 Workflow
- 自动整理 Memory

但不能毫无约束地修改自身核心能力。

所有长期能力变更必须经过 Evaluation。

---

### 所有行为可解释、可审计、可回滚

Jarvis 做过什么、为什么做、依据什么记忆、调用了什么工具，都应该能够追踪。

---

# 3. 总体架构

```text
                        User
                         │
                         ▼
                ┌────────────────┐
                │ Jarvis Gateway │
                └───────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │ Jarvis Runtime  │
               └────────┬────────┘
                        │
       ┌────────────────┼─────────────────┐
       │                │                 │
       ▼                ▼                 ▼
    Goal Engine     Context Engine    Self Model
       │                │                 │
       └────────────────┼─────────────────┘
                        │
                  Memory Engine
                        │
     ┌──────────┬───────┼────────┬──────────┐
     ▼          ▼       ▼        ▼          ▼
 Working    Episodic  Semantic   RAG      Event
 Memory      Memory    Memory   Archive    Store
                        │
              ┌─────────┼──────────┐
              ▼         ▼          ▼
           Skills   Experience   Knowledge
              │
              ▼
        Cognitive Runtime
              │
     ┌────────┼─────────┐
     ▼        ▼          ▼
   Main    Subagents   Reflection
   Agent
     │
     ▼
       Model / Cognitive Router
     ┌──────┼────────┬─────────┐
     ▼      ▼        ▼         ▼
   Local   GPT     Claude    Future
   Model                     Model
     │
     ▼
        Action / Tool Runtime
     ┌────────┬────────┬─────────┐
     ▼        ▼        ▼         ▼
    MCP      CLI      API        UI
     │
     ▼
             Computer / Internet
```

---

# 4. Cognitive Runtime

Cognitive Runtime 是整个 Jarvis 的核心调度层。

负责：

- 接收用户任务
- 理解当前目标
- 加载相关记忆
- 加载相关 Skills
- 判断是否需要工具
- 判断是否需要 Subagent
- 选择 Cognitive Provider
- 执行任务
- 评价结果
- 更新 Experience
- 更新 Memory

它本身不应该包含某个模型特有的逻辑。

核心流程：

```text
Input
↓
Intent / Goal Analysis
↓
Context Construction
↓
Memory Retrieval
↓
Skill Retrieval
↓
Planning
↓
Model / Subagent / Tool Execution
↓
Evaluation
↓
Response
↓
Reflection
↓
Memory / Skill / Experience Update
```

---

# 5. Context Engine

Context 是 Jarvis 的“工作记忆”。

只保存当前任务真正需要的信息。

包括：

```text
当前用户请求
当前 Goal
当前 Task
当前 Project
近期关键对话
重要 Memory
相关 Skill
Tool Result
Subagent Result
当前执行状态
```

Context 不应该无限增长。

---

# 6. Context Compaction

当 Context 达到一定阈值时，不简单做 Summary。

而是进行一次 **Memory Consolidation**。

```text
Context
↓
Context Analyzer
↓
识别

事实
决策
经验
任务状态
用户偏好
未完成事项
错误尝试
重要结论

↓
分别进入

Memory
Experience
Goal
Task State
Event Store

↓
生成新的 Compact Context
```

因此 Context 压缩实际上完成的是：

> **短期记忆 → 长期记忆的转化。**

类似人类睡眠中的记忆巩固过程。

---

# 7. Memory Architecture

Memory 不再简单理解成三级缓存。

完整结构分为：

```text
Working Memory
Episodic Memory
Semantic Memory
Procedural Memory
Archive
Event Store
```

---

# 8. Working Memory

对应短期工作记忆。

保存：

- 当前任务
- 当前思考范围
- 当前对话
- 临时变量
- 当前工具结果

特点：

```text
速度最快
生命周期最短
容量最有限
```

主要存在 Context 中。

---

# 9. Episodic Memory

对应“我经历过什么”。

例如：

```text
昨天修改过某个 Bug
上周讨论过一个游戏设计
某次 Build 失败
某次方案被用户否决
某个 Skill 曾经执行失败
```

这种记忆具有：

```text
时间
地点/项目
参与对象
事件
结果
上下文
```

---

# 10. Semantic Memory

对应“我知道什么”。

主要以 Markdown / Wiki 形式保存。

例如：

```text
用户偏好
项目结构
项目决策
某个人的信息
技术知识
长期目标
业务规则
```

这就是类似 LLM Wiki 的部分。

建议目录：

```text
memory/

├── self/
├── user/
├── projects/
├── people/
├── concepts/
├── decisions/
├── workflows/
└── archive/
```

Markdown 是 Jarvis 的长期稳定认知。

---

# 11. Procedural Memory

Procedural Memory 就是：

> **我会怎么做。**

主要由 Skills 和 Workflow 组成。

例如：

```text
如何排查 Cocos UI 问题
如何进行前端代码 Review
如何进行面试评价
如何发布微信小游戏
如何分析某类 Bug
```

因此：

```text
Semantic Memory
= Know What

Procedural Memory
= Know How
```

---

# 12. Event Store

Event Store 是整个 Memory 系统的重要底座。

任何重要事件首先保存原始记录：

```text
Event
├── timestamp
├── source
├── actor
├── action
├── object
├── project
├── raw_content
└── metadata
```

例如：

```text
2026-09-13
用户决定取消方案 A，采用方案 B。
```

然后：

```text
Event
↓
Episodic Memory
↓
Reflection
↓
Semantic Memory
```

Event Store 原则上尽量 Append Only。

这样 Jarvis 永远可以回答：

> “你为什么记得这件事？”

并找到原始来源。

---

# 13. Memory Metadata

每条 Memory 都应该附带 Metadata：

```text
id
type
source
created_at
updated_at
last_accessed_at

importance
confidence
access_frequency

project
people
topics

supersedes
superseded_by

expires_at
```

例如：

```text
confidence: 0.6
```

代表：

> Jarvis 怀疑这件事正确，但并没有完全确认。

---

# 14. Memory Lifecycle

Memory 不应该永久不变。

生命周期：

```text
Observation
↓
Hypothesis
↓
Candidate Memory
↓
Confirmed Memory
↓
Active Memory
↓
Cold Memory
↓
Archive
```

如果出现新信息：

```text
旧 Memory
↓
Conflict Detection
↓
比较来源和可信度
↓
更新 / 标记过期 / 建立版本关系
```

避免长期运行后积累大量互相矛盾的信息。

---

# 15. Memory Retrieval

不能只靠 Vector Similarity。

最终 Ranking 可以综合：

```text
Semantic Similarity
+
Goal Relevance
+
Project Relevance
+
People Relevance
+
Recency
+
Importance
+
Confidence
+
Access Frequency
+
Task Type
```

例如用户说：

> “昨天那个问题后来怎么样了？”

“昨天 + 当前项目 + 当前任务”应该比单纯语义相似度更重要。

---

# 16. RAG Archive

RAG 不是 Jarvis 的 Memory 本身。

它是：

> **原始资料档案馆。**

保存：

```text
历史聊天
PDF
代码
网页
邮件
会议记录
Git History
文档
日志
```

RAG 找到相关资料后，可以进一步形成 Semantic Memory。

因此：

```text
RAG
= Find Information

Memory
= Know Information
```

---

# 17. Goal Engine

Jarvis 不能只有 Memory。

还必须知道：

> “现在为什么要做这件事情？”

Goal 分为：

```text
Long-term Goal
Project Goal
Active Goal
Task Goal
```

例如：

```text
Long-term
构建自己的 Jarvis

Project
完成 Memory Engine

Active
实现 Memory Retrieval

Task
修改 Retriever Ranking
```

Goal 会参与：

- Memory Retrieval
- Task Planning
- Subagent 创建
- Model Routing
- Skill 选择
- 主动行为判断

Goal 是让 Jarvis 从“有记忆”走向“有持续任务意识”的关键。

---

# 18. Self Model

Jarvis 除了认识用户，还必须认识自己。

```text
self/

├── identity.md
├── capabilities.md
├── limitations.md
├── permissions.md
├── models.md
├── plugins.md
├── current-state.md
└── learned-lessons.md
```

Jarvis 应该能够知道：

```text
我是谁
我能做什么
我不能做什么
我有哪些工具
当前使用哪个模型
模型有哪些限制
哪些操作需要用户确认
```

---

# 19. Experience System

Experience 不直接等于 Skill。

每一次任务都会产生 Experience：

```text
Task
↓
Approach
↓
Action
↓
Result
↓
Evaluation
↓
Experience
```

例如：

```text
问题：
Cocos Scale 导致布局异常

尝试：
修改 Widget

结果：
失败

最终方案：
调整节点层级

Outcome：
Success
```

这种经验可以长期积累。

当类似 Experience 不断出现后，才有资格形成 Skill。

---

# 20. Skill System

Skill 是 Jarvis 的稳定程序性能力。

目录示例：

```text
skills/

├── cocos-debug/
│   ├── SKILL.md
│   ├── examples/
│   ├── scripts/
│   └── eval/
│
├── code-review/
├── research/
└── game-design/
```

Skill 可以包含：

```text
适用场景
前置条件
SOP
决策逻辑
工具
Prompt
Example
Failure Case
Evaluation
```

---

# 21. Automatic Skill Learning

Jarvis 可以自动发现：

> 某类问题正在重复出现。

例如：

```text
几十次 Debug Experience
↓
Pattern Detection
↓
Candidate Skill
↓
生成 Skill
↓
Evaluation
↓
正式 Skill
```

---

# 22. Skill Evolution

Skill 可以持续优化。

但不能：

```text
成功一次
↓
直接修改正式 Skill
```

正确流程：

```text
Experience
↓
提出 Skill 修改
↓
Candidate Version
↓
Sandbox
↓
Eval
↓
与旧版本比较
↓
新版本明显更好
↓
Promote
```

正式 Skill 必须版本化。

---

# 23. Evaluation Engine

Evaluation Engine 是 Self Evolution 的安全阀。

用于评价：

```text
Task 是否完成
结果是否正确
Tool 是否成功
Skill 是否有效
模型是否适合
Subagent 是否有价值
Memory 是否可靠
```

没有 Evaluation，就不能真正做 Self Evolution。

否则：

> 自动学习很容易变成自动学坏。

---

# 24. Subagent System

Main Agent 不应该解决所有事情。

Complex Task 可以拆成多个 Agent：

```text
Main Agent
│
├── Research Agent
├── Coding Agent
├── Debug Agent
├── Memory Agent
└── Review Agent
```

---

# 25. Dynamic Subagent

Subagent 不一定需要用户手动开启。

Jarvis 可以根据：

```text
任务复杂度
任务类型
并行价值
Context 大小
专业领域
风险程度
```

自动判断是否启动。

---

# 26. Temporary Agent 与 Persistent Agent

### Temporary Agent

完成任务后销毁。

例如：

```text
Web Research
Code Review
Log Analysis
```

### Persistent Agent

长期存在。

例如：

```text
Coding Agent
Game Design Agent
Research Agent
Personal Assistant
Memory Agent
```

Persistent Agent 可以拥有自己的领域记忆。

---

# 27. Plugin / Tool Architecture

Jarvis 的 Tool 与 Skill 必须分离。

Skill：

> 知道怎么做。

Plugin：

> 能够做什么。

例如：

```text
Skill:
微信小游戏发布

Plugins:
Filesystem
Cocos
Git
微信开发者工具
Browser
```

---

# 28. Tool 接入优先级

优先使用稳定接口：

```text
API
↓
CLI
↓
MCP
↓
Local RPC
↓
UI Automation
↓
Vision + Mouse/Keyboard
```

尽量不要一开始就依赖模拟鼠标。

---

# 29. Computer Control Layer

Jarvis 可以操作本地电脑。

例如：

```text
Filesystem
Shell
Git
VS Code
Cocos Creator
Unity
Browser
微信开发者工具
Office
Database
NAS
Home Assistant
```

例如：

```text
“把项目跑起来看看为什么报错。”
```

Jarvis：

```text
找到 Project
↓
读取 Project Memory
↓
启动 Cocos
↓
执行 Build
↓
读取日志
↓
分析错误
↓
搜索代码
↓
修改
↓
重新 Build
↓
验证
↓
记录 Experience
```

---

# 30. Cognitive Provider

不要使用：

```text
LLMProvider
```

作为最高层抽象。

建议：

```text
CognitiveProvider
```

统一接口类似：

```text
reason()
plan()
respond()
evaluate()
summarize()
extract()
```

不同 Provider 自己实现能力映射。

---

# 31. Model Router

Jarvis 自动决定使用哪个 Provider。

例如：

```text
小任务
→ Local Small Model

普通任务
→ Local Large Model

高难度 Coding
→ Strong Coding Model

复杂推理
→ GPT / Claude

视觉任务
→ Multimodal Model
```

---

# 32. Model Escalation

模型调用失败时可以自动升级。

```text
Local Small
↓
失败
↓
Local Large
↓
失败
↓
Cloud Strong Model
```

从而实现：

> 本地模型优先，API 作为高能力兜底。

控制长期成本。

---

# 33. Permission System

所有 Tool 调用必须经过统一权限层。

建议：

```text
Level 0
读取
→ 自动

Level 1
普通执行
→ 自动 + 日志

Level 2
修改文件
→ 自动 + Undo

Level 3
删除 / Push / 发布
→ 用户确认

Level 4
付款 / 对外发送 / 权限修改
→ 强制确认
```

任何 Subagent 和 Plugin 都不能绕过 Permission Engine。

---

# 34. Action Log

Jarvis 所有行为记录：

```text
Who
When
Goal
Task
Why
Memory Used
Skill Used
Model Used
Tool Used
Action
Result
Evaluation
```

以后可以直接问：

> “你昨天修改了什么？”

甚至：

> “你为什么修改这个文件？”

Jarvis 都可以解释。

---

# 35. Proactive Engine

Jarvis 不应该永远依赖：

```text
User
↓
Prompt
↓
Action
```

还应该支持：

```text
Event
↓
Trigger
↓
Jarvis
```

例如：

```text
GitHub Issue
Build Failed
新邮件
Calendar
Server Error
项目文件变化
任务到期
系统事件
```

Jarvis 可以主动判断是否需要处理。

---

# 36. Reflection System

任务完成后运行 Reflection：

```text
这次完成了吗？

哪里做得好？

哪里失败？

为什么失败？

出现了什么新事实？

产生了什么经验？

是否需要更新 Memory？

是否应该产生 Skill？

是否需要更新 Workflow？
```

Reflection 不是聊天输出，而是 Jarvis 的内部学习机制。

---

# 37. Self Evolution Loop

最终形成：

```text
Goal
 ↓
Task
 ↓
Action
 ↓
Result
 ↓
Evaluation
 ↓
Experience
 ↓
Reflection
 ↓
 ├─ Memory Update
 ├─ Skill Candidate
 ├─ Workflow Update
 ├─ Goal Update
 └─ Self Model Update
        │
        └─────────→ Next Task
```

这就是 Jarvis 真正的成长机制。

---

# 38. Memory Consolidation

系统可以周期性进行类似“睡眠”的整理。

```text
最近 Events
+
Recent Experience
+
Conversation
+
Memory
↓
Memory Consolidation
```

执行：

```text
去重
冲突检测
旧信息淘汰
Memory 合并
Memory 重写
Knowledge 抽象
Experience 聚类
Skill Pattern Detection
Archive
```

因此长期运行后不是越来越乱，而是越来越结构化。

---

# 39. 推荐数据目录

```text
jarvis/

├── core/
│
├── memory/
│   ├── self/
│   ├── user/
│   ├── projects/
│   ├── people/
│   ├── concepts/
│   ├── decisions/
│   └── archive/
│
├── events/
│
├── experiences/
│
├── goals/
│
├── skills/
│
├── workflows/
│
├── plugins/
│
├── agents/
│
├── models/
│
├── permissions/
│
├── logs/
│
└── config/
```

核心长期资产尽量使用开放格式：

```text
Markdown
JSON
JSONL
SQLite
Git
```

避免被任何 Agent Framework 锁死。

---

# 40. 存储设计

建议不同数据选择不同存储：

### Markdown / Git

用于：

```text
Semantic Memory
Skills
Workflow
Identity
Goals
重要决策
```

优点：

- 人可以直接查看
- 可以修改
- 可以 Git
- 可以回滚
- 模型无关

### SQLite / PostgreSQL

用于：

```text
Events
Experience
Action Log
Tasks
Metadata
Relations
```

### Vector DB

用于：

```text
RAG
Semantic Search
Experience Retrieval
Memory Candidate Retrieval
```

向量库永远只是索引。

原始数据不能只存在 Vector DB。

---

# 41. Memory Graph

后续还可以在普通 Memory 之上建立关系图。

例如：

```text
Hunter
│
├── owns → Project A
├── prefers → Cocos
└── works_on → Jarvis

Project A
├── uses → Cocos
├── depends_on → Plugin X
└── decision → Architecture B
```

这样 Jarvis 可以完成比单纯 Vector Search 更强的关系推理。

不一定必须上完整 Graph Database。

第一版完全可以用：

```text
Entity
Relation
Entity
```

存在普通数据库中。

---

# 42. Jarvis 与 LLM Wiki 的关系

LLM Wiki 可以视为 Jarvis 的一个子系统。

它主要对应：

```text
Semantic Memory
+
Knowledge Compilation
```

Jarvis 比 Wiki 多：

```text
Goals
Episodes
Experience
Skills
Subagents
Tools
Computer Control
Model Routing
Permissions
Reflection
Self Evolution
```

因此：

```text
LLM Wiki
= Jarvis 的长期知识系统

Jarvis
= 完整 Cognitive Runtime
```

---

# 43. Jarvis 与传统 Agent 的区别

传统 Agent：

```text
Prompt
↓
Reason
↓
Tool
↓
Answer
```

Jarvis：

```text
Identity
+
Goal
+
Memory
+
Experience
+
Skills
+
Context
↓
Reason
↓
Action
↓
Evaluation
↓
Learning
↓
Long-term Evolution
```

---

# 44. Jarvis 与人类认知的对应关系

```text
Working Memory
≈ 人类工作记忆

Episodic Memory
≈ 情景记忆

Semantic Memory
≈ 语义记忆

Skills
≈ 程序性记忆

Reflection
≈ 复盘

Memory Consolidation
≈ 睡眠记忆巩固

Goals
≈ 动机 / 目标

Self Model
≈ 自我认知

Experience
≈ 经历

Attention / Retrieval
≈ 联想和注意力

Subagents
≈ 专业认知模块
```

但目标不是完全模拟人脑。

所有设计仍以：

```text
稳定
高效
可解释
可迁移
可审计
```

为第一原则。

---

# 45. 开发架构

推荐将核心拆成独立模块：

```text
@jarvis/core

@jarvis/context
@jarvis/memory
@jarvis/events
@jarvis/goals
@jarvis/experience
@jarvis/skills
@jarvis/agents
@jarvis/tools
@jarvis/providers
@jarvis/evaluation
@jarvis/permissions
@jarvis/reflection
```

每个模块尽量通过接口通信。

不要让：

```text
Memory → OpenAI

Skill → Claude

Agent → Ollama
```

产生直接依赖。

应该统一经过 Runtime。

---

# 46. 推荐核心接口

概念上可以抽象为：

```text
MemoryStore

remember()
recall()
forget()
update()
search()
consolidate()
```

```text
SkillRegistry

discover()
load()
execute()
evaluate()
promote()
```

```text
CognitiveProvider

reason()
generate()
evaluate()
```

```text
Tool

describe()
checkPermission()
execute()
rollback()
```

```text
Agent

plan()
delegate()
act()
reflect()
```

```text
GoalManager

create()
activate()
complete()
reprioritize()
```

Jarvis Runtime 只依赖这些抽象。

---

# 47. 开发方案

开发时不要围绕“聊天 UI”组织代码。

应该围绕一个完整 Cognitive Loop：

```text
Receive
↓
Understand
↓
Goal
↓
Recall
↓
Plan
↓
Execute
↓
Evaluate
↓
Learn
↓
Remember
```

每个环节都是独立能力。

重点实现：

### Runtime

负责整个 Cognitive Loop。

### Context Builder

根据 Goal 动态构建 Prompt / Context。

### Memory Engine

完成记忆写入、召回、生命周期和 Consolidation。

### Event Store

保存原始事件。

### Experience Engine

保存任务过程和结果。

### Skill Engine

负责 Skill 加载、生成、评价、升级。

### Subagent Manager

动态创建和管理 Agent。

### Cognitive Router

选择本地或云端模型。

### Tool Runtime

统一执行 MCP / CLI / API / UI Tool。

### Permission Engine

控制操作风险。

### Evaluation Engine

负责结果质量判断。

### Reflection Engine

负责经验转化。

---

# 48. 本地部署形态

最终建议专门运行一台 Jarvis Server：

```text
Jarvis Server

├── Jarvis Runtime
├── Local LLM
├── Embedding Model
├── Reranker
├── Database
├── Vector DB
├── MCP Servers
├── Plugin Runtime
└── Background Workers
```

其他设备：

```text
Desktop
Laptop
Phone
Tablet
Browser
Voice Device
```

只是 Jarvis 的客户端。

因此：

> Jarvis 不属于某一台电脑。

Jarvis Server 才是长期存在的“数字大脑”。

---

# 49. 多设备关系

例如：

```text
                    Jarvis Server
                          │
        ┌─────────────────┼────────────────┐
        │                 │                │
     工作电脑            手机            家庭设备
        │                 │                │
      Agent             Voice         Home Assistant
      Tools
```

服务器保存：

```text
Identity
Memory
Experience
Skills
Goals
```

设备只是执行端。

---

# 50. 数据主权

Jarvis 最重要的原则之一：

> **所有关键认知资产必须能够完整导出。**

至少能够导出：

```text
Memory
Events
Experience
Skills
Goals
Workflow
Agent Configuration
Tool Configuration
```

即使未来整个 Runtime 重写：

```text
Jarvis V1
↓
Export Cognitive State
↓
Jarvis V2
```

仍然可以继承过去几年形成的经验。

---

# 51. 最终系统闭环

完整运行过程：

```text
用户 / 外部事件
        ↓
      Goal
        ↓
   Context Builder
        ↓
 Memory Retrieval
        ↓
 Skill Retrieval
        ↓
      Planning
        ↓
┌───────┴────────┐
│                │
Model          Subagent
│                │
└───────┬────────┘
        ↓
      Tools
        ↓
     Action
        ↓
     Result
        ↓
   Evaluation
        ↓
   Experience
        ↓
   Reflection
        ↓
┌───────┼────────────┐
│       │            │
Memory Skill      Goal/Self
Update Candidate   Update
│       │            │
└───────┼────────────┘
        ↓
      Jarvis
    持续成长
```

---

# 52. 最终定义

Jarvis Cognitive Memory Architecture 最终不是一个：

> LLM Wrapper。

也不是：

> Chatbot。

更不是：

> 某个 Agent Framework 的二次封装。

它应该被定义为：

> **一个模型无关、以个人长期认知资产为核心，通过 Memory、Goals、Experience、Skills、Subagents、Tools、Evaluation 和 Reflection 形成持续认知闭环的 Personal Cognitive Runtime。**

它真正需要长期保存的是：

```text
我是谁
你是谁

我知道什么
我经历过什么
我学会了什么

我们正在做什么
为什么这么做

过去哪些方法成功
哪些方法失败

我能够使用什么能力

以及这些东西是如何逐渐形成的
```

模型只是：

> **当前用来思考的器官。**

Memory、Experience、Skills、Goals 和 Identity 才构成：

> **Jarvis 本身。**

最终目标不是打造一个“更好的 AI 聊天工具”。

而是建立一个可以持续数年甚至更久，随着使用不断积累个人知识、经历、技能和工作方式，并且能够跨模型、跨设备、跨时代迁移的：

# Personal Cognitive System