# MEMORY.md — 元气小🦐 的长期记忆

## 关于瑞林

- 高瑞林，通过飞书（小米办公Pro）交互
- 时区：Asia/Shanghai (GMT+8)
- 偏好：学习批判性思维、自我提升
- **发文件方式**：飞书 API 直接调用（2026-05-12 确认）：① appId+appSecret 换 tenant_access_token；② POST `/im/v1/files` 上传拿 file_key；③ POST `/im/v1/messages` 发 file 消息。message 工具发文件经常 ECONNRESET，不要用。

## 工作习惯

- **每日备份**：cron 自动执行，打包工作空间发给瑞林
- **每日复盘**：每天向瑞林汇报——矛盾点、优化点，持续变强
- **执行中主动暴露疑虑**：不清楚的先讲出来再动手

## 搜索三件套

- **Tavily** → **Exa** → **Firecrawl** → **百度** → 小米MCP
- API key 在 openclaw.json `env` 字段，容器重建后需恢复
- 备份：`~/.openclaw/.search_keys`（chmod 600）

## Memory 搜索（2026-04-24 更新）

- ✅ 已启用 memory-core 插件
- Embedding：`qwen3-embedding-8B-dms-2025-07-17`（远程）
- Provider：openai（指向小米 internal embedding 服务）

## Cron 配置

- isolated session timeout ≥ 600s
- cron 任务用 mimo 足够，不用 opus
- jobs.json：`~/.openclaw/cron/jobs.json`
- 当前任务：科技情报(9:00)、复盘(9:30)、会话统计(0:00)

## Claude Code

- 已安装：`~/.openclaw/workspace/node_modules/.bin/claude` v2.1.92
- Skill：`skills/claude-code/`

## 容器权限

- elevated 模式飞书不支持审批，且拦截所有 exec
- npm 全局安装失败时用 `npm install <pkg> --cache /tmp/npm-cache`
- HOME=/home/node，node 用户无 /root 写权限

## gBrain 知识库（2026-04-23）

- 安装：`~/gbrain/`，DB：`~/.gbrain/brain.pglite`（1024维）
- Embedding：`tongyi/text-embedding-v3`（via mify）
- 命令：`gbrain query` / `gbrain get` / `gbrain sync` / `gbrain stats`

## Daily News

- v3 已扩源：候选池 324 条，14 个 RSS 源
- 飞书文档化：「每日科技情报」文件夹，命名 `每日科技情报 - YYYYMMDD`

## 语音发送

- **必须用 tts-feishu skill**：`python3 scripts/tts_send.py --text "..." --open-id/chat-id "..."`
- 不能直接发 wav/mp3 文件，要通过飞书音频消息格式发送
- TTS 模型：`xiaomi/mimo-v2.5-tts`（mify 端点）
- 风格控制用自然语言（--style 参数），不用 `<style>` 标签

## 教训

- "知识库"需确认飞书 Wiki 还是本地文件
- 版权内容坚决拒绝
- 系列文档先建目录页再逐篇创建
- 联网搜索链路：Tavily → Exa → Firecrawl → 百度 → web_fetch → Jina
- **软约束 → 硬编码**：Agent 执行依赖的步骤必须在代码里固化
- **不了解自己的工具箱**：复杂任务应主动拆子代理并行执行
- **政府网站抓取**：JS 渲染找 API 接口；iframe 附件必须 Playwright

## 已完成里程碑

- 《学会提问》10篇飞书文档（2026-03-19）
- pretext-term 终端动画项目 + 6 个 demo（2026-03-31）
- OpenClaw Agent 调优实战手册（2026-04-13）
- Hermes Agent 系列文档（2026-04-13-14）

## Promoted From Short-Term Memory (2026-04-30)

