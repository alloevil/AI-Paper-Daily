export default [
  // ==================== OpenClaw ====================
  {
    project: "openclaw",
    version: "2026.6.1-beta.2",
    date: "2026-06-02",
    tag: "v2026.6.1-beta.2",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.1-beta.2",
    prerelease: true,
    highlights_zh: [
      "Agent 和 CLI 运行时对中断的工具调用、过期会话绑定、压缩交接和媒体投递重试的恢复更加稳定",
      "跨 Telegram、WhatsApp、iMessage、Slack、Discord、Microsoft Teams、Google Chat、Google Meet 和 iOS 实时 Talk 的通道和移动端投递更加可靠",
      "Provider 和插件请求现在对定时器、重试、OAuth/设备码生命周期、媒体下载、本地服务探测和生成内容轮询路径进行了更严格的限制，防止运行挂起",
      "Skills、会话元数据、网关运行时状态、插件元数据、内存监视器和存储写入在热路径上减少了重复工作，同时保持配置、分发和 Linux 文件监视行为稳定",
      "Skills 和插件加载现在更清晰地处理过期的禁用快照和加载器失败，通道轮次避免使用禁用的 SecretRef，运维人员获得更好的恢复指引",
      "Workboard、SecretRef 插件清单、托管 iOS 推送中继和外部 Copilot/Tokenjuice 打包新增更广泛的编排、集成和插件投递能力",
      "Skill Workshop 现在拥有更完整的 Control UI 流程：提案列表、今日操作、修订交接、可搜索文件预览、审查状态、本地化覆盖和可复用会话路由",
      "聊天和 Control UI 启动路径在历史加载期间保持发送活跃、增量流式传输、跳过 Markdown 解析、保持本地草稿、追踪首输出延迟并暴露更平和的编辑器控件",
      "Provider 覆盖和模型元数据新增 MiniMax M3、账户 OAuth 端点、Google/Vertex 目录修复、OpenRouter SQLite 模型缓存、Copilot Claude 1M 能力、Foundry 推理对齐和 OpenAI 响应重放保护",
      "iMessage 监控状态、入站队列和插件安装账本迁移到 SQLite 支持的状态，重启和本地监控恢复时减少重复的文件系统扫描",
      "发布、CI、Docker、E2E、插件安装和诊断流水线现在对日志、响应体、就绪探针、制品检查、状态轮询、子工作流等待、Docker 包清理和回滚快照进行上限限制，失败时报告有界证据而非挂起"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.1-beta.1",
    date: "2026-06-01",
    tag: "v2026.6.1-beta.1",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.1-beta.1",
    prerelease: true,
    highlights_zh: [
      "Agent 和 CLI 运行时对中断的工具调用、过期会话绑定、压缩交接和媒体投递重试的恢复更加稳定",
      "跨 Telegram、WhatsApp、iMessage、Slack、Discord、Microsoft Teams、Google Chat、Google Meet 和 iOS 实时 Talk 的通道和移动端投递更加可靠",
      "Provider 和插件请求现在对定时器、重试、OAuth/设备码生命周期、媒体下载、本地服务探测和生成内容轮询路径进行了更严格的限制",
      "Skills、会话元数据、网关运行时状态、插件元数据和存储写入在热路径上减少了重复工作，同时保持配置和分发行为稳定",
      "Skills 和插件加载现在更清晰地处理过期的禁用快照和加载器失败",
      "Workboard、SecretRef 插件清单、托管 iOS 推送中继和外部 Copilot/Tokenjuice 打包新增更广泛的编排和集成能力",
      "Skill Workshop 新增更完整的 Control UI 流程",
      "聊天和 Control UI 启动路径改进：历史加载期间保持发送活跃、增量流式传输、本地草稿、首输出延迟追踪",
      "Provider 覆盖新增 MiniMax M3、Google/Vertex 目录修复、OpenRouter SQLite 模型缓存等",
      "iMessage 监控状态和插件安装账本迁移到 SQLite 支持的状态",
      "发布和诊断流水线对日志和状态轮询进行上限限制"
    ]
  },
  {
    project: "openclaw",
    version: "2026.5.31-beta.4",
    date: "2026-06-01",
    tag: "v2026.5.31-beta.4",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.5.31-beta.4",
    prerelease: true,
    highlights_zh: [
      "Agent 和 CLI 运行时对中断的工具调用、过期会话绑定、压缩交接和媒体投递重试的恢复更加稳定",
      "跨 Telegram、WhatsApp、iMessage、Slack、Discord、Microsoft Teams、Google Chat、Google Meet 和 iOS 实时 Talk 的通道和移动端投递更加可靠",
      "网关和通道设置新增 Tailscale Serve 服务名绑定、Communication 通知设置、更安全的 `agents add` 和跨 Discord/Telegram/Slack/Matrix 等的更可靠进度草稿",
      "Provider 和插件请求对定时器和重试路径进行更严格的限制",
      "热路径上减少重复工作",
      "Skills 和插件加载改进过期快照处理",
      "Workboard 和外部插件打包新增编排能力",
      "Skill Workshop 新增完整 Control UI 流程",
      "聊天和 Control UI 改进：增量流式传输和更平和的编辑器控件",
      "Provider 覆盖新增 MiniMax M3 等模型支持",
      "iMessage 监控迁移到 SQLite",
      "发布和诊断流水线改进失败证据报告"
    ]
  },
  {
    project: "openclaw",
    version: "2026.5.31-beta.3",
    date: "2026-05-31",
    tag: "v2026.5.31-beta.3",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.5.31-beta.3",
    prerelease: true,
    highlights_zh: [
      "Agent 和 CLI 运行时对中断的工具调用和过期会话绑定的恢复更加稳定",
      "跨多个通道的移动端投递更加可靠",
      "网关设置新增 Tailscale Serve 服务名绑定和更安全的 agents add",
      "Provider 和插件请求对定时器和重试路径进行更严格的限制",
      "热路径上减少重复工作",
      "Skills 和插件加载改进过期快照处理",
      "Workboard 和外部插件打包新增编排能力",
      "发布和诊断流水线改进失败证据报告"
    ]
  },
  {
    project: "openclaw",
    version: "2026.5.31-beta.2",
    date: "2026-05-31",
    tag: "v2026.5.31-beta.2",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.5.31-beta.2",
    prerelease: true,
    highlights_zh: [
      "Agent 和 CLI 运行时对中断的工具调用和过期会话绑定的恢复更加稳定",
      "跨多个通道的移动端投递更加可靠",
      "Provider 和插件请求对定时器和重试路径进行更严格的限制",
      "热路径上减少重复工作",
      "Workboard 和外部插件打包新增编排能力",
      "发布和诊断流水线改进失败证据报告"
    ]
  },
  {
    project: "openclaw",
    version: "2026.5.31-beta.1",
    date: "2026-05-31",
    tag: "v2026.5.31-beta.1",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.5.31-beta.1",
    prerelease: true,
    highlights_zh: [
      "Agent 和 CLI 运行时对中断的工具调用和过期会话绑定的恢复更加稳定",
      "跨多个通道的移动端投递更加可靠",
      "Provider 和插件请求对定时器和重试路径进行更严格的限制",
      "热路径上减少重复工作",
      "Workboard 和外部插件打包新增编排能力",
      "发布和诊断流水线改进失败证据报告"
    ]
  },
  {
    project: "openclaw",
    version: "2026.5.30-beta.1",
    date: "2026-05-31",
    tag: "v2026.5.30-beta.1",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.5.30-beta.1",
    prerelease: true,
    highlights_zh: [
      "Agent 和 CLI 运行时对中断的工具调用和过期会话绑定的恢复更加稳定",
      "跨多个通道的移动端投递更加可靠",
      "Provider 和插件请求对定时器和重试路径进行更严格的限制",
      "热路径上减少重复工作",
      "Workboard 和外部插件打包新增编排能力",
      "发布和诊断流水线改进失败证据报告"
    ]
  },
  {
    project: "openclaw",
    version: "2026.5.28",
    date: "2026-05-30",
    tag: "v2026.5.28",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.5.28",
    prerelease: false,
    highlights_zh: [
      "Agent 和 Codex 运行时恢复更稳定：子代理保持 cwd/workspace 分离、hook 上下文保持 prompt 本地、会话锁在超时中止时释放，同时活跃的 OpenClaw 锁在清理中存活",
      "通道投递和会话身份在出站插件 hook、Matrix 房间 ID、iMessage 反应/审批、Slack 最终回复、Discord 恢复工具警告、运行时配置消息路由等方面更加安全",
      "移动端和聊天界面大幅刷新：iOS Pro UI、托管推送中继默认值、实时 Talk 标签页播放、网关聊天传输、引导流程、Talk 权限、WebChat 重连投递和会话选择器行为",
      "浏览器、通道和自动化输入更严格：Browser 工具超时、视口/标签索引、网关端口、cron 重试处理、Discord 组件 ID、schema 数组引用、Telegram 回调分页等",
      "Provider、媒体和文档覆盖扩展：新增 Claude Opus 4.8、Fal Krea 图片 schema、NVIDIA 精选模型、MiniMax 流式音乐响应、加密 PDF 提取、语音模型目录等",
      "CLI、认证、doctor 和 provider 路径失败更快、恢复更清晰：格式错误的数字/版本选项被拒绝、工作空间 dotenv provider 凭据被忽略、OAuth/token 生命周期和服务探测上限",
      "插件和网关热路径减少重复工作：安装记录、配置 JSON 解析、工具搜索目录、会话存储、清单模型行等的缓存正确性得到保留",
      "发布、QA 和 E2E 验证现在限制更多日志、制品、测试工具和跨 OS 等待，失败流水线产生证据而非挂起或假绿"
    ]
  },
  {
    project: "openclaw",
    version: "2026.5.28-beta.4",
    date: "2026-05-29",
    tag: "v2026.5.28-beta.4",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.5.28-beta.4",
    prerelease: true,
    highlights_zh: [
      "Agent 和 Codex 运行时恢复更稳定：子代理保持 cwd/workspace 分离、hook 上下文保持 prompt 本地、会话锁在超时中止时释放、避免过期重启续接",
      "通道投递和会话身份更加安全：出站插件 hook、Matrix 房间 ID、iMessage 反应/审批、Slack 最终回复、Discord 恢复工具警告、WhatsApp 配置文件认证等",
      "移动端和聊天界面大幅刷新：iOS Pro UI、托管推送中继、实时 Talk 标签页播放、网关聊天传输、WebChat 重连投递等",
      "浏览器和自动化输入更严格：Browser 工具超时、视口/标签索引、网关端口、cron 重试处理等",
      "Provider 和媒体覆盖扩展：Claude Opus 4.8、Fal Krea 图片、NVIDIA 模型、MiniMax 流式音乐、加密 PDF 提取等",
      "CLI 和认证路径失败更快、恢复更清晰",
      "插件和网关热路径减少重复工作",
      "发布和 E2E 验证改进失败证据报告"
    ]
  },
  {
    project: "openclaw",
    version: "2026.5.28-beta.3",
    date: "2026-05-29",
    tag: "v2026.5.28-beta.3",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.5.28-beta.3",
    prerelease: true,
    highlights_zh: [
      "Agent 和 Codex 运行时恢复更稳定",
      "通道投递和会话身份更加安全",
      "移动端和聊天界面刷新：iOS Pro UI、网关聊天传输、引导流程、Talk 权限、WebChat 重连投递等",
      "浏览器和自动化输入更严格",
      "Provider 和媒体覆盖扩展：Claude Opus 4.8、NVIDIA 模型、MiniMax 流式音乐等",
      "CLI 和认证路径改进",
      "插件和网关热路径减少重复工作",
      "发布和 E2E 验证改进"
    ]
  },

  // ==================== Hermes Agent ====================
  // hermes-agent/hermes-agent 仓库不存在（GitHub API 返回 404），跳过
];
