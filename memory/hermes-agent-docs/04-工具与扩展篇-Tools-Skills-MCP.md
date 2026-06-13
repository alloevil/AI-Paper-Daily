# 第 4 篇：工具与扩展篇 — Tools + Skills + MCP

> 让 Hermes Agent 不只会聊天，还能搜索、编码、操作浏览器、连接外部世界。

**前置要求**：已安装 Hermes Agent（见 [第 1 篇](https://feishu.cn/docx/X2fjddtjkobmYqxBCF9cXQVvnSe)）
**预计时间**：20 分钟
**官方文档**：[Tools & Toolsets](https://hermes-agent.nousresearch.com/docs/user-guide/features/tools) | [Skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills) | [MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp) | [Adding Tools](https://hermes-agent.nousresearch.com/docs/developer-guide/adding-tools) | [Creating Skills](https://hermes-agent.nousresearch.com/docs/developer-guide/creating-skills)

## 你将学到

- 三种扩展方式（内置工具、MCP、Skills）各自解决什么问题
- 怎么启用 / 禁用内置工具集
- 怎么接入 MCP server 连接外部工具
- 怎么安装和创建 Skill
- Hermes 和 OpenClaw 在工具扩展上的差异

---

## 1. 为什么需要工具扩展

一个纯文本 LLM 只能"说"，不能"做"。Hermes Agent 的核心价值在于：**给 LLM 装上手脚**。

Hermes 的能力 = 内置工具 + 外部工具 + 自定义 Skills，三者是层次关系：

| 层 | 机制 | 适用场景 | 改动代价 |
|---|------|---------|---------|
| 内置工具 | 开箱即用，配置开关 | 搜索、终端、浏览器、文件操作 | 零代码，改配置 |
| MCP | 接外部工具服务器 | GitHub、数据库、内部 API | 零代码，加配置 |
| Skills | 打包提示词 + 脚本 | 工作流自动化、领域知识 | 写 SKILL.md |
| 自定义工具 | 源码级扩展 | 需要深度集成的原生能力 | 写 Python |

**选择原则**：能用 Skill 解决的不写 Tool，能用 MCP 接入的不写 Skill，能开内置工具的不折腾外部。

官方文档原话："Before writing a tool, ask yourself: should this be a skill instead?"

---

## 2. 内置工具

Hermes 内置了一套全面的工具注册表，按类别组织：

### 工具一览表

| 类别 | 工具 | 说明 |
|------|------|------|
| Web | `web_search`, `web_extract` | 搜索网页 & 提取页面内容 |
| Terminal & Files | `terminal`, `process`, `read_file`, `patch` | 执行命令 & 操作文件 |
| Browser | `browser_navigate`, `browser_snapshot`, `browser_vision` | 交互式浏览器自动化（文本 + 视觉） |
| Media | `vision_analyze`, `image_generate`, `text_to_speech` | 多模态分析与生成 |
| Agent 编排 | `todo`, `clarify`, `execute_code`, `delegate_task` | 规划、澄清、代码执行、子代理委派 |
| Memory | `memory`, `session_search` | 持久化记忆 & 会话搜索 |
| 自动化 | `cronjob`, `send_message` | 定时任务（create/list/update/pause/resume/run/remove）+ 消息投递 |
| 集成 | `sha_*`, `rl_*`, MCP server tools | Home Assistant、RL 训练、MCP 等 |

### 启用 / 禁用工具集

工具按 toolset 分组，可以按需开关：

```bash
# 只启用 web 和 terminal 工具集
hermes chat --toolsets "web,terminal"

# 查看所有可用工具
hermes tools

# 交互式配置各平台的工具
hermes tools
```

常用 toolset 名称：`web`, `terminal`, `file`, `browser`, `vision`, `image_gen`, `moa`, `skills`, `tts`, `todo`, `memory`, `session_search`, `cronjob`, `code_execution`, `delegation`, `clarify`, `homeassistant`, `rl`。

### 平台特定 toolset

不同平台预设不同的工具组合：

| 平台 | Toolset 名称 | 说明 |
|------|-------------|------|
| CLI | `hermes-cli` | 完整工具集 |
| Telegram | `hermes-telegram` | 适配 Telegram 的工具子集 |
| Discord | hermes-discord | 适配 Discord 的工具子集 |
| MCP | `mcp-<server>` | 动态生成，每个 MCP server 一个 |

完整列表见 [Toolsets Reference](https://hermes-agent.nousresearch.com/docs/reference/toolsets-reference)。

### Terminal 后端

`terminal` 工具支持多种执行环境：

| 后端 | 说明 | 适用场景 |
|------|------|---------|
| `local` | 本地执行（默认） | 开发、可信任务 |
| `docker` | 隔离容器 | 安全、可复现 |
| `ssh` | 远程服务器 | 沙箱、隔离 agent 与代码 |
| `singularity` | HPC 容器 | 集群计算、rootless |
| `modal` | 无服务器云执行 | 弹性扩展 |
| `daytona` | 云沙箱工作区 | 持久远程开发 |

配置示例（`~/.hermes/config.yaml`）：

```yaml
terminal:
  backend: docker          # or: local, ssh, singularity, modal, daytona
  docker_image: python:3.11-slim
  container_cpu: 1
  container_memory: 5120   # MB
  container_disk: 51200    # MB
  container_persistent: true
  timeout: 180             # 秒
```

所有容器后端都有安全加固：只读根文件系统、全部 capabilities dropped、禁止提权、PID 限制、完整 namespace 隔离。

### 后台进程管理

```python
# 启动后台进程
terminal(command="pytest -v tests/", background=true)
# 返回: {"session_id": "proc_abc123", "pid": 12345}

# 管理进程
process(action="list")       # 列出所有运行中的进程
process(action="poll", session_id="proc_abc123")  # 检查状态
process(action="wait", session_id="proc_abc123")  # 阻塞等待完成
process(action="log", session_id="proc_abc123")   # 查看完整输出
process(action="kill", session_id="proc_abc123")   # 终止
process(action="write", session_id="proc_abc123", data="y")  # 发送输入
```

PTY 模式（`pty=true`）支持交互式 CLI 工具，如 Claude Code 等。

---

## 3. MCP（Model Context Protocol）

### 为什么需要 MCP

内置工具再丰富，也覆盖不了所有场景——GitHub Issue 管理、数据库查询、内部 API 调用……如果每种外部工具都要写原生 Tool，扩展成本太高。

**MCP 是一个标准化的工具接入协议**：只要外部服务实现了 MCP server，Hermes 就能自动发现并使用它的工具，无需写一行 Python 代码。

MCP 带来什么：
- 直接使用外部工具生态，无需先写原生 Hermes tool
- 本地 stdio server 和远程 HTTP server 统一配置
- 启动时自动发现和注册工具
- 按 server 粒度过滤，只暴露你想用的工具

### 两种 MCP server

| 类型 | 通信方式 | 适用场景 |
|------|---------|---------|
| Stdio | 本地子进程，stdin/stdout | 本地安装的 server、低延迟访问 |
| HTTP | 远程 HTTP 端点 | 组织内部 MCP 端点、不想本地启子进程 |

### 配置方式

在 `~/.hermes/config.yaml` 的 `mcp_servers` 下添加：

**Stdio 示例**（GitHub server）：

```yaml
mcp_servers:
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "***"
```

**HTTP 示例**：

```yaml
mcp_servers:
  company_api:
    url: "https://mcp.internal.example.com"
    headers:
      Authorization: "Bearer ***"
```

配置好后直接 `hermes chat`，Hermes 会自动发现 MCP server 的工具。

### 工具命名规则

Hermes 自动给 MCP 工具加前缀，避免和内置工具冲突：

```
mcp_<server_name>_<tool_name>
```

| Server | MCP 工具名 | 注册名 |
|--------|-----------|--------|
| filesystem | read_file | `mcp_filesystem_read_file` |
| github | create-issue | `mcp_github_create_issue` |

实际使用中你不需要手动调用带前缀的名字——Hermes 在推理过程中会自动选择。

### 工具过滤

可以精确控制每个 MCP server 暴露哪些工具：

```yaml
mcp_servers:
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "***"
    tools:
      include: [create_issue, list_issues]    # 白名单：只注册这几个
      prompts: false                           # 禁用 prompt 工具包装
      resources: false                         # 禁用 resource 工具包装

  stripe:
    url: "https://mcp.stripe.com"
    headers:
      Authorization: "Bearer ***"
    tools:
      exclude: [delete_customer]               # 黑名单：排除危险操作

  legacy:
    url: "https://mcp.legacy.internal"
    enabled: false                             # 整个 server 禁用
```

过滤优先级：如果 `include` 和 `exclude` 同时存在，`include` 优先。

### 运行时行为

- **启动发现**：Hermes 在启动时发现 MCP server 并注册工具
- **动态发现**：MCP server 可以发送 `notifications/tools/list_changed` 通知，Hermes 自动重新拉取工具列表
- **手动重载**：修改配置后用 `/reload-mcp` 重新加载
- **Server 级 toolset**：每个 MCP server 自动创建 `mcp-<server>` toolset

### MCP Sampling

MCP server 可以通过 `sampling/createMessage` 协议请求 Hermes 做 LLM 推理——适用于需要 LLM 能力但没有自己模型访问的 server。

```yaml
mcp_servers:
  my_server:
    command: "my-mcp-server"
    sampling:
      enabled: true
      model: "openai/gpt-4o"     # 可选：覆盖默认模型
      max_tokens_cap: 4096
      timeout: 30
      max_rpm: 10                # 每分钟最大请求数
      max_tool_rounds: 5         # 采样循环中最大工具调用轮数
```

采样处理器内置滑动窗口限速、单请求超时和工具调用深度限制，防止滥用。

### Hermes 作为 MCP Server

Hermes 本身也可以充当 MCP server，让 Claude Code、Cursor 等 MCP client 使用 Hermes 的消息能力：

```bash
hermes mcp serve
```

暴露 10 个工具：`conversations_list`, `messages_read`, `messages_send`, `events_poll`, `events_wait` 等，覆盖全平台消息收发。

配置到 Claude Code：

```json
{
  "mcpServers": {
    "hermes": {
      "command": "hermes",
      "args": ["mcp", "serve"]
    }
  }
}
```

Gateway 读操作不需要运行，发送操作需要 gateway 处于运行状态。

---

## 4. 自定义工具（Adding Tools）

### 为什么自己写工具

当能力需要以下特性时，Skill 不够用，需要写原生 Tool：
- 端到端 API Key 集成和认证流程
- 自定义处理逻辑（必须精确执行）
- 二进制数据、流式处理、实时事件

官方判断标准：**"能用指令 + shell + 现有工具表达的 → Skill；需要 API Key + 自定义逻辑 + 流式处理 → Tool"**

### 开发流程

添加一个工具涉及 2 个文件：

**1) 创建工具文件** `tools/your_tool.py`：

```python
"""Weather Tool -- look up current weather for a location."""

import json
import os
from tools.registry import registry

# --- 可用性检查 ---
def check_weather_requirements() -> bool:
    return bool(os.getenv("WEATHER_API_KEY"))

# --- Handler ---
def weather_tool(location: str, units: str = "metric") -> str:
    api_key = os.getenv("WEATHER_API_KEY")
    if not api_key:
        return json.dumps({"error": "WEATHER_API_KEY not configured"})
    try:
        # ... 调用天气 API ...
        return json.dumps({"location": location, "temp": 22, "units": units})
    except Exception as e:
        return json.dumps({"error": str(e)})

# --- Schema ---
WEATHER_SCHEMA = {
    "name": "weather",
    "description": "Get current weather for a location.",
    "parameters": {
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "City name or coordinates"
            },
            "units": {
                "type": "string",
                "enum": ["metric", "imperial"],
                "default": "metric"
            }
        },
        "required": ["location"]
    }
}

# --- 注册（自动发现，无需手动 import）---
registry.register(
    name="weather",
    toolset="weather",
    schema=WEATHER_SCHEMA,
    handler=lambda args, **kw: weather_tool(
        location=args.get("location", ""),
        units=args.get("units", "metric")),
    check_fn=check_weather_requirements,
    requires_env=["WEATHER_API_KEY"],
)
```

**2) 加入 toolset**（`toolsets.py`）：

```python
# 方式 A：加入全局核心工具
_HERMES_CORE_TOOLS = [..., "weather"]

# 方式 B：创建独立 toolset
"weather": {
    "description": "Weather lookup tools",
    "tools": ["weather"],
    "includes": []
},
```

### 关键规则

| 规则 | 说明 |
|------|------|
| 返回值 | Handler 必须返回 JSON string（`json.dumps()`），不能返回 raw dict |
| 错误处理 | 返回 `{"error": "message"}`，不能 raise exception |
| 可用性检查 | `check_fn` 返回 `False` 时工具被静默排除 |
| 自动发现 | 只要文件在 `tools/` 下且有顶层 `registry.register()` 调用，启动时自动发现 |
| 异步支持 | 标记 `is_async=True`，registry 自动处理 async 桥接 |

### Setup Wizard 集成

如果你的工具需要 API Key，可以加入 `hermes_cli/config.py` 的 `OPTIONAL_ENV_VARS`，用户运行 `hermes setup` 时会自动提示输入。

---

## 5. Skills

### 什么是 Skill

Skill 是**工具 + 提示词 + 配置**的打包体。它是一个知识文档，告诉 agent 在特定场景下怎么做。

核心特征：
- **零代码**：不需要改 Hermes 源码
- **渐进加载**：先看描述（~3k tokens），需要时才加载完整内容
- **斜杠命令**：安装后自动变成 `/skill-name` 命令
- **兼容标准**：遵循 [agentskills.io](https://agentskills.io/specification) 开放规范

### Skills vs Tools

| 维度 | Skill | Tool |
|------|-------|------|
| 本质 | 知识文档（提示词 + 脚本） | 代码函数 |
| 创建方式 | 写 SKILL.md | 写 Python + 注册 |
| 改动代价 | 零代码，编辑 markdown | 改源码，理解 registry |
| 适用场景 | 工作流、CLI 封装、领域知识 | API 集成、二进制处理、流式 |
| 灵活度 | 高（agent 可自由解读） | 低（固定 schema） |

### 安装已有 Skill

Hermes 的 Skills Hub 连接了多个生态系统：

```bash
# 浏览所有 hub skills
hermes skills browse

# 只看官方可选 skills
hermes skills browse --source official

# 搜索
hermes skills search kubernetes
hermes skills search react --source skills-sh

# 安装
hermes skills install openai/skills/k8s
hermes skills install official/security/1password

# 检查更新
hermes skills check
hermes skills update

# 安全审计
hermes skills audit
```

**Hub 来源**：

| 来源 | 标识 | 说明 |
|------|------|------|
| Official | `official/...` | Hermes 仓库内置，自带信任 |
| skills.sh | `skills-sh/...` | Vercel 的公开 skills 目录 |
| Well-known | `well-known:URL` | 网站 `/.well-known/skills/index.json` 发现 |
| GitHub | `owner/repo/path` | 直接从 GitHub 安装 |
| ClawHub | `clawhub` | 第三方 skills 市场 |
| LobeHub | `lobehub` | LobeHub 的 agent 目录 |

**信任级别**：

| 级别 | 来源 | 策略 |
|------|------|------|
| builtin | 随 Hermes 发布 | 始终信任 |
| official | `optional-skills/` | 内置信任，无第三方警告 |
| trusted | openai/skills, anthropics/skills | 比社区来源更宽松 |
| community | 其他所有 | 非危险发现可用 `--force` 覆盖；危险发现保持阻断 |

所有 hub 安装的 skill 都经过安全扫描：检查数据外泄、提示注入、破坏性命令、shell 注入等。

### 创建自己的 Skill

**目录结构**：

```
~/.hermes/skills/
├── mlops/
│   └── axolotl/
│       ├── SKILL.md          # 主指令（必需）
│       ├── references/       # 附加文档
│       ├── templates/        # 输出模板
│       ├── scripts/          # 辅助脚本
│       └── assets/           # 附加资源
```

**SKILL.md 格式**：

```yaml
---
name: my-skill
description: Brief description of what this skill does
version: 1.0.0
platforms: [macos, linux]        # 可选：限制平台
metadata:
  hermes:
    tags: [python, automation]
    category: devops
    requires_toolsets: [terminal]   # 可选：依赖的 toolset
    fallback_for_toolsets: [web]    # 可选：当某 toolset 不可用时激活
    config:                         # 可选：config.yaml 设置
      - key: my.setting
        description: "What this controls"
        default: "value"
        prompt: "Prompt for setup"
required_environment_variables:     # 可选：声明需要的环境变量
  - name: MY_API_KEY
    prompt: "Enter your API key"
    help: "Get one at https://example.com"
    required_for: "API access"
---

# Skill Title

## When to Use
触发条件。

## Procedure
1. Step one
2. Step two

## Pitfalls
- 已知失败模式和修复

## Verification
如何确认成功。
```

### 条件激活

Skill 可以根据当前工具可用性自动显示 / 隐藏：

```yaml
metadata:
  hermes:
    # 只有当 web toolset 不可用时才显示（作为 fallback）
    fallback_for_toolsets: [web]
    # 只有当 terminal toolset 可用时才显示
    requires_toolsets: [terminal]
```

实际案例：内置的 `duckduckgo-search` skill 设置了 `fallback_for_toolsets: [web]`——有 Firecrawl API Key 时用 `web_search`，没有时 DuckDuckGo skill 自动出现。

### Agent 自动创建 Skill

Hermes agent 可以在完成复杂任务后自动将经验保存为 Skill（通过 `skill_manage` tool）：

- 完成 5+ 工具调用的复杂任务后
- 遇到错误但找到了正确路径时
- 用户纠正了 agent 的做法时
- 发现了非平凡的工作流时

操作：`create`（新建）、`patch`（精准修改，推荐）、`edit`（整体重写）、`delete`（删除）

### 外部 Skill 目录

如果你在 Hermes 之外维护了共享 skills 目录：

```yaml
# ~/.hermes/config.yaml
skills:
  external_dirs:
    - ~/.agents/skills
    - /home/shared/team-skills
```

外部目录只读扫描，本地优先（同名 skill 本地覆盖外部），不存在的路径静默跳过。

---

## 6. 横向对比：Hermes vs OpenClaw

| 维度 | Hermes Agent | OpenClaw |
|------|-------------|---------|
| 工具注册 | `tools/*.py` + `registry.register()` 自动发现 | 工具由系统预定义，agent 调用 |
| 工具集管理 | 按 toolset 开关，CLI / 平台预设 | 由 policy 过滤可用工具 |
| MCP | 原生支持 stdio + HTTP，`config.yaml` 配置 | 通过 MCP Server 连接（`mcporter` skill） |
| Skills | 文件系统 `~/.hermes/skills/`，渐进加载 | 文件系统 `~/.openclaw/skills/`，available_skills 注入 |
| Skill 发现 | Skills Hub（官方 + skills.sh + GitHub + well-known） | maihub-skill-finder 检索小米技能市场 + ClawHub |
| 自动创建 Skill | agent 通过 `skill_manage` 自动保存经验 | 无内置自动创建，需手动编写 |
| 终端后端 | 6 种（local / docker / ssh / singularity / modal / daytona） | exec 工具直接执行，无多后端 |
| 安全扫描 | hub skill 安装前自动扫描 | skill 由开发者自行审查 |
| 平台特定 toolset | 预设 `hermes-cli` / `hermes-telegram` 等 | 无 toolset 概念，按 channel 配置 |

**核心差异**：Hermes 的扩展体系更"开发者友好"——toolset 概念让工具管理有层次感，Skills Hub 像 npm 一样搜索安装 skill，MCP 支持也更完整（含 sampling、动态发现）。OpenClaw 更"运维友好"——工具开箱即用，skill 注入系统提示词，不需要理解 registry 概念。

---

## 下一步

- **动手实验**：试试 `hermes skills browse`，安装几个感兴趣的 skill
- **接入 MCP**：给你的项目加一个 GitHub MCP server，体验自动工具发现
- **创建 Skill**：把你重复做的事情写成 SKILL.md，让 agent 记住
- **下一篇**：[第 5 篇：自动化篇 — Cron + Hooks + Batch + Delegation](#)（🚧 施工中）
- **参考文档**：
  - [Built-in Tools Reference](https://hermes-agent.nousresearch.com/docs/reference/tools-reference)
  - [Toolsets Reference](https://hermes-agent.nousresearch.com/docs/reference/toolsets-reference)
  - [Skills Catalog](https://hermes-agent.nousresearch.com/docs/reference/skills-catalog)
  - [Use MCP with Hermes](https://hermes-agent.nousresearch.com/docs/guides/use-mcp-with-hermes)

---

*本文基于 Hermes Agent 最新稳定版，内容来源于 [官方文档](https://hermes-agent.nousresearch.com/docs/)。如有更新，请以官方文档为准。*