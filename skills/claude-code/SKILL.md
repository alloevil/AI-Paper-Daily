---
name: claude-code
description: 安装、配置和使用 Claude Code（Anthropic 官方 CLI 工具）。当用户要求安装 claude code、配置 claude、使用 claude 命令行工具、或需要通过 ACP harness 调用 Claude Code 时使用。基于小米内部大模型 API 开放平台（mify）。
---

# Claude Code Skill

Claude Code 是 Anthropic 的官方 AI 编程 CLI 工具，支持代码生成、文件编辑、bash 执行、多轮对话等。

## ⚙️ 安装

```bash
cd ~/.openclaw/workspace && npm install @anthropic-ai/claude-code --save --cache /tmp/npm-cache
```

安装后二进制位置：`~/.openclaw/workspace/node_modules/.bin/claude`

## 🔧 配置

### 1. 创建配置目录

容器环境 node 用户无 root 权限，配置文件写到 `/home/node`：

```bash
mkdir -p /home/node/.claude
```

### 2. 写入 settings.json

路径：`/home/node/.claude/settings.json`

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://model.mify.ai.srv/anthropic",
    "ANTHROPIC_API_KEY": "<从 openclaw.json 的 models.providers.openai.apiKey 获取>",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "xiaomi/mimo-v2-pro-mit",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "xiaomi/mimo-v2-pro-mit",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "xiaomi/mimo-v2-omni"
  }
}
```

### 3. 跳过 Onboarding

路径：`/home/node/.claude.json`

```json
{
  "hasCompletedOnboarding": true
}
```

### 4. 模型选择

| 档位 | 推荐模型 | 说明 |
|------|---------|------|
| opus（重度） | `xiaomi/mimo-v2-pro-mit` | 1M context，适合复杂任务 |
| sonnet（默认） | `xiaomi/mimo-v2-pro-mit` | 同上 |
| haiku（轻量） | `xiaomi/mimo-v2-omni` | 250k context，支持图片 |

其他可用模型：`ppio/pa/claude-opus-4-6`、`ppio/pa/claude-sonnet-4-6`、`azure_openai/gpt-5.4`

## 🚀 使用

### 基本命令

```bash
# 设置 HOME（容器环境必须）
HOME=/home/node ~/.openclaw/workspace/node_modules/.bin/claude -p "你的问题"

# 跳过权限审批（自动执行 bash/文件操作）
HOME=/home/node ~/.openclaw/workspace/node_modules/.bin/claude -p "任务" --dangerously-skip-permissions

# JSON 输出（便于程序化解析）
HOME=/home/node ~/.openclaw/workspace/node_modules/.bin/claude -p "任务" --output-format json
```

### 在 OpenClaw 中调用

通过 `sessions_spawn` + `runtime="acp"` 调用：

```
sessions_spawn(runtime="acp", task="...", agentId="claude-code")
```

或直接 `exec` 调用：

```bash
HOME=/home/node ~/.openclaw/workspace/node_modules/.bin/claude -p "任务" --dangerously-skip-permissions --output-format json
```

### 关键参数

| 参数 | 说明 |
|------|------|
| `-p "prompt"` | 非交互模式，直接执行 |
| `--output-format json` | JSON 格式输出（含耗时、token、结果） |
| `--dangerously-skip-permissions` | 跳过 bash/文件操作审批 |
| `--model <model>` | 临时指定模型 |
| `--resume <session_id>` | 恢复之前的会话 |

### JSON 输出结构

```json
{
  "type": "result",
  "is_error": false,
  "duration_ms": 3187,
  "result": "输出内容",
  "modelUsage": {
    "xiaomi/mimo-v2-pro-mit": {
      "inputTokens": 22755,
      "outputTokens": 10
    }
  }
}
```

## ⚠️ 注意事项

1. **权限问题**：容器环境 node 用户无法写 `/root`，需要指定 `HOME=/home/node` 或使用 `/tmp` 路径
2. **API Key 安全**：不要在群聊或日志中暴露 API Key
3. **跳过审批**：非交互模式下必须加 `--dangerously-skip-permissions`，否则 bash 命令会被拦截等待审批
4. **网络依赖**：需要能访问 `http://model.mify.ai.srv/anthropic`（内网）

## 📚 参考

- 官方文档：https://docs.anthropic.com/en/docs/claude-code
- 小米内部 wiki：https://mi.feishu.cn/wiki/OhJtwtShFiP41bkAsxKc3bIQnis
- Token 监测：https://llm.mioffice.cn/monitor
