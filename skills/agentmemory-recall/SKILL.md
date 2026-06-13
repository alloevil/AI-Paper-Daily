---
name: agentmemory-recall
description: 直接查询 agentmemory（iii-engine），搜索历史会话记忆、语义事实、洞察。当需要回忆过去会话中的具体细节、决策、上下文时使用。
---

# agentmemory-recall

直接查询 agentmemory（iii-engine）的会话记忆系统，绕过 MCP 层。

## 何时使用

- 用户问「之前做过什么」「上次怎么决定的」「那个项目怎么样了」
- 需要回忆历史会话中的具体细节、决策上下文
- memory-core（memory/*.md）找不到足够细节时

## 可用函数

| 函数 ID | 用途 | 适用场景 |
|---------|------|----------|
| `mem::search` | 搜索观察记录 | **首选**，通用搜索 |
| `mem::smart-search` | 混合语义+关键词搜索 | 需要更精准的召回 |
| `mem::sessions` | 列出会话 | 查看有哪些历史会话 |
| `mem::insight-search` | 搜索洞察 | 查找跨会话归纳的模式 |
| `mem::lesson-list` | 列出经验教训 | 查找保存的 lessons |
| `mem::semantic-list` | 列出语义事实 | 查看自动提取的事实 |

## 调用方式

```bash
bash ~/.openclaw/workspace/skills/agentmemory-recall/recall.sh <function_id> '<json_payload>'
```

### 搜索示例

```bash
# 搜索历史会话
bash ~/.openclaw/workspace/skills/agentmemory-recall/recall.sh mem::search '{"query":"卢总蒸馏 自定义实体","limit":5}'

# 混合搜索
bash ~/.openclaw/workspace/skills/agentmemory-recall/recall.sh mem::smart-search '{"query":"OpenSpace 安装问题","limit":5}'

# 列出会话
bash ~/.openclaw/workspace/skills/agentmemory-recall/recall.sh mem::sessions '{}'

# 搜索洞察
bash ~/.openclaw/workspace/skills/agentmemory-recall/recall.sh mem::insight-search '{"query":"飞书消息","limit":5}'

# 列出语义事实
bash ~/.openclaw/workspace/skills/agentmemory-recall/recall.sh mem::semantic-list '{}'

# 列出经验教训
bash ~/.openclaw/workspace/skills/agentmemory-recall/recall.sh mem::lesson-list '{}'
```

## 参数说明

### mem::search
- `query` (必填): 搜索关键词
- `limit` (可选): 返回条数，默认 10
- `format` (可选): full/compact/narrative，默认 full

### mem::smart-search
- `query` (必填): 搜索关键词
- `limit` (可选): 返回条数，默认 10
- `expandIds` (可选): 展开指定观察 ID

## 注意事项

- iii-engine 必须在 port 49134 运行
- 返回结果为 JSON 格式，包含 score、sessionId、observation 等字段
- 搜索结果中 `narrative` 字段是完整的观察记录内容
- 与 memory-core（memory_search）互补使用，memory-core 查文件，agentmemory 查会话
