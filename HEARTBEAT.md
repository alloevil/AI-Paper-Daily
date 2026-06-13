---
title: "HEARTBEAT.md"
summary: "Heartbeat system prompt file"
read_when:
  - 收到心跳轮询时
---

# HEARTBEAT.md

## 交互日志维护

每次心跳时，检查是否有新的人工交互未记录到 `memory/interaction_log.jsonl`：

1. 检查最近 24 小时是否有瑞林发来的 DM/群聊消息（通过 session 上下文判断）
2. 如果有未记录的交互，追加到 `memory/interaction_log.jsonl`，格式：
   ```
   {"date":"YYYY-MM-DD","time":"HH:MM","source":"dm/group","chat_id":"xxx","summary":"一句话摘要"}
   ```
3. 如果没有新交互或已全部记录，跳过

其他任务统一使用 cron，不在 HEARTBEAT.md 中定义。
