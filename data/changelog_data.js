export default [
  // ==================== OpenClaw ====================
  {
    project: "openclaw",
    version: "2026.6.10-beta.1",
    date: "2026-06-21",
    tag: "v2026.6.10-beta.1",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.10-beta.1",
    prerelease: true,
    highlights_zh: [
      "Agent 轮次和会话状态更可靠：保留待完成的子代理完成公告、保持聊天历史转录非空、维护媒体索引对齐、重启休眠的 follow-up drain、一致地解析压缩模型别名",
      "Codex 和审批流程增强：Codex app-server SecretRef、线程上下文、有界轮次文本、路由审批上下文和类型化 SDK 审批/会话助手协同工作更可预测",
      "通道投递更丰富：Telegram/Discord/Slack 保留更丰富的进度/推理/线程输出、处理结构化发送错误、支持 Slack shortcuts、更可靠地记录规范发送线程",
      "发布和网络边界更安全：SSH 隧道预检限定为环回范围、移除设备配对节点、doctor 暴露易失 SQLite 状态、修复遗留 Codex 路由而非静默保留过期状态",
      "CLI 和状态工作流更实用：支持从聊天重命名会话、显式压缩会话、显示会话时长、保留命令进度详情、dry-run 预览消息发送/投票",
      "移动端和桌面客户端更强：Android 设置按意图分组、iOS 通知状态更干净、Watch 应用使用 Xcode 27 兼容目标布局、macOS 文件输入通过原生面板打开",
      "插件和技能覆盖更广：Zalo 作为外部通道入口可用、Trello 技能声明 curl 依赖、过期托管技能链接重定向、工具发现不再清除活跃 Provider"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.9",
    date: "2026-06-21",
    tag: "v2026.6.9",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.9",
    prerelease: false,
    highlights_zh: [
      "Telegram 投递更丰富：支持富 HTML、保留 Markdown 和贴纸路径、进度草稿和命令输出渲染更忠实、HTML 表格安全规范化、提及和缓存处理保持在正确投递路径",
      "Agent 恢复更可靠：重试、终端结果、压缩后用量、会话历史修复和回复协调使更多中断或部分轮次走向可见最终结果",
      "Codex 集成增强：自动插件审批、GPT-5.3 Spark OAuth 路由、远程节点 exec 作为动态工具、更可靠的 app-server 拆卸和终端结果",
      "独立官方 Provider 插件：外部 Provider 包作为一等 npm 发布，外部安装的通道插件在 Gateway 启动时加载",
      "Web 和原生客户端增强：Control UI 新增会话工作区轨道和扩展健康度、iOS 新增 Watch 控件、Android 显示聊天上下文",
      "搜索和技能改进：Codex Hosted Search 可用、免密钥搜索提供商保持显式 opt-in、ClawHub 技能安装保留验证来源出处"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.9-beta.1",
    date: "2026-06-19",
    tag: "v2026.6.9-beta.1",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.9-beta.1",
    prerelease: true,
    highlights_zh: [
      "Telegram 投递更丰富：支持富 HTML、保留 Markdown 和贴纸路径、进度草稿和命令输出渲染更忠实、提及和缓存处理保持在正确投递路径",
      "Agent 恢复更可靠：重试、终端结果、压缩后用量、会话历史修复和回复协调使更多中断或部分轮次走向可见最终结果",
      "Codex 集成增强：自动插件审批、GPT-5.3 Spark OAuth 路由、远程节点 exec 作为动态工具、更可靠的 app-server 拆卸和终端结果",
      "独立官方 Provider 插件：外部 Provider 包作为一等 npm 发布，外部安装的通道插件在 Gateway 启动时加载",
      "Web 和原生客户端增强：Control UI 新增会话工作区轨道和扩展健康度、iOS 新增 Watch 控件、Android 显示聊天上下文",
      "搜索和技能改进：Codex Hosted Search 可用、免密钥搜索提供商保持显式 opt-in、ClawHub 技能安装保留验证来源出处"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.8",
    date: "2026-06-16",
    tag: "v2026.6.8",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.8",
    prerelease: false,
    highlights_zh: [
      "Telegram 和 WhatsApp 通道投递更丰富更稳定：Telegram 支持结构化富文本（表格、列表、可折叠引用块、保留换行、CLI 后端回复），WhatsApp 支持配置的 ACP 绑定",
      "Agent 运行更可靠：账户作用域 DM 发送、生成媒体完成、自动回复消息工具最终回复、重置归档回退、重启关闭中止、yielded 子代理暂停、会话身份提示等均保持在正确恢复路径",
      "模型路由更安全：新增 GLM-5.2 和 Claude Haiku 4.5 目录支持，提供商标识归一化、SecretRef 认证管理、模型浏览限制、OpenAI/Anthropic 工具 schema 恢复加固",
      "原生 /usage 完整页脚渲染：默认模板、固定小数格式、凭据感知限制、部分计数处理、损坏模板警告",
      "Web 搜索默认更可预测：Parallel Free、DuckDuckGo、Ollama、Codex Hosted Search 等免密钥提供商保持显式 opt-in 而非自动回退",
      "UI 和移动端更平静：工作区文件默认折叠、WebChat 回滚支持流式传输、桌面会话选择器保持交互、/reset 参数在 dispatch 中存活、iOS 重连过期前台网关",
      "内存和状态更健壮：超大 OpenAI 嵌入批次自动拆分避免 431 错误、QMD 搜索在 transient 模式可用、SQLite 避免 NFS 卷上的 WAL、全量重索引保留回滚/缓存恢复",
      "Hono 升级到 4.12.25 安全补丁版本，已发布的 OpenClaw 和 ACPX 包使用修补后的运行时"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.8-beta.2",
    date: "2026-06-16",
    tag: "v2026.6.8-beta.2",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.8-beta.2",
    prerelease: true,
    highlights_zh: [
      "Telegram 和 WhatsApp 通道投递更丰富更稳定：Telegram 支持结构化富文本（表格、列表、可折叠引用块）、CLI 后端 prompt 保留投递、更安全的富媒体边界；WhatsApp 支持配置的 ACP 绑定",
      "Agent 和 Gateway 恢复能力全面提升：涵盖账户作用域 DM 发送、生成媒体完成、自动回复消息工具最终回复、重置归档回退读取、重启关闭中止、yielded 子代理暂停、心跳去重、会话身份提示等",
      "Provider/模型处理扩展和加固：新增 GLM-5.2 和 Claude Haiku 4.5 目录条目、OpenRouter 和 Google Vertex 前缀规范化、SecretRef 认证、OAuth 图片默认路由、LM Studio 二进制 thinking-off 投递、Claude 4.5 Copilot 工具流安全等",
      "/usage 和回复负载钩子新增原生完整页脚渲染、默认模板、固定小数格式、凭据感知限制和损坏模板警告",
      "UI 和移动端流程更稳定：工作区文件可折叠、WebChat 回滚支持流式传输、侧边栏会话选择器保持交互、iOS 重连过期前台网关",
      "内存、状态和诊断恢复更干净：超大 OpenAI 嵌入批次自动拆分、QMD 内存搜索在 transient 模式可用、SQLite 避免 NFS 上的 WAL、卡住会话恢复调度不再重置警告退避"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.7-beta.1",
    date: "2026-06-13",
    tag: "v2026.6.7-beta.1",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.7-beta.1",
    prerelease: true,
    highlights_zh: [
      "通道投递更严格：Slack 同通道最终回复保留到转录、顶层 image 消息工具发送附带媒体、Telegram 可折叠引用块和池化回放在投递后存活、显式静默助手回复保持静默、进度草稿启动失败被报告、通道操作结果页可增量获取",
      "Provider 和模型处理更健壮：Kimi K2.7 Code 可用、Kimi 原生工具调用 ID 和 reasoning_content 回放修复、Mistral 跳过不可读工具 schema、Fireworks 目录参数来自 manifest、DeepSeek 保持配置的静态传输、Anthropic thinking 回放修复",
      "用户可见的上下文和认证边界更安全：飞书不再泄露 prompt-preface 运行时上下文到回复、WebSocket 载荷处理加固、CLI 后端 /btw 回退失败关闭、Skill Workshop 符号链接写入在回滚元数据前进行门控验证",
      "Agent、内存、Codex、cron 和更新恢复路径保留有用的失败：无效插件模型目录被隔离、QMD 启动失败在回退错误后存活、Codex 内存提示保持注册、Linux 服务更新干净交接",
      "UI、文档、QA 和发布验证改进：无障碍对比度/焦点/字体修复、空 Workboard 列可隐藏、设计系统文档化、QA 证据和计分卡产物生成、QA Lab 打包进 Docker 镜像"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.8-beta.1",
    date: "2026-06-14",
    tag: "v2026.6.8-beta.1",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.8-beta.1",
    prerelease: true,
    highlights_zh: [
      "Telegram 和 WhatsApp 通道投递更丰富更稳定：Telegram 支持结构化富文本（表格、列表、可折叠引用块）、CLI 后端 prompt 保留投递、更安全的富媒体边界；WhatsApp 支持配置的 ACP 绑定",
      "Agent 和 Gateway 恢复能力全面提升：涵盖账户作用域 DM 发送、生成媒体完成、自动回复消息工具最终回复、重置归档回退读取、重启关闭中止、yielded 子代理暂停、心跳去重、会话身份提示等",
      "Provider/模型处理扩展和加固：新增 GLM-5.2 和 Claude Haiku 4.5 目录条目、OpenRouter 和 Google Vertex 前缀规范化、SecretRef 认证、OAuth 图片默认路由、LM Studio 二进制 thinking-off 投递、Claude 4.5 Copilot 工具流安全等",
      "/usage 和回复负载钩子新增原生完整页脚渲染、默认模板、固定小数格式、凭据感知限制和损坏模板警告",
      "UI 和移动端流程更稳定：工作区文件可折叠、WebChat 回滚支持流式传输、侧边栏会话选择器保持交互、iOS 重连过期前台网关",
      "内存、状态和诊断恢复更干净：超大 OpenAI 嵌入批次自动拆分、QMD 内存搜索在 transient 模式可用、SQLite 避免 NFS 上的 WAL、卡住会话恢复调度不再重置警告退避"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.6",
    date: "2026-06-12",
    tag: "v2026.6.6",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.6",
    prerelease: false,
    highlights_zh: [
      "安全边界全面收紧：涵盖转录、沙箱绑定、主机环境继承、MCP stdio、Codex HTTP 访问、原生搜索策略、提权发送者检查、已删除 Agent ACP 绕过、环回工具、Discord 审核和 Teams 群操作；exec 审批超时现在默认拒绝",
      "Telegram 投递更安全：账户作用域 topic 路由到正确 Agent、流式文本在工具调用后存活、/compact 在通用入口工作、持久化 dispatch 去重移入 SDK、未授权 DM 文本不再进入缓存和 prompt 上下文",
      "iMessage 恢复和投递改进：常驻入站重启、持久化 echo 标记、块流式传输、空闲审批发现、加固出站传输和可操作入站启动诊断",
      "浏览器和 MCP 连接性增强：现有会话 CDP 支持、发现的 WebSocket 验证、默认配置文件 cdpUrl 处理、更安全的浏览器输出边界、Streamable HTTP 环回传输、OAuth/SSE 授权修正和更广泛 schema 兼容性",
      "Control UI 启动和首回复延迟降低：缓存模型元数据、移除启动目录等待、延迟加载斜杠命令和首事件追踪及慢回复诊断",
      "Provider 支持扩展：新增 OpenRouter OAuth 引导和 Claude Fable 5 自适应思考，Codex 会话保持正确压缩所有权，本地模型跳过 guardian 审查，动态工具进度正常化，Gemma 4 推理回放保留"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.6-beta.2",
    date: "2026-06-12",
    tag: "v2026.6.6-beta.2",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.6-beta.2",
    prerelease: true,
    highlights_zh: [
      "安全边界全面收紧：涵盖转录、沙箱绑定、主机环境继承、MCP stdio、Codex HTTP 访问、原生搜索策略、提权发送者检查、已删除 Agent ACP 绕过、环回工具、Discord 审核和 Teams 群操作；exec 审批超时现在默认拒绝",
      "Telegram 投递更安全：账户作用域 topic 路由到正确 Agent、流式文本在工具调用后存活、/compact 在通用入口工作、持久化 dispatch 去重移入 SDK、未授权 DM 文本不再进入缓存和 prompt 上下文",
      "iMessage 恢复和投递改进：常驻入站重启、持久化 echo 标记、块流式传输、空闲审批发现、加固出站传输和可操作入站启动诊断",
      "浏览器和 MCP 连接性增强：现有会话 CDP 支持、发现的 WebSocket 验证、默认配置文件 cdpUrl 处理、更安全的浏览器输出边界、Streamable HTTP 环回传输、OAuth/SSE 授权修正和更广泛 schema 兼容性",
      "Control UI 启动和首回复延迟降低：缓存模型元数据、移除启动目录等待、延迟加载斜杠命令和首事件追踪及慢回复诊断",
      "Provider 支持扩展：新增 OpenRouter OAuth 引导和 Claude Fable 5 自适应思考，Codex 会话保持正确压缩所有权，本地模型跳过 guardian 审查，动态工具进度正常化，Gemma 4 推理回放保留"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.6-beta.1",
    date: "2026-06-10",
    tag: "v2026.6.6-beta.1",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.6-beta.1",
    prerelease: true,
    highlights_zh: [
      "安全边界全面收紧：涵盖转录、沙箱绑定、主机环境继承、MCP stdio、Codex HTTP 访问、原生搜索策略、提权发送者检查、已删除 Agent ACP 绕过、环回工具、Discord 审核和 Teams 群操作；exec 审批超时现在默认拒绝",
      "Telegram 投递更安全：账户作用域 topic 路由到正确 Agent、流式文本在工具调用后存活、/compact 在通用入口工作、持久化 dispatch 去重移入 SDK、未授权 DM 文本不再进入缓存和 prompt 上下文",
      "iMessage 恢复和投递改进：常驻入站重启、持久化 echo 标记、块流式传输、空闲审批发现、加固出站传输和可操作入站启动诊断",
      "浏览器和 MCP 连接性增强：现有会话 CDP 支持、发现的 WebSocket 验证、默认配置文件 cdpUrl 处理、更安全的浏览器输出边界、Streamable HTTP 环回传输、OAuth/SSE 授权修正和更广泛 schema 兼容性",
      "Control UI 启动和首回复延迟降低：缓存模型元数据、移除启动目录等待、延迟加载斜杠命令和首事件追踪",
      "Provider 支持扩展：新增 OpenRouter OAuth 引导和 Claude Fable 5 自适应思考，Codex 会话保持正确压缩所有权，本地模型跳过 guardian 审查，Gemma 4 推理回放保留"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.5-beta.5",
    date: "2026-06-08",
    tag: "v2026.6.5-beta.5",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.5-beta.5",
    prerelease: true,
    highlights_zh: [
      "QQBot 发送前剥离模型推理/思考标签，防止原始 <thinking> 内容泄露到通道回复",
      "MCP 工具结果在 materialize 边界强制转换 resource_link、resource、audio、格式错误的 image 及未来非文本/图片块，防止 Anthropic 400 错误和污染会话历史",
      "Anthropic 扩展思考会话在 prompt-cache 过期或 Gateway 重启后恢复，stream start 事件等待 message_start 使预生成签名错误触发现有恢复重试",
      "Parallel 成为内置 web_search 提供商，支持 PARALLEL_API_KEY 发现、受保护端点处理、缓存安全会话 ID、onboarding picker 和文档",
      "Google Vertex ADC 用户重新获得静态 catalog 行和运行时模型解析，单提供商冷却恢复和内存适配器状态检查更可靠",
      "Matrix 支持语音消息预检和线程感知读/回复行为，语音和线程流程有 QA 覆盖",
      "认证和插件安装状态迁移到 SQLite，官方 npm 插件安装记录保留可信 pin，预发布回退完整性检查避免携带过期完整性",
      "Agent、工具和 Provider 循环对 MCP lease 时间戳、prompt-cache 工具名、本地工具目录、不可读动态工具、仅所有者 HTTP 工具和 Provider 目录元数据更严格，减少隐藏重试和不安全暴露",
      "macOS 节点模式不再静默重连离开健康直连 Gateway 会话，减少意外 companion app 会话切换",
      "升级和服务路径更安全：cron 遗留 JSON 存储在 doctor 预检时迁移到 SQLite，服务 env 占位符不再掩盖 state-dir 密钥，WhatsApp 启动等待有上限，禁用 WhatsApp 账户在配置重载时正确清理"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.5-beta.2",
    date: "2026-06-07",
    tag: "v2026.6.5-beta.2",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.5-beta.2",
    prerelease: true,
    highlights_zh: [
      "QQBot 发送前剥离模型推理/思考标签，防止原始 <thinking> 内容泄露到通道回复",
      "MCP 工具结果在 materialize 边界强制转换 resource_link、resource、audio、格式错误的 image 及未来非文本/图片块，防止 Anthropic 400 错误和工具返回更丰富 MCP 内容时污染会话历史",
      "Anthropic 扩展思考会话在 prompt-cache 过期或 Gateway 重启后恢复，因为 stream start 事件等待 message_start，使预生成签名错误触发现有恢复重试",
      "Parallel 成为内置 web_search 提供商，支持 PARALLEL_API_KEY 发现、受保护端点处理、缓存安全会话 ID、onboarding picker 和文档",
      "Google Vertex ADC 用户重新获得静态 catalog 行和运行时模型解析，单提供商冷却恢复和内存适配器状态检查更可靠",
      "Matrix 支持语音消息预检和线程感知读/回复行为，语音和线程流程有 QA 覆盖",
      "认证和插件安装状态更持久：认证配置文件迁移到 SQLite，官方 npm 插件安装记录保留可信 pin，预发布回退完整性检查避免携带过期完整性",
      "macOS 节点模式不再静默重连离开健康直连 Gateway 会话，减少意外 companion app 会话切换",
      "升级和服务路径更安全：cron 遗留 JSON 存储在 doctor 预检时迁移，服务 env 占位符不再掩盖 state-dir 密钥，WhatsApp 启动等待有上限，禁用 WhatsApp 账户在配置重载时正确清理"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.5",
    date: "2026-06-09",
    tag: "v2026.6.5",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.5",
    prerelease: false,
    highlights_zh: [
      "QQBot 发送前剥离模型推理/思考标签，防止原始 <thinking> 内容泄露到通道回复",
      "MCP 工具结果在 materialize 边界强制转换非文本/图片块，防止 Anthropic 400 错误",
      "Anthropic 扩展思考会话在 prompt-cache 过期或 Gateway 重启后恢复",
      "Parallel 成为内置 web_search 提供商，支持 PARALLEL_API_KEY 发现和受保护端点处理",
      "Google Vertex ADC 用户重新获得静态 catalog 行和运行时模型解析",
      "Matrix 支持语音消息预检和线程感知读/回复行为",
      "认证和插件安装状态迁移到 SQLite，更持久可靠",
      "macOS 节点模式不再静默重连离开健康直连 Gateway 会话",
      "ClawHub 技能支持通过 GitHub 仓库安装，保留 install-policy 检查和遥测报告",
      "Google Chat 原生审批卡片操作和点击处理",
      "版本命名切换为 YYYY.M.PATCH 月度补丁编号"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.2-beta.1",
    date: "2026-06-03",
    tag: "v2026.6.2-beta.1",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.2-beta.1",
    prerelease: true,
    highlights_zh: [
      "插件和技能安装改用 operator install policy 替代旧的危险代码扫描路径，doctor、CLI、ClawHub 和故障排除界面更清晰",
      "Telegram、飞书、Discord、WhatsApp 等通道的投递路径更安全，修复了重复转录镜像、Telegram 管理员回写、流式预览、审批白名单等问题",
      "聊天、Control UI、Skill Workshop、Workboard、Android 伴侣和 WebChat 流程改进：保留可见流式文本、协调完成发送、暴露 ACK 计时、新增 Workboard 键盘移动、强化对话框可访问性、延迟加载用量视图",
      "安全、策略和配置恢复现在拒绝损坏的 shell 快照、不支持的策略键、不安全的 exec 审批预检环境和可疑的网关启动配置",
      "网关、Agent、Codex、Provider、模型和内存路径恢复了会话写锁释放失败、废弃的 Codex app-server 启动、stream-to-parent ACP spawn、自定义 Provider 运行时扇出、bundled Provider 别名、prompt-cache 边界、Gemini stop sequences 和 Kimi cache markers",
      "发布、CI、Docker、Crabbox/Testbox 和 E2E 验证流水线对更多网络调用、数字限制、进程组、清理泄漏和 Windows 安装发布进行了边界限制"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.1",
    date: "2026-06-03",
    tag: "v2026.6.1",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.1",
    prerelease: false,
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
  {
    project: "hermes-agent",
    version: "0.17.0",
    date: "2026-06-19",
    tag: "v2026.6.19",
    url: "https://github.com/NousResearch/hermes-agent/releases/tag/v2026.6.19",
    prerelease: false,
    highlights_zh: [
      "Hermes 接入 iMessage：基于 Photon Spectrum 平台插件，无需 Mac 中继，运行 hermes photon login 认证即可收发 iMessage",
      "Raft 代理网络集成：通过 Raft 平台适配器作为外部 Agent 连接到 Raft 网络，唤醒载荷仅携带元数据不传消息体",
      "桌面应用大幅增强：可重绑快捷键、原生 OS 通知、子代理实时 watch-window、模型选择器+预设、自动 RTL 文本方向、可调整大小的 VS Code 终端面板、支持安装 VS Code Marketplace 主题",
      "后台/异步子代理：delegate_task(background=true) 立即返回句柄，子代理后台运行完成后结果重新进入对话",
      "图片编辑能力：image_generate 支持图生图编辑和转换，同一工具同一模式支持所有图片 Provider",
      "自动化蓝图：按名称选择自动化，Hermes 询问所需参数，无需 cron 语法，蓝图在仪表板/CLI/TUI/消息平台统一渲染",
      "Cursor Composer 模型可通过 xAI Grok 订阅访问：grok-composer-2.5-fast 加入 xAI OAuth 模型选择器，200k 上下文窗口",
      "仪表板完整配置文件构建器：浏览器中构建完整 Hermes 配置——选模型、选技能、挂 MCP 服务器，无需手编 config.yaml",
      "Skills Hub 浏览器全面改版：连接 Hub、精选区域、安装前完整预览、安全扫描",
      "memory 工具重大升级：原子批量操作——单次调用中添加/替换/删除编辑原子执行，自动处理字符预算溢出",
      "官方 WhatsApp Business Cloud API 适配器：Meta 官方托管路径，无需 QR 扫描的桥接进程",
      "Telegram 富文本：通过 Bot API 10.1 渲染富消息，默认开启",
      "Curator 成本优化：常规运行不再消耗辅助模型 token，确定性不活跃扫描免费运行"
    ]
  },
  {
    project: "hermes-agent",
    version: "0.16.0",
    date: "2026-06-05",
    tag: "v2026.6.5",
    url: "https://github.com/NousResearch/hermes-agent/releases/tag/v2026.6.5",
    prerelease: false,
    highlights_zh: [
      "全新 Hermes Desktop 原生桌面应用：基于 Electron 构建，支持 macOS/Linux/Windows，一键安装、应用内自更新、拖拽文件到聊天、Cmd+K 命令面板、状态栏内联模型选择器、多配置文件并发会话、完整简体中文翻译",
      "桌面应用支持远程网关连接：可连接远程 Hermes 网关（家庭服务器、托管服务器等），通过 OAuth 或用户名/密码认证，无需手动配置 session token，每个配置文件可指向不同远程主机",
      "Web 仪表板升级为完整管理面板：新增 MCP 目录管理、消息通道配置、凭据管理、Webhook 创建、内存配置、网关控制等，无需 SSH 编辑 config.yaml",
      "精简默认技能集：移除冗余技能（spotify、linear 等），重技能移至可选安装，新增 environments 相关性过滤门控，技能选择器噪音更少",
      "NVIDIA/skills 成为内置信任技能源：与 OpenAI、Anthropic、HuggingFace 并列，CUDA-X、AIQ、cuOpt 等 NVIDIA 技能一键安装",
      "快速设置通过 Nous Portal：首次设置简化为两条路径——快速设置（Nous Portal 登录即聊）和完整设置（高级用户向导）",
      "模糊搜索模型选择器：桌面/Web/TUI/CLI 全端支持模糊搜索，新增 deepseek-v4-flash、MiniMax-M3（1M 上下文）、qwen3.7-plus，模型目录每小时刷新",
      "/undo [N] 支持撤销最近 N 轮对话：CLI、TUI 和消息平台（Telegram、Discord 等）均支持",
      "默认界面可选：可设置 hermes chat 默认进入 CLI 或 TUI，--cli 标志可按次覆盖",
      "安全修复：Starlette 版本固定（CVE-2026-48710）、SSRF 离环加固、子进程凭据剥离，关闭 2 个 P0 和 62 个 P1 issue"
    ]
  }
];
