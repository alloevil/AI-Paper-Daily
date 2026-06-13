# 第 3 篇：消息篇 — Telegram / Discord / Voice Mode

> 把 Hermes Agent 接入 Telegram、Discord 等即时通讯平台，并启用语音交互。

**前置要求**：已完成 [入门篇](01-入门篇-从安装到第一次对话.md) 的安装和基本配置
**预计时间**：15–30 分钟（按配置的平台数量而定）
**官方文档**：[Messaging Gateway](https://hermes-agent.nousresearch.com/docs/user-guide/messaging) · [Telegram](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram) · [Discord](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord) · [Voice Mode](https://hermes-agent.nousresearch.com/docs/user-guide/features/voice-mode) · [Daily Briefing Bot](https://hermes-agent.nousresearch.com/docs/guides/daily-briefing-bot)

## 你将学到

- 理解 Messaging Gateway 的架构：一个进程连接所有平台
- 配置 Telegram Bot（BotFather → Privacy Mode → 群聊触发）
- 配置 Discord Bot（Developer Portal → Gateway Intents → 权限）
- 启用 Voice Mode：CLI 语音交互、消息平台语音回复、Discord Voice Channel
- 设置 Gateway 安全策略（Allowlist、DM Pairing、Exec Approval）
- 实战搭建 Daily Briefing Bot（Cron + Web Search + 消息投递）

---

## 1. 为什么需要 Messaging Gateway

传统方式下，每个即时通讯平台都需要单独部署一个 bot、维护一套 session 逻辑。Hermes Agent 的 Messaging Gateway 解决了这个问题：

- **一个 Gateway 进程连接所有平台**：Telegram、Discord、Slack、WhatsApp、Signal、飞书、企业微信、微信、QQ 等 20+ 平台，统一由一个后台进程管理
- **统一的 session、memory、tool 体系**：无论从哪个平台发消息，agent 都使用同一套会话管理、记忆系统和工具链
- **Cron 调度器内置**：Gateway 每 60 秒检查一次定时任务，结果自动投递到你指定的平台

启动方式很简单：

```bash
# 本地终端
hermes gateway          # 前台运行
hermes gateway setup    # 交互式配置向导
hermes gateway install  # 安装为系统服务（Linux systemd / macOS launchd）
```

---

## 2. Gateway 架构

### 平台能力对比

不同平台支持的功能不同，下表是官方对比（来源：[Platform Comparison](https://hermes-agent.nousresearch.com/docs/user-guide/messaging#platform-comparison)）：

| 平台 | Voice | Images | Files | Threads | Reactions | Typing | Streaming |
|------|:-----:|:------:|:-----:|:-------:|:---------:|:------:|:---------:|
| Telegram | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| Discord | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Slack | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WhatsApp | — | ✅ | ✅ | — | — | ✅ | ✅ |
| Signal | — | ✅ | ✅ | — | — | ✅ | ✅ |
| Matrix | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 飞书/Lark | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 企业微信 | ✅ | ✅ | ✅ | — | — | ✅ | ✅ |
| 微信 | ✅ | ✅ | ✅ | — | — | ✅ | ✅ |
| QQ | ✅ | ✅ | ✅ | — | — | — | — |

> Voice = TTS 语音回复 + 语音消息转录；Images = 发送/接收图片；Files = 文件附件；Threads = 线程对话

### Gateway 命令速查

| 命令 | 说明 |
|------|------|
| `hermes gateway` | 前台运行 Gateway |
| `hermes gateway setup` | 交互式配置所有平台 |
| `hermes gateway install` | 安装为用户服务（Linux/macOS） |
| `sudo hermes gateway install --system` | 安装为系统级服务（Linux only） |
| `hermes gateway start` | 启动服务 |
| `hermes gateway stop` | 停止服务 |
| `hermes gateway status` | 查看服务状态 |

### 服务管理

**Linux (systemd)**：

```bash
# 本地终端
hermes gateway install                    # 用户级服务
sudo hermes gateway install --system      # 系统级服务（开机自启）
journalctl --user -u hermes-gateway -f    # 查看日志
sudo loginctl enable-linger $USER         # 退出登录后保持运行
```

**macOS (launchd)**：

```bash
# 本地终端
hermes gateway install
tail -f ~/.hermes/logs/gateway.log
```

> 安装后如果 PATH 变了（比如通过 nvm 装了新 Node.js），需要重新运行 `hermes gateway install` 更新 plist。

---

## 3. 平台配置

### 3.1 Telegram

#### 创建 Bot

1. 在 Telegram 中打开 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot`，输入显示名称和 username（必须以 `bot` 结尾）
3. BotFather 返回 API Token，格式如 `123456789:ABCdefGHIjklMNOpqrSTUvwxYZ`

> ⚠️ Token 是 bot 的唯一凭证。泄露后立即在 BotFather 中用 `/revoke` 撤销。

#### Privacy Mode（群聊最常见的坑）

Telegram bot 默认开启 Privacy Mode，此时 bot 只能看到：

- `/` 开头的命令消息
- 直接回复 bot 的消息
- 服务消息（成员加入/退出等）
- bot 是管理员的频道消息

**关闭方法**：BotFather → `/mybots` → 选择 bot → Bot Settings → Group Privacy → Turn off

> ⚠️ 修改隐私设置后必须**移除并重新添加** bot 到群组，Telegram 会缓存 bot 入群时的隐私状态。
>
> 替代方案：将 bot 提升为群组管理员，admin bot 无视隐私设置始终能接收所有消息。

#### 配置 + 启动

```bash
# 本地终端 — 交互式向导（推荐）
hermes gateway setup
```

或手动编辑 `~/.hermes/.env`：

```bash
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
TELEGRAM_ALLOWED_USERS=123456789  # 逗号分隔多个用户
```

> 获取 User ID 的方法：给 [@userinfobot](https://t.me/userinfobot) 发消息即可。

#### Polling vs Webhook

| | Polling（默认） | Webhook |
|--|----------------|---------|
| 方向 | Gateway → Telegram（出站） | Telegram → Gateway（入站） |
| 适用场景 | 本地部署、常驻服务器 | 云平台（Fly.io、Railway） |
| 配置 | 无需额外配置 | 设置 `TELEGRAM_WEBHOOK_URL` |

Webhook 配置（`~/.hermes/.env`）：

```bash
TELEGRAM_WEBHOOK_URL=https://my-app.fly.dev/telegram
TELEGRAM_WEBHOOK_PORT=8443          # 可选，默认 8443
TELEGRAM_WEBHOOK_SECRET=mysecret    # 可选，生产环境建议开启
```

> Webhook 需要有效的 TLS 证书。自签名证书会被拒绝，使用反向代理（nginx/Caddy）或平台自带的 TLS termination。

#### 群聊触发

在 `~/.hermes/config.yaml` 中配置：

```yaml
telegram:
  require_mention: true        # 群聊需要 @bot 或回复 bot 消息才响应
  mention_patterns:            # 自定义唤醒词（Python 正则，大小写不敏感）
    - "^\\s*chompy\\b"
  ignored_threads:             # 忽略特定 forum topic
    - 31
    - "42"
```

开启 `require_mention` 后，bot 在群聊中只响应以下消息：

- `/` 开头的命令
- 回复 bot 的消息
- @botusername 的提及
- 匹配 `mention_patterns` 的消息

#### Private Chat Topics（Bot API 9.4）

Telegram Bot API 9.4（2026 年 2 月）引入了 Private Chat Topics——bot 可以在 1 对 1 私聊中创建 forum-style 的主题线程，不需要 supergroup。

用途：在同一私聊中按项目分隔上下文：

```yaml
platforms:
  telegram:
    extra:
      dm_topics:
        - chat_id: 123456789      # 你的 Telegram User ID
          topics:
            - name: General
              icon_color: 7322096
            - name: Website
              icon_color: 9367192
            - name: Research
              icon_color: 16766590
              skill: arxiv        # 自动加载 arxiv skill
```

每个 topic 有独立的 session key：`agent:main:telegram:dm:{chat_id}:{thread_id}`，互不干扰。

> Skill 绑定：topic 设置 `skill` 字段后，新 session 启动时自动加载该 skill，等同于手动输入 `/skill-name`。

#### Group Forum Topic Skill Binding

Supergroup 启用 Topics 模式后，每个 topic 已有独立 session。你还可以为特定 topic 自动加载 skill：

```yaml
platforms:
  telegram:
    extra:
      group_topics:
        - chat_id: -1001234567890
          topics:
            - name: Engineering
              thread_id: 5
              skill: software-development
            - name: Research
              thread_id: 12
              skill: arxiv
```

> 获取 thread_id：在 Telegram Web/Desktop 打开 topic，URL 中最后一个数字即为 thread_id（如 `https://t.me/c/1234567890/5` → `5`）。

#### Message Reactions

Bot 可以对消息添加 emoji 反馈：

- 👀 开始处理
- ✅ 回复成功
- ❌ 处理出错

```yaml
# ~/.hermes/config.yaml
telegram:
  reactions: true
```

或 `TELEGRAM_REACTIONS=true`。与 Discord 不同，Telegram 的 Bot API 会**替换**所有 bot reactions（原子操作），不会同时显示 👀 和 ✅。

#### Per-Channel Prompts

为特定群组或 topic 注入临时 system prompt（不写入历史，修改立即生效）：

```yaml
telegram:
  channel_prompts:
    "-1001234567890": |
      You are a research assistant. Focus on academic sources, citations, and concise synthesis.
    "42": |
      This topic is for creative writing feedback. Be warm and constructive.
```

#### 代理支持

如果 Telegram API 被封锁，配置代理：

```yaml
# ~/.hermes/config.yaml
telegram:
  proxy_url: "socks5://127.0.0.1:1080"
```

或环境变量 `TELEGRAM_PROXY=socks5://127.0.0.1:1080`。支持 `http://`、`https://`、`socks5://`。

---

### 3.2 Discord

#### 创建 Application + Bot

1. 打开 [Discord Developer Portal](https://discord.com/developers/applications)，登录 Discord 账号
2. 点击 **New Application**，输入名称，点击 Create
3. 左侧栏点击 **Bot**，Discord 自动创建 bot 用户

#### Gateway Intents（#1 常见错误来源）

在 Bot 页面找到 **Privileged Gateway Intents**，开启以下两项：

| Intent | 说明 | 是否必须 |
|--------|------|:--------:|
| Server Members Intent | 访问成员列表、解析用户名 | ✅ 必须 |
| Message Content Intent | 读取消息文本内容 | ✅ 必须 |
| Presence Intent | 查看用户在线状态 | 可选 |

> **Message Content Intent 未开启是 Discord bot 不响应消息的第一大原因**。bot 会在线但收不到消息内容。

#### 邀请链接 + 权限

在 Developer Portal → **Installation** 页面生成邀请链接，需要的权限：

- View Channels（查看频道）
- Send Messages（发送消息）
- Embed Links（富文本格式）
- Attach Files（发送文件）
- Read Message History（维护对话上下文）

推荐权限整数：`274878286912`。手动拼接链接：

```
https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&scope=bot+applications.commands&permissions=274878286912
```

#### 配置 + 启动

```bash
# 本地终端 — 交互式向导
hermes gateway setup
```

手动配置 `~/.hermes/.env`：

```bash
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_ALLOWED_USERS=284102345871466496
```

#### DM vs Server Channel 行为差异

| 场景 | 行为 |
|------|------|
| 私聊 (DM) | bot 响应每条消息，无需 @mention |
| Server 频道 | 默认需要 @mention 才响应 |
| Free-Response 频道 | 设置 `DISCORD_FREE_RESPONSE_CHANNELS` 后无需 @mention |
| 线程 | 继承父频道的 mention 规则，session 独立 |

#### Auto-Thread

默认开启（`DISCORD_AUTO_THREAD=true`）。每次 @mention 自动创建新线程，保持主频道整洁。线程中后续消息无需再 @mention。

关闭特定频道的自动线程：

```bash
DISCORD_NO_THREAD_CHANNELS=1234567890,9876543210
```

#### Session 隔离

默认 `group_sessions_per_user: true`——同一频道中不同用户各有独立 session，不会互相干扰。

> 关闭后（`false`）整个频道共享一个 session，适合协作场景但要注意：一个人的长任务会膨胀所有人的上下文。

#### Free-Response Channels

在 `~/.hermes/.env` 中设置：

```bash
DISCORD_FREE_RESPONSE_CHANNELS=1234567890,9876543210
```

或全局关闭 mention 要求：

```bash
DISCORD_REQUIRE_MENTION=false
```

#### Discord Reactions

与 Telegram 类似，bot 对消息添加 emoji 反馈：

- 👀 开始处理 → ✅ 成功 / ❌ 失败

```bash
DISCORD_REACTIONS=true   # 默认开启
```

#### Per-Channel Prompts

```yaml
# ~/.hermes/config.yaml
discord:
  channel_prompts:
    "1234567890": |
      This channel is for research tasks. Prefer deep comparisons, citations, and concise synthesis.
```

#### 常见问题

| 问题 | 原因 | 修复 |
|------|------|------|
| bot 在线但不响应 | Message Content Intent 未开启 | Developer Portal → Bot → 开启 Message Content Intent |
| "Disallowed Intents" 错误 | Developer Portal 中未启用对应 Intent | 开启全部三个 Privileged Gateway Intents |
| bot 看不到特定频道 | bot 角色缺少频道权限 | 频道设置 → Permissions → 添加 View Channel + Read History |
| bot 不响应你的消息 | User ID 不在 ALLOWED_USERS | 添加 User ID 到 `DISCORD_ALLOWED_USERS` |

---

### 3.3 其他平台

| 平台 | 一句话说明 | 官方文档 |
|------|-----------|---------|
| Slack | 支持 DM、频道、Thread，需创建 Slack App | [Slack Setup](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/slack) |
| WhatsApp | 通过 WhatsApp Web 桥接，需扫描二维码配对 | [WhatsApp Setup](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp) |
| Signal | 通过 signal-cli 桥接，支持 DM 和群组 | [Signal Setup](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/signal) |
| Matrix | 支持房间、Thread、Reactions | [Matrix Setup](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/matrix) |
| 飞书/Lark | 支持消息、文件、Thread | [Feishu Setup](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/feishu) |
| 企业微信 | 支持消息和文件 | [WeCom Setup](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/wecom) |
| 微信 | 支持消息和文件 | [Weixin Setup](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/weixin) |
| QQ | 支持语音、图片、文件 | [QQBot Setup](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/qqbot) |
| Email | 支持邮件收发和附件 | [Email Setup](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/email) |
| Mattermost | 支持消息、Thread、Reactions | [Mattermost Setup](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/mattermost) |
| DingTalk | 支持消息 | [DingTalk Setup](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/dingtalk) |
| Home Assistant | 支持设备控制（ha_list_entities 等） | [HA Setup](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/homeassistant) |
| BlueBubbles (iMessage) | 通过 BlueBubbles 桥接 macOS iMessage | [BlueBubbles](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/bluebubbles) |

---

## 4. Voice Mode

### 功能概览

| 功能 | 平台 | 说明 |
|------|------|------|
| Interactive Voice | CLI | Ctrl+B 录音，自动静音检测，流式 TTS 回复 |
| Auto Voice Reply | Telegram, Discord | agent 同时发送语音回复和文本回复 |
| Voice Channel | Discord | bot 加入语音频道，实时听→转录→回复 |

### 依赖安装

```bash
# 本地终端
pip install "hermes-agent[voice]"       # CLI 语音模式
pip install "hermes-agent[messaging]"   # Telegram + Discord（含 voice channel 支持）
pip install "hermes-agent[tts-premium]" # ElevenLabs TTS
pip install "hermes-agent[all]"         # 一次性全装

# 系统依赖
# macOS
brew install portaudio ffmpeg opus

# Ubuntu/Debian
sudo apt install portaudio19-dev ffmpeg libopus0
```

### CLI 语音模式

启动 CLI 后启用语音：

```
hermes
/voice on
```

交互流程：

1. 按 `Ctrl+B` → 播放提示音（880Hz），开始录音
2. 说话 → 实时显示音量条：`● [▁▂▃▅▇▇▅▂] ❯`
3. 静音 3 秒后自动停止录音 → 双提示音（660Hz）
4. 音频通过 Whisper STT 转录 → 发送给 agent
5. 如果开启 TTS，agent 逐句朗读回复（Streaming TTS）
6. 录音自动重启——无需再按键

> 静音检测算法：先确认有语音（RMS > 200 持续 0.3s），然后检测 3.0s 连续静音触发停止。15s 无语音自动停止。

### Gateway 语音回复（Telegram + Discord）

在 Telegram 或 Discord 中使用 `/voice` 命令：

| 命令 | 效果 |
|------|------|
| `/voice on` | 只在你发语音消息时回复语音 |
| `/voice tts` | 所有消息都回复语音 |
| `/voice off` | 关闭语音回复 |

平台投递格式：

- **Telegram**：Voice bubble（Opus/OGG），内联播放。Edge TTS 输出 MP3 需要 ffmpeg 转换为 Opus
- **Discord**：Native voice bubble（Opus/OGG），与用户语音消息外观一致

### Discord Voice Channel

最沉浸的语音交互方式：bot 加入语音频道，实时听用户说话，转录后回复。

#### 权限配置

在 Discord Developer Portal 中添加 Connect + Speak 权限，更新后的权限整数：`274881432640`。重新邀请 bot（不会丢失配置）。

还需要开启全部三个 Privileged Gateway Intents（Server Members Intent 用于识别谁在说话）。

#### 使用方式

```
/voice join    # bot 加入你所在的语音频道
/voice leave   # bot 离开语音频道
```

工作流程：

1. bot 加入 VC，监听每个用户的音频流
2. 检测静音（0.5s 语音 + 1.5s 静音触发处理）
3. Whisper STT 转录
4. 通过 agent pipeline 处理（session、tools、memory）
5. TTS 语音回复 + 文本频道同时显示转录内容
6. 播放 TTS 时自动暂停收听，防止回声

### STT Provider 对比

| Provider | 模型 | 速度 | 质量 | 费用 | API Key |
|----------|------|------|------|------|---------|
| Local | base | 快（取决于 CPU/GPU） | Good | 免费 | 不需要 |
| Local | small | 中等 | Better | 免费 | 不需要 |
| Local | large-v3 | 慢 | Best | 免费 | 不需要 |
| Groq | whisper-large-v3-turbo | 极快（~0.5s） | Good | 免费层 | 需要 |
| Groq | whisper-large-v3 | 快（~1s） | Better | 免费层 | 需要 |
| OpenAI | whisper-1 | 快（~1s） | Good | 付费 | 需要 |
| OpenAI | gpt-4o-transcribe | 中等（~2s） | Best | 付费 | 需要 |

自动降级顺序：`local → groq → openai`

### TTS Provider 对比

| Provider | 质量 | 费用 | 延迟 | API Key |
|----------|------|------|------|---------|
| Edge TTS | Good | 免费 | ~1s | 不需要 |
| ElevenLabs | Excellent | 付费 | ~2s | 需要 |
| OpenAI TTS | Good | 付费 | ~1.5s | 需要 |
| NeuTTS | Good | 免费 | 取决于 CPU/GPU | 不需要 |

配置方式（`~/.hermes/config.yaml`）：

```yaml
stt:
  provider: "local"       # local | groq | openai
  local:
    model: "base"         # tiny, base, small, medium, large-v3

tts:
  provider: "edge"        # edge | elevenlabs | openai | neutts
  edge:
    voice: "en-US-AriaNeural"   # 322 voices, 74 languages
```

### Whisper 幻觉过滤

Whisper 有时会在静音或背景噪声中生成虚假文本（如 "Thank you for watching"、"Subscribe" 等）。Hermes Agent 内置了 26 条已知幻觉短语的过滤器（跨多语言），加上正则匹配重复变体，自动过滤掉这些垃圾转录。

---

## 5. Gateway 安全

### Allowlist

默认 Gateway 拒绝所有不在 allowlist 中的用户。必须显式授权：

```bash
# ~/.hermes/.env — 按平台设置
TELEGRAM_ALLOWED_USERS=123456789,987654321
DISCORD_ALLOWED_USERS=284102345871466496
SIGNAL_ALLOWED_USERS=+155****4567
FEISHU_ALLOWED_USERS=ou_xxxxxxxx,ou_yyyyyyyy
MATTERMOST_ALLOWED_USERS=3uo8dkh1p7g1mfk49ear5fzs5c

# 或全局 allowlist
GATEWAY_ALLOWED_USERS=123456789,987654321

# 或允许所有人（不推荐！）
GATEWAY_ALLOW_ALL_USERS=true
```

### DM Pairing

不想手动配置 User ID？开启 DM Pairing——未知用户私聊 bot 时获得一次性配对码：

```bash
# 用户看到: "Pairing code: XKGH5N7P"
# 你在终端批准:
hermes pairing approve telegram XKGH5N7P

# 其他命令
hermes pairing list                           # 查看待批准 + 已批准用户
hermes pairing revoke telegram 123456789      # 撤销权限
```

配对码 1 小时过期、有频率限制、使用加密随机生成。

### Exec Approval

当 agent 尝试执行潜在危险命令（如递归删除）时，会在聊天中请求审批：

```
⚠️ This command is potentially dangerous (recursive delete). Reply "yes" to approve.
```

回复 `yes`/`y` 批准，`no`/`n` 拒绝。

---

## 6. 实战：Daily Briefing Bot

### 解决什么问题

每天早上自动搜索你关心的新闻主题，整理成简洁摘要，推送到 Telegram 或 Discord。你只需要泡咖啡、读 briefing。

### 工作流程

```
8:00 AM → Cron 触发
        → 新 session 启动（无历史上下文）
        → Web Search 搜索最新新闻
        → 总结成 briefing 格式
        → 投递到 Telegram/Discord
```

### 手动测试

先确认 workflow 能跑通。在 CLI 中测试：

```
hermes
```

输入：

```
Search for the latest news about AI agents and open source LLMs.
Summarize the top 3 stories in a concise briefing format with links.
```

输出类似：

```
☀️ Your AI Briefing — April 16, 2026

1. Qwen 3 Released with 235B Parameters
   Alibaba's latest open-weight model matches GPT-4.5 on several
   benchmarks while remaining fully open source.
   → https://qwenlm.github.io/blog/qwen3/

2. LangChain Launches Agent Protocol Standard
   A new open standard for agent-to-agent communication gains
   adoption from 15 major frameworks.
   → https://blog.langchain.dev/agent-protocol/

---
3 stories • Sources searched: 8 • Generated by Hermes Agent
```

### 创建 Cron Job

**方式 A：自然语言（在聊天中）**

```
Every morning at 8am, search the web for the latest news about AI agents
and open source LLMs. Summarize the top 3 stories in a concise briefing
with links. Deliver to telegram.
```

Hermes 会自动创建 cron job。

**方式 B：CLI Slash Command**

```
/cron add "0 8 * * *" "Search the web for the latest news about AI agents and open source LLMs. Find at least 5 recent articles from the past 24 hours. Summarize the top 3 most important stories in a concise daily briefing format. For each story include: a clear headline, a 2-sentence summary, and the source URL. Use a friendly, professional tone. Format with emoji bullet points."
```

### Prompt 自包含原则

> **黄金法则**：Cron job 在全新 session 中运行——没有之前的对话记忆、没有"之前设置过什么"的上下文。Prompt 必须包含 agent 完成任务所需的全部信息。

❌ 坏 prompt：`Do my usual morning briefing.`

✅ 好 prompt：明确说明搜什么、搜多少、什么格式、什么语调——一个 prompt 搞定一切。

### 多主题 Briefing + Delegation 并行

```bash
/cron add "0 8 * * *" "Create a morning briefing by delegating research to sub-agents:

1. Delegate: Search for the top 2 AI/ML news stories from the past 24 hours with links
2. Delegate: Search for the top 2 cryptocurrency news stories from the past 24 hours with links
3. Delegate: Search for the top 2 space exploration news stories from the past 24 hours with links

Collect all results and combine into a single clean briefing with section headers, emoji formatting, and source links."
```

每个 sub-agent 独立并行搜索，主 agent 最终汇总成一份 briefing。

### 工作日限定 + 早晚双报

```bash
# 工作日早上 8 点
/cron add "0 8 * * 1-5" "Search for the latest AI and tech news..."

# 每天晚上 6 点（晚间回顾）
/cron add "0 18 * * *" "Evening recap: search for AI news from the past 12 hours..."
```

### 管理 Cron Job

```bash
# 在聊天中
/cron list                    # 列出所有定时任务
/cron remove a1b2c3d4         # 删除指定任务

# 在终端
hermes cron list
hermes cron status
```

---

## 7. 横向对比：Hermes vs OpenClaw

| 维度 | Hermes Agent | OpenClaw |
|------|-------------|----------|
| **平台覆盖** | 20+ 平台（Telegram、Discord、Slack、WhatsApp、飞书、微信、QQ 等） | 飞书（核心）、Telegram、Discord 等 |
| **Gateway 进程** | 单一后台进程管理所有平台连接 + Cron 调度 | Gateway daemon 管理平台连接 |
| **语音交互** | CLI 录音 + Telegram/Discord 语音回复 + Discord VC 实时对话 | 暂无内置语音模式 |
| **Cron 集成** | 内置于 Gateway，每 60 秒检查，支持自然语言创建 | `openclaw cron` CLI，支持 delivery 到各平台 |
| **Session 隔离** | `group_sessions_per_user` 全局控制，per-platform reset policy | 按 channel/user 隔离 |
| **安全** | Allowlist + DM Pairing + Exec Approval | Allowlist + sender_id 验证 + 密级检查 |
| **Skill 自动注册** | 安装的 skill 自动注册为 Discord slash command | Skill 通过 AGENTS.md + SKILL.md 加载 |
| **Webhook 支持** | Telegram 原生 Webhook（适合云平台 auto-wake） | 通过平台 API 调用 |

---

## 下一步

- 第 4 篇：[工具与扩展篇 — Tools + Skills + MCP](04-工具与扩展篇-Tools-Skills-MCP.md)（待撰写）
- 第 5 篇：自动化篇 — Cron + Hooks + Batch + Delegation（待撰写）
- 第 6 篇：架构篇 — 底层原理 + RL 训练 + 贡献（待撰写）
- 官方文档：[Messaging Gateway](https://hermes-agent.nousresearch.com/docs/user-guide/messaging) · [Voice Mode](https://hermes-agent.nousresearch.com/docs/user-guide/features/voice-mode) · [Daily Briefing Bot](https://hermes-agent.nousresearch.com/docs/guides/daily-briefing-bot)

---

*本文基于 Hermes Agent 官方文档（2026-04-16 抓取）*