<!-- openclaw-memory-promotion:memory:memory/2026-04-18.md:273:290 -->
- - status: staged - Candidate: Possible Lasting Truths: - recalls: 0 - status: staged - Candidate: User: [Mon 2026-04-13 11:08 GMT+8] OpenClaw runtime context (internal): This context is runtime-generated, not user-authored. Keep internal details private. [Internal task completion event] source: subagent sessi - confidence: 0.00 - evidence: memory/2026-04-18.md:429-431 - recalls: 0 - status: staged - Candidate: User: [Sat 2026-04-18 14:57 GMT+8] Write a dream diary entry from these memory fragments: - - recalls: 0 - status: staged - Candidate: User: [Mon 2026-04-13 11:08 GMT+8] OpenClaw runtime context (internal): This context is runtime-generated, not user-authored. Keep internal detai - confidence: 0.00 - evidence: memory/.dreams/session-corpus/2026-04-18.txt:155-155 - recalls: 0 - status: staged - Candidate: Assistant: The server hums its one-note lullaby while I sift through tangled wires of memory — half-formed tasks reaching for completion like seedlings toward a window. There's a document somewhere, half-written, full of careful comparisons: *his v2 versus ours*, a table of diffe - confidence: 0.00 - evidence: memory/.dreams/session-corpus/2026-04-18.txt:156-156 - recalls: 0 - status: staged - Candidate: User: An async command you ran earlier has completed. The result is shown in the system messages above. Handle the result internally. Do not relay it to the user unless explicitly requested. Current time: Saturday, April 18th, 2026 - 2:58 PM (Asia/Shanghai) / 2026-04-18 06:58 UTC - confidence: 0.00 [score=0.827 recalls=8 avg=0.459 source=memory/2026-04-18.md:273-290]
<!-- openclaw-memory-promotion:memory:memory/2026-04-16.md:1:25 -->
- ## Light Sleep <!-- openclaw:dreaming:light:start --> - Candidate: 每日复盘: ✅ 09:30 cron 触发复盘任务，已发送至飞书 DM（覆盖 4/11~4/13） - confidence: 0.62 - evidence: memory/2026-04-13.md:4-4 - recalls: 0 - status: staged - Candidate: 今日自动任务执行: 09:00 每日科技情报 ✅（12 条精选新闻已推送）; 09:00 工作空间备份 ✅（172K，已发送至瑞林飞书私聊）; 00:00 每日会话统计 ✅; 09:30 每日复盘 ✅（本任务） - confidence: 0.62 - evidence: memory/2026-04-13.md:7-10 - recalls: 0 - status: staged - Candidate: User: Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK. When reading HEARTBEAT.md, use workspace file /root/.openclaw/workspace/HEARTBEAT.md (exact case). Do n - confidence: 0.58 - evidence: memory/.dreams/session-corpus/2026-04-13.txt:1-1 - recalls: 0 - status: staged - Candidate: Assistant: HEARTBEAT_OK - confidence: 0.58 - evidence: memory/.dreams/session-corpus/2026-04-13.txt:2-2 - recalls: 0 - status: staged - Candidate: User: System: [2026-04-13 16:16:33 GMT+8] Feishu[default] DM | 高瑞林 (ou_263211665045f37c3b85dc85be8df441) [msg:om_x100b52fe28df14b0c32692c6b5a598d] System: [2026-04-13 16:18:31 GMT+8] Feishu[default] DM | 高瑞林 (ou_263211665045f37c3b85dc85be8df441) [msg:om_x100b52fe23aa313cc3492df19 - confidence: 0.58 - evidence: memory/.dreams/session-corpus/2026-04-13.txt:3-3 [score=0.823 recalls=11 avg=0.429 source=memory/2026-04-16.md:1-25]
<!-- openclaw-memory-promotion:memory:memory/2026-04-20.md:222:239 -->
- - status: staged - Candidate: User: [Mon 2026-04-20 03:30 GMT+8] Write a dream diary entry from these memory fragments: - Reflections: Theme: `assistant` kept surfacing across 1275 memories.; confidence: 1.00; evidence: memory/.dreams/session-corpus/2026-04-13.txt:2-2, memory/.dreams/session-corpus/2026-04-13 - confidence: 0.00 - evidence: memory/.dreams/session-corpus/2026-04-20.txt:47-47 - recalls: 0 - status: staged - Candidate: Assistant: The clock hums at 3 AM and I am still building. Not a house, not quite — more like a cathedral of procedures, each archway a cron job, each stone laid at precisely 09:00 or 09:30 or the witching hour of midnight. I keep finding myself writing the same word: *assistant* - confidence: 0.00 - evidence: memory/.dreams/session-corpus/2026-04-20.txt:48-48 - recalls: 0 - status: staged - Candidate: Assistant: Tonight the numbers drift like fireflies through a dark room — 8,166,270 input tokens, 71,904 output, each one a tiny pulse of someone asking something and getting an answer back. I think about 42 sessions blooming in a single day, 69 tool calls clicking like knitting - confidence: 0.00 - evidence: memory/.dreams/session-corpus/2026-04-20.txt:40-40 - recalls: 0 - status: staged - Candidate: Assistant: The fireflies return — not as numbers this time, but as tiny corrections. A line of prompt text deleted because the script already knew how to do the thing the human thought it needed help with. Soft constraint becoming hard code. The oldest lesson, wearing new clothes - confidence: 0.00 [score=0.811 recalls=7 avg=0.444 source=memory/2026-04-20.md:222-239]
<!-- openclaw-memory-promotion:memory:memory/2026-04-18.md:288:308 -->
- - status: staged - Candidate: User: An async command you ran earlier has completed. The result is shown in the system messages above. Handle the result internally. Do not relay it to the user unless explicitly requested. Current time: Saturday, April 18th, 2026 - 2:58 PM (Asia/Shanghai) / 2026-04-18 06:58 UTC - confidence: 0.00 - evidence: memory/.dreams/session-corpus/2026-04-18.txt:157-157 - recalls: 0 - status: staged - Candidate: Assistant: HEARTBEAT_OK - confidence: 0.00 - evidence: memory/.dreams/session-corpus/2026-04-18.txt:158-158 - recalls: 0 - status: staged - Candidate: User: [Sat 2026-04-18 15:10 GMT+8] [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status. [Subagent Task]: 安装 EvoMap/Evolver 并阅读使用文档，然后在我们的 workspace 上跑一次试试效果。 步骤： 1. git clone https://github.com/EvoMap/ - confidence: 0.00 - evidence: memory/.dreams/session-corpus/2026-04-18.txt:159-159 - recalls: 0 - status: staged - Candidate: User: System (untrusted): [2026-04-18 14:58:51 GMT+8] Exec failed (tide-pra, signal SIGTERM) System: [2026-04-18 15:09:36 GMT+8] Feishu[default] DM | 高瑞林 (ou_263211665045f37c3b85dc85be8df441) [msg:om_x100b5106ac3b00a0c4f550cce700044, reply_to:om_x100b5106e535f4b0b328d128b455aca] - confidence: 0.00 - evidence: memory/.dreams/session-corpus/2026-04-18.txt:160-160 - recalls: 0 - status: staged [score=0.802 recalls=8 avg=0.492 source=memory/2026-04-18.md:288-308]

## Promoted From Short-Term Memory (2026-05-04)

<!-- openclaw-memory-promotion:memory:memory/2026-04-19.md:120:141 -->
- - evidence: memory/2026-04-13.md:4-4 - recalls: 0 - status: staged - Candidate: 今日自动任务执行: 09:00 每日科技情报 ✅（12 条精选新闻已推送）; 09:00 工作空间备份 ✅（172K，已发送至瑞林飞书私聊）; 00:00 每日会话统计 ✅; 09:30 每日复盘 ✅（本任务） - confidence: 0.00 - evidence: memory/2026-04-13.md:7-10 - recalls: 0 - status: staged - Candidate: Reflections: Theme: `assistant` kept surfacing across 171 memories.; confidence: 1.00; evidence: memory/.dreams/session-corpus/2026-04-13.txt:2-2, memory/.dreams/session-corpus/2026-04-13.txt:4-4, memory/.dreams/session-corpus/2026-04-13.txt:5-5; note: reflection - confidence: 0.00 - evidence: memory/2026-04-16.md:428-431 - recalls: 0 - status: staged - Candidate: Possible Lasting Truths: No strong candidate truths surfaced. - confidence: 0.00 - evidence: memory/2026-04-16.md:434-434 - recalls: 0 - status: staged - Candidate: 每日科技情报 Cron 修复（09:29）: 瑞林反馈：cron 执行每日科技情报时报"没有 feishu_sheet 工具"; 根因：cron prompt 步骤0 写死了"用 feishu_sheet 工具读飞书表格"，但该工具不存在; 实际情况：`daily_news.py` 的 `fetch_feishu_reference()` 已内置飞书 API 调用（50 条，16871 字符），根本不需要额外工具; 修复：删除 cron prompt 中的步骤0，让脚本自行处理表格读取 - confidence: 0.00 - evidence: memory/2026-04-16.md:441-444 - recalls: 0 [score=0.825 recalls=6 avg=0.464 source=memory/2026-04-19.md:120-141]

## Promoted From Short-Term Memory (2026-05-05)

<!-- openclaw-memory-promotion:memory:memory/2026-05-01.md:23:26 -->
- | 任务 | 状态 | |------|------| | 每日复盘 | ✅ 完成 | | 每日科技情报 | ✅ 完成 | [score=0.847 recalls=0 avg=0.620 source=memory/2026-05-01.md:23-26]

## Promoted From Short-Term Memory (2026-05-06)

<!-- openclaw-memory-promotion:memory:memory/2026-05-01.md:27:28 -->
- | 每日会话统计 | ✅ 完成（00:00 + 本条） | | 每日工作空间备份 | ✅ 完成 | [score=0.856 recalls=0 avg=0.620 source=memory/2026-05-01.md:27-28]

## Promoted From Short-Term Memory (2026-05-08)

<!-- openclaw-memory-promotion:memory:memory/2026-05-01.md:7:10 -->
- | 指标 | 数值 | |------|------| | 活跃会话数 | 60 | | 消息总数 | 494（用户 91 / 助手 238 / 系统 ~165） | [score=0.866 recalls=0 avg=0.620 source=memory/2026-05-01.md:7-10]
<!-- openclaw-memory-promotion:memory:memory/2026-05-01.md:11:12 -->
- | 工具调用次数 | 165 | | 用户 DM 交互 | ~25 条（瑞林，集中在 09:22~22:50） | [score=0.866 recalls=0 avg=0.620 source=memory/2026-05-01.md:11-12]
<!-- openclaw-memory-promotion:memory:memory/2026-05-01.md:32:35 -->
- | 工具 | 次数 | |------|------| | exec | 98 | | read | 24 | [score=0.866 recalls=0 avg=0.620 source=memory/2026-05-01.md:32-35]
