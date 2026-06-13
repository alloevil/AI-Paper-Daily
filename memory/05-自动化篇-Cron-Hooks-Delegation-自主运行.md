# 自动化篇：Cron + Hooks + Delegation + 自主运行

> 让 Hermes Agent 定时执行、事件驱动、自主运行，从被动响应变为主动执行。

**前置要求**：完成入门篇（至少安装并能对话），理解 Session 和 Tool 的基本概念
**预计时间**：2-3 小时
**官方文档**：[Cron](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron) · [Hooks](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks) · [Batch Processing](https://hermes-agent.nousresearch.com/docs/user-guide/features/batch-processing) · [Delegation](https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation)

## 你将学到

- 用 Cron 让 Agent 定时执行任务（CLI 和自然语言两种方式）
- 用 Hooks 监听系统事件并触发自定义逻辑
- 用 Delegation 委派子 Agent 处理子任务，实现并行工作
- 组合使用 Cron + Hooks + Delegation 构建完整的自动化流水线
- 横向对比 Hermes 与 OpenClaw / Claude Code 的自动化能力差异

---

## 1. Cron：定时任务调度

Hermes 的 Cron 功能通过统一的 `cronjob` 工具管理，支持三种调度格式和 20+ 种消息推送平台。

### 1.1 创建定时任务

**CLI 方式：**

```bash
# 30 分钟后执行一次
/cron add 30m "Remind me to check the build"

# 每 2 小时执行
/cron add "every 2h" "Check server status"

# 每小时执行，并挂载 skill
/cron add "every 1h" "Summarize new feed items" --skill blogwatcher

# 用 hermes 命令行
hermes cron create "every 2h" "Check server status"
```

**自然语言方式：**

Hermes 支持用自然语言直接描述定时任务：

> "Every morning at 9am, check Hacker News for AI news and send me a summary on Telegram."

Hermes 会自动解析调度时间和 Delivery 目标，创建对应的 cron job。

### 1.2 调度格式

| 格式 | 示例 | 说明 |
|------|------|------|
| 相对延迟 | `30m`, `2h` | 创建后延迟执行一次 |
| 间隔 | `every 30m` | 每隔固定时间重复 |
| Cron 表达式 | `0 9 * * *` | 标准 cron 语法 |
| ISO 时间戳 | `2025-06-01T09:00:00Z` | 指定绝对时间 |

### 1.3 管理已有任务

```bash
# 列出所有 cron jobs
/cron list

# 暂停 / 恢复
/cron pause <job-id>
/cron resume <job-id>

# 立即触发一次
/cron run <job-id>

# 编辑 prompt 或调度
/cron update <job-id>

# 删除
/cron remove <job-id>
```

### 1.4 Delivery 目标

Cron job 执行结果可以推送到不同平台：

- `origin`（默认）：回到创建时的聊天会话
- `local`：保存到本地文件
- `telegram` / `discord` / `slack` / `feishu` / `email` 等 20+ 平台

**[SILENT] 抑制**：如果 Agent 回复以 `[SILENT]` 开头，则不发送消息，但仍保存到本地。适合"无变化时不打扰"的场景。

### 1.5 Skill-backed Cron Jobs

给 cron job 挂载 skill，让它在执行时自动加载对应的能力：

```bash
/cron add "every 1h" "Summarize new feed items" --skill blogwatcher
```

### 1.6 注意事项

- **自包含 prompt**：Cron 运行在全新 session 中，prompt 必须包含所有必要上下文（不要依赖之前的对话记忆）
- **防递归**：Cron 运行的 session 不能再创建新的 cron job
- **Gateway daemon**：每 60 秒 tick 一次，用文件锁防重复执行
- **Provider recovery**：支持 fallback providers + credential pool rotation
- **安全扫描**：prompt 会经过注入检测和凭据泄露检测

### 1.7 OpenClaw 对比：Cron

OpenClaw 提供类似的定时任务能力，但在执行风格和 Delivery 模型上有差异：

| 维度 | Hermes | OpenClaw |
|------|--------|----------|
| 调度格式 | 相对延迟 / 间隔 / Cron / ISO | Cron 表达式 + heartbeat 间隔 |
| 执行风格 | 统一 cron session | 4 种：main session、isolated、current、session:custom-id |
| Delivery | origin + 20+ 平台 | announce / webhook / none |
| 失败处理 | [待验证] | 3 次指数退避 retry + failureDestination |
| 成本控制 | — | lightContext + isolatedSession + thinking override |
| Webhook 入站 | — | POST /hooks/wake 和 /hooks/agent |

OpenClaw 的 **Standing Orders**（在 `AGENTS.md` 中定义）可以与 cron 配合：Standing Order 定义"做什么"，cron 定义"什么时候做"。

**OpenClaw Heartbeat** 是另一种定时机制——主会话的定时轮询，默认 30 分钟间隔，通过 `HEARTBEAT.md` checklist 驱动任务，支持 `activeHours` 限制活跃时段和 `HEARTBEAT_OK` 静默应答。

---

## 2. Hooks：事件驱动

Hooks 让你监听系统事件并触发自定义逻辑。Hermes 有两套独立的 hook 系统。

### 2.1 Gateway Hooks

注册在 `~/.hermes/hooks/` 目录下，每个 hook 是一个子目录，包含 `HOOK.yaml` 和 `handler.py`。仅在 Gateway 模式下触发。

**Gateway Events（8 种）：**

| 事件 | 触发时机 |
|------|----------|
| `gateway:startup` | Gateway daemon 启动 |
| `session:start` | 新 session 创建 |
| `session:end` | session 结束 |
| `session:reset` | session 重置 |
| `agent:start` | Agent 开始处理 |
| `agent:step` | Agent 每一步执行 |
| `agent:end` | Agent 处理完成 |
| `command:*` | 命令执行（支持通配符） |

### 2.2 Plugin Hooks

通过 `ctx.register_hook()` 注册，在 CLI 和 Gateway 模式下都能触发。

**Plugin Events（6 种）：**

| 事件 | 触发时机 | 特殊能力 |
|------|----------|----------|
| `pre_tool_call` | 工具调用前 | — |
| `post_tool_call` | 工具调用后 | — |
| `pre_llm_call` | LLM 调用前 | **唯一可注入 context 的 hook** |
| `post_llm_call` | LLM 调用后 | — |
| `on_session_start` | session 启动 | — |
| `on_session_end` | session 结束 | — |

### 2.3 关键特性

- **Fire-and-forget**：所有 hook 都是 observer 模式，执行错误被捕获但不会导致系统崩溃
- **通配符支持**：`command:*` 监听所有命令事件
- **内置 boot-md hook**：检测 `~/.hermes/BOOT.md`，Gateway 启动时自动执行其中的内容

### 2.4 创建自定义 Gateway Hook

```bash
# 创建 hook 目录结构
mkdir -p ~/.hermes/hooks/my-hook
```

`~/.hermes/hooks/my-hook/HOOK.yaml`：

```yaml
name: my-hook
events:
  - gateway:startup
  - session:start
```

`~/.hermes/hooks/my-hook/handler.py`：

```python
def handle(event, ctx):
    if event.type == "gateway:startup":
        print("Gateway started!")
    elif event.type == "session:start":
        print(f"New session: {event.session_id}")
```

### 2.5 OpenClaw 对比：Hooks

OpenClaw 的 hook 系统覆盖 14 种事件，结构不同（目录 + `HOOK.md` + `handler.ts`）：

| 维度 | Hermes | OpenClaw |
|------|--------|----------|
| 事件数量 | Gateway 8 + Plugin 6 = 14 | 14 种（覆盖面不同） |
| 实现语言 | Python (`handler.py`) | TypeScript (`handler.ts`) |
| 发现机制 | `~/.hermes/hooks/` | bundled → plugin → managed → workspace 四级 |
| 内置 hooks | boot-md | session-memory, bootstrap-extra-files, command-logger, boot-md |
| 注入能力 | `pre_llm_call` 可注入 context | [待验证] |

---

## 3. Delegation：子 Agent 委派

Delegation 让主 Agent 将子任务委派给独立的子 Agent 处理，支持并行批处理。

### 3.1 单任务委派

```python
delegate_task(
    goal="Analyze the log file and find all error entries from today",
    context="Log file is at /var/log/app.log. Today is 2025-06-01.",
    toolsets=["terminal", "file"]
)
```

### 3.2 并行批处理

```python
delegate_task(tasks=[
    {
        "goal": "Check if the API server is responding",
        "toolsets": ["web"]
    },
    {
        "goal": "Verify database connection pool status",
        "toolsets": ["terminal"]
    },
    {
        "goal": "Review last 24h error logs for anomalies",
        "toolsets": ["file"]
    }
])
```

最多 3 个子 Agent 并发执行。

### 3.3 隔离与限制

| 维度 | 说明 |
|------|------|
| 工具集隔离 | 子 Agent 只能使用指定的工具集（terminal / file / web 等） |
| 被封锁的工具 | delegation, clarify, memory, code_execution, send_message |
| 深度限制 | 子 Agent 不能再委派（深度最大 2） |
| 迭代上限 | 每个子 Agent 最多 50 轮 |
| 模型配置 | 可在 `config.yaml` 的 `delegation.model` 中指定不同模型 |
| 输出 | 只有最终摘要进入父 Agent 上下文 |

### 3.4 实际场景：多文件重构

```python
delegate_task(
    goal="Refactor all Python files in src/ to use async/await. "
         "For each file: convert sync functions to async, update imports, "
         "and verify no syntax errors.",
    context="Project root is at /home/user/myproject. "
            "Target directory: src/ Python files only.",
    toolsets=["file", "terminal"]
)
```

### 3.5 OpenClaw 对比：Delegation

OpenClaw 使用 `sessions_spawn` 进行子任务拆解，支持更灵活的编排：

| 维度 | Hermes | OpenClaw |
|------|--------|----------|
| 工具 | `delegate_task` | `sessions_spawn` |
| 并发上限 | 3 | [待验证] |
| 深度限制 | 2 | maxSpawnDepth: 2 |
| 编排模式 | 任务列表 | 串行 / 并行 / 嵌套 |
| 结果回传 | 最终摘要 | 自动 announce |

---

## 4. 组合实战：构建自动化流水线

单独使用 Cron、Hooks 或 Delegation 各有所长，组合起来才能发挥最大威力。

### 4.1 场景一：每日情报收集

**需求**：每天早上 9 点，自动检查 Hacker News、GitHub Trending、内部 Confluence，生成摘要推送到 Telegram。

```bash
/cron add "0 9 * * *" \
  "1. Check Hacker News front page for AI/LLM news
   2. Check GitHub Trending for Python and TypeScript
   3. Summarize top 5 items from each source
   4. Format as a morning briefing
   5. Send to Telegram" \
  --skill news-aggregator
```

### 4.2 场景二：代码质量守护

**需求**：每次 Agent 处理完成后自动检查是否有新的 Git commit，有的话并行运行 lint + test。

`~/.hermes/hooks/code-guard/HOOK.yaml`：

```yaml
name: code-guard
events:
  - agent:end
```

`~/.hermes/hooks/code-guard/handler.py`：

```python
def handle(event, ctx):
    if not event.context.get("git_commit"):
        return
    # 委派子 Agent 并行执行 lint 和 test
    ctx.delegate_task(tasks=[
        {"goal": "Run linter on changed files", "toolsets": ["terminal"]},
        {"goal": "Run test suite", "toolsets": ["terminal"]}
    ])
```

### 4.3 场景三：自愈监控

**需求**：每 5 分钟检查服务状态，异常时自动重启并通知 on-call。

```bash
/cron add "every 5m" \
  "Check if the API server at http://localhost:8080/health returns 200.
   If unhealthy:
   1. Restart the service: systemctl restart myapi
   2. Wait 10 seconds and verify it's back up
   3. Send alert to #ops-alerts Slack channel with timestamp and error details
   If healthy: reply with [SILENT] All good." \
  --delivery slack
```

利用 `[SILENT]` 抑制机制，正常时不打扰，异常时才发通知。

### 4.4 场景四：会议准备助手

**需求**：每天早上 8:30，查看今天的日历，提取待办事项，准备会议提纲。

```bash
/cron add "30 8 * * 1-5" \
  "Review today's calendar events. For each meeting:
   1. Check if there are related docs or previous meeting notes
   2. Draft a 3-bullet agenda based on recent project activity
   3. Send the prepared briefing to my email"
```

---

## 5. 最佳实践

### 5.1 Cron 设计原则

- **Prompt 自包含**：Cron 在全新 session 中运行，不要依赖之前的对话记忆。把所有上下文写进 prompt。
- **善用 [SILENT]**：无变化时返回 `[SILENT]` 前缀，避免通知疲劳。
- **错误处理在 prompt 中**：明确告诉 Agent 失败时该做什么（重试、通知、记录日志）。
- **避免递归**：Cron 运行的 session 不能创建新的 cron job，设计时注意这一点。

### 5.2 Hooks 设计原则

- **Fire-and-forget**：Hook 执行失败不影响主流程，把重要逻辑放在主 Agent 中。
- **尽量用 Plugin hooks**：Gateway hooks 只在 Gateway 模式下生效，Plugin hooks 两种模式都支持。
- **利用 pre_llm_call**：这是唯一可以在 LLM 调用前注入额外 context 的 hook，适合加载外部知识。

### 5.3 Delegation 设计原则

- **粒度适中**：每个子任务应该能在 50 轮内完成，太复杂就拆得更细。
- **工具集最小化**：只给子 Agent 必需的工具，降低风险。
- **结果聚合**：父 Agent 只收到最终摘要，确保子 Agent 的 prompt 要求生成结构化输出。

### 5.4 组合模式速查

| 模式 | 组件 | 用途 |
|------|------|------|
| 定时采集 | Cron + Skill | 定时执行固定任务 |
| 事件响应 | Hook + Delegation | 事件触发后委派子 Agent 处理 |
| 定时巡检 | Cron + [SILENT] | 定时检查，异常才通知 |
| 并行处理 | Delegation(tasks) | 多个独立子任务并行执行 |
| 自主运行 | Cron + Hook + Delegation | 完整的无人值守流水线 |

---

## 6. 横向对比：Hermes vs OpenClaw vs Claude Code

| 维度 | Hermes Agent | OpenClaw | Claude Code |
|------|-------------|----------|-------------|
| **定时任务** | `cronjob` 工具（action-style） | Cron + Heartbeat | `/loop` + CronCreate / Routines / Desktop tasks |
| **调度格式** | 相对延迟 / 间隔 / Cron / ISO | Cron + heartbeat 间隔 | 会话级 / 云端 / 本地 |
| **执行风格** | 统一 cron session | 4 种（main / isolated / current / custom） | 3 层（loop / routine / desktop） |
| **最小间隔** | [待验证] | [待验证] | loop: 即时, routine: 1h, desktop: 1min |
| **Hook 事件数** | 14（Gateway 8 + Plugin 6） | 14 | 22+ |
| **Hook 语言** | Python | TypeScript | command / http / prompt / agent |
| **子 Agent 委派** | `delegate_task` | `sessions_spawn` | [待验证] |
| **并行子任务** | 最多 3 | [待验证] | [待验证] |
| **委派深度** | 2 | maxSpawnDepth: 2 | [待验证] |
| **Delivery 平台** | 20+（含 Telegram / Discord / Slack / Feishu） | announce / webhook / none | MCP 插件推送 |
| **自主授权** | [待验证] | Standing Orders（AGENTS.md） | [待验证] |
| **Webhook 入站** | [待验证] | POST /hooks/wake + /hooks/agent | [待验证] |
| **失败重试** | [待验证] | 3 次指数退避 | [待验证] |
| **成本控制** | Provider recovery + credential pool | lightContext + thinking override | — |

### 选型建议

- **Hermes**：适合需要丰富的 Delivery 平台（20+ 渠道）和 Skill-backed cron 的场景，自然语言创建 cron 的体验最流畅
- **OpenClaw**：适合需要精细控制执行风格（4 种 session 模式）、Standing Orders 自主授权、以及 Webhook 入站集成的场景
- **Claude Code**：适合开发场景中需要 22+ 种 hook 事件和 Routines 云端调度的场景，与 Git/GitHub 深度集成

---

## 下一步

- **推荐阅读**：
  - [架构篇：Agent 内核与 Session 模型](./03-架构篇-Agent内核与Session模型.md)
  - [工具篇：Tool / MCP / Skill](./04-工具篇-Tool-MCP-Skill.md)
  - [Hermes Agent 官方文档 — Cron](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron)
  - [Hermes Agent 官方文档 — Hooks](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks)
  - [Hermes Agent 官方文档 — Delegation](https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation)

---

*本文基于 Hermes Agent [版本待确认]*
