export default [
  // ==================== OpenClaw ====================
  {
    project: "openclaw",
    version: "2026.6.11-beta.1",
    date: "2026-06-24",
    tag: "v2026.6.11-beta.1",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.11-beta.1",
    prerelease: true,
    highlights_zh: [
      "通道控制更强：Slack 中继模式、原生 Mattermost /oc_queue 命令、每 DM 模型覆盖，通道操作更易自动化调优",
      "运维工作流更实用：openclaw agent --message-file 支持文件驱动任务、RAFT CLI 唤醒桥接通道",
      "插件分发更安全：更多官方插件外部化、捆绑插件图标元数据对已安装客户端可用",
      "移动端操作更强：Android 设置详情面板改善配置可见性和控制",
      "Agent 轮次更可靠：Codex 部分增量流、harness 激活、长上下文 prompt-cache 稳定性减少丢失进度和不一致运行",
      "网关和插件工具增强：通道身份 hook 上下文和每代理用量成本报告提供更精确的路由和计量",
      "Provider 和模型覆盖扩展：目录解析、推理控制、Provider 模型解析和加密推理支持覆盖更多实时 Provider 变体",
      "通道投递修复：Telegram 进度渲染、webhook 生命周期、reaction 指令、重复镜像写入、WhatsApp 持久回复目标等更可靠",
      "网关和会话安全修复：卡住的 release claim、draining 状态报告、远程探针超时、畸形配对访问列表等处理更安全",
      "Agent 和回退行为修复：中止运行干净停止、Provider 响应体有界、Claude CLI 额度失败继续回退、Codex 用量限制正确分类",
      "Cron 和投递验证修复：无配置投递检查、线程感知去重、待处理循环运行保留预期目标"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.10",
    date: "2026-06-24",
    tag: "v2026.6.10",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.10",
    prerelease: false,
    highlights_zh: [
      "对话快速模式自动切换：短对话轮次自动启用 fast mode，长任务自动切回 normal mode，带边界回退和投递行为",
      "模型路由更可靠：Zai 模型合成、GLM 过载故障转移和原生推理级别选择更一致地遵循活跃模型目录",
      "会话和通道状态更安全：通道切换重置过期 origin 字段，cron 投递感知保持附着在目标会话上",
      "可信策略在 hook 组合后存活：组合的 hook 注册表保留审批敏感流程所需的可信工具策略"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.10-beta.2",
    date: "2026-06-22",
    tag: "v2026.6.10-beta.2",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.10-beta.2",
    prerelease: true,
    highlights_zh: [
      "对话快速模式自动切换：短对话轮次自动启用 fast mode，长任务自动切回 normal mode，带边界回退和投递行为",
      "模型路由更可靠：Zai 模型合成、GLM 过载故障转移和原生推理级别选择更一致地遵循活跃模型目录",
      "会话和通道状态更安全：通道切换重置过期 origin 字段，cron 投递感知保持附着在目标会话上",
      "可信策略在 hook 组合后存活：组合的 hook 注册表保留审批敏感流程所需的可信工具策略"
    ]
  },
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
  },
  {
    project: "hermes-agent",
    version: "0.15.2",
    date: "2026-05-29",
    tag: "v2026.5.29.2",
    url: "https://github.com/NousResearch/hermes-agent/releases/tag/v2026.5.29.2",
    prerelease: false,
    highlights_zh: [
      "修复打包问题：wheel 和 sdist 中遗漏捆绑的 plugin.yaml 清单"
    ]
  },
  {
    project: "hermes-agent",
    version: "0.15.1",
    date: "2026-05-29",
    tag: "v2026.5.29",
    url: "https://github.com/NousResearch/hermes-agent/releases/tag/v2026.5.29",
    prerelease: false,
    highlights_zh: [
      "修复仪表板 401 无限重载循环：回环模式下 /api/auth/me 返回 401 导致页面不断刷新",
      "Docker 仪表板 --insecure 现为显式环境变量 HERMES_DASHBOARD_INSECURE=1，不再从绑定主机推断",
      "MCP 裸命令在 Docker 中正确解析：npx/npm/node 现在对 /usr/local/bin 解析，容器内不再静默失败",
      "技能页面侧边栏和来源标签恢复",
      "看板工作者 SIGTERM 处理、/model 选择器统一、/yolo 会话绕过、skills.sh 完整 19932 条目录等修复"
    ]
  },
  {
    project: "hermes-agent",
    version: "0.14.0",
    date: "2026-05-16",
    tag: "v2026.5.16",
    url: "https://github.com/NousResearch/hermes-agent/releases/tag/v2026.5.16",
    prerelease: false,
    highlights_zh: [
      "xAI Grok 通过 SuperGrok OAuth 接入：无需 API Key，grok-4.3 上下文窗口升至 1M token",
      "OpenAI 兼容本地代理：hermes proxy 启动本地端点，将 OAuth Provider（Claude Pro/ChatGPT Pro/SuperGrok）转为 OpenAI 兼容 API，Codex/Aider/Cline/Continue 可直接调用",
      "x_search 工具：一等 X(Twitter) 搜索工具，支持 OAuth 或 API Key 认证",
      "Microsoft Teams 全栈接入：Graph 认证 + webhook 监听 + 管道运行时 + 出站投递",
      "安装大幅精简：重量级后端改为懒安装，[all] extras 覆盖懒依赖，pip install hermes-agent 直接可用",
      "冷启动优化：启动时间减少约 19 秒，浏览器 CDP 调用提速 180 倍",
      "新增 LINE 和 SimpleX Chat 两个消息平台，总数达 22 个",
      "跨会话 1 小时 Claude prompt 缓存、/handoff 实时会话转移、Telegram/Discord 原生按钮 UI",
      "LSP 语义诊断、统一可插拔 video_generate、computer_use 支持非 Anthropic Provider",
      "原生 Windows 测试版、9 个新可选技能、OpenRouter Pareto Code 路由器"
    ]
  },
  {
    project: "hermes-agent",
    version: "0.13.0",
    date: "2026-05-07",
    tag: "v2026.5.7",
    url: "https://github.com/NousResearch/hermes-agent/releases/tag/v2026.5.7",
    prerelease: false,
    highlights_zh: [
      "多代理看板：持久化多代理任务板，支持心跳、回收、僵尸检测、不完整退出自动阻塞、每任务重试、幻觉恢复",
      "/goal 目标锁定：Agent 跨轮次保持目标不偏离，Ralph 循环作为一等原语",
      "视频分析：video_analyze 工具支持 Gemini 等多模态模型的原生视频理解",
      "语音克隆：xAI Custom Voices 作为 TTS Provider，支持语音克隆",
      "国际化：静态网关和 CLI 消息翻译为 7 种语言（中日德西法乌土）",
      "Checkpoints v2 重写状态持久化，支持真实剪枝",
      "网关自动恢复中断会话，Cron 新增 no_agent 看门狗模式",
      "安全加固：脱敏默认开启、Discord 角色白名单限定 guild、WhatsApp 默认拒绝陌生人、TOCTOU 窗口关闭",
      "Google Chat 成为第 20 个平台，Provider 变为可插拔架构"
    ]
  },
  {
    project: "hermes-agent",
    version: "0.12.0",
    date: "2026-04-30",
    tag: "v2026.4.30",
    url: "https://github.com/NousResearch/hermes-agent/releases/tag/v2026.4.30",
    prerelease: false,
    highlights_zh: [
      "自主 Curator 技能管理器：后台 cron 定期评分、整合、修剪技能库，输出运行报告",
      "自我改进循环大幅升级：改为 rubric 评分制、偏向活跃更新技能、处理 references/templates 子文件",
      "技能集成大扩展：ComfyUI v5 和 TouchDesigner-MCP 从可选改为内置，新增 Spotify 和 Google Meet 原生集成",
      "TUI 冷启动缩减约 57%",
      "新增 4 个推理 Provider、第 18 个消息平台、Teams 插件作为第 19 个"
    ]
  },
  {
    project: "hermes-agent",
    version: "0.11.0",
    date: "2026-04-23",
    tag: "v2026.4.23",
    url: "https://github.com/NousResearch/hermes-agent/releases/tag/v2026.4.23",
    prerelease: false,
    highlights_zh: [
      "全新 Ink TUI：React/Ink 重写的交互式 CLI，粘性编辑器、实时流式、OSC-52 剪贴板、状态栏秒表和 git 分支",
      "可插拔传输架构：Anthropic/ChatCompletions/ResponsesApi/Bedrock 传输层各自独立，原生 AWS Bedrock Converse API 支持",
      "5 个新推理路径：原生 NVIDIA NIM、Arcee AI、Step Plan、Google Gemini CLI OAuth、Vercel ai-gateway",
      "GPT-5.5 通过 Codex OAuth 可用，新 OpenAI 发布自动出现在模型选择器",
      "QQBot 成为第 17 个支持平台",
      "插件架构大改：两阶段注册、内部目录架构、全面工具调用日志、插件来源追踪"
    ]
  },
  {
    project: "hermes-agent",
    version: "0.10.0",
    date: "2026-04-16",
    tag: "v2026.4.16",
    url: "https://github.com/NousResearch/hermes-agent/releases/tag/v2026.4.16",
    prerelease: false,
    highlights_zh: [
      "Nous Tool Gateway：付费 Nous Portal 订阅者自动获得网络搜索(Firecrawl)、图片生成(FAL/FLUX 2 Pro)、TTS(OpenAI)、浏览器自动化(Browser Use)，无需额外 API Key",
      "工具通过 use_gateway 配置逐个启用，与 hermes tools 和 hermes status 完整集成"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.11-beta.2",
    date: "2026-06-28",
    tag: "v2026.6.11-beta.2",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.11-beta.2",
    prerelease: true,
    highlights_zh: [
      "通道控制更强：Slack 中继模式、原生 Mattermost /oc_queue 命令、每 DM 模型覆盖，通道操作更易自动化调优",
      "运维工作流更实用：openclaw agent --message-file 支持文件驱动任务、RAFT CLI 唤醒桥接通道",
      "插件分发更安全：更多官方插件外部化、捆绑插件图标元数据对已安装客户端可用",
      "移动端操作更强：Android 设置详情面板改善配置可见性和控制",
      "Agent 轮次更可靠：Codex 部分增量流、harness 激活、长上下文 prompt-cache 稳定性减少丢失进度和不一致运行",
      "网关和插件工具增强：通道身份 hook 上下文和每代理用量成本报告提供更精确的路由和计量",
      "Provider 和模型覆盖扩展：目录解析、推理控制、Provider 模型解析和加密推理支持覆盖更多实时 Provider 变体",
      "通道投递修复：Telegram 进度渲染、webhook 生命周期、reaction 指令、重复镜像写入、WhatsApp 持久回复目标等更可靠",
      "WhatsApp 和消息身份修复：原生引用、Baileys 群组可靠性、JID 漂移下的审批反应保持预期对话上下文",
      "网关和会话安全修复：卡住的 release claim、draining 状态报告、远程探针超时、畸形配对访问列表等处理更安全，无静默路由丢失",
      "Agent 和回退行为修复：中止运行干净停止、Provider 响应体有界、Claude CLI 额度失败继续回退、Codex 用量限制正确分类",
      "Provider 和模型边界修复：OpenRouter ID、Ollama 发现和嵌入、Gemini 新鲜度、模型目录前缀解析到正确运行时元数据",
      "配置和 UI 护栏：非交互配置失败关闭、TLS 路径拒绝空值、内存产物净化、UI 使用修补的 DOMPurify 版本",
      "Cron 和投递验证修复：无配置投递检查、线程感知去重、待处理循环运行保留预期目标"
    ]
  },
  {
    project: "openclaw",
    version: "2026.6.11",
    date: "2026-06-30",
    tag: "v2026.6.11",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.6.11",
    prerelease: false,
    highlights_zh: [
      "专注可靠性打磨：修复错位回复、卡住发送、重连失败、模型配置故障和管理员默认值安全问题",
      "跨通道投递修复覆盖 Telegram/WhatsApp/Matrix/Google Chat/iMessage/飞书/Mattermost/WebChat/Control UI/TUI 等十余个通道",
      "WhatsApp 群聊回复在重试、重连和群组变更时保持正确消息和群组上下文",
      "Telegram webhook 用户在短暂通道重启和配置重载期间不再丢失 DM 和群消息",
      "Matrix E2EE 网关长时间运行不再因内存泄漏崩溃",
      "Telegram 进度模式在新工具输出前清除旧气泡，保持对话清晰可读",
      "iMessage 命令和链接消息在延迟预览到达时保持合并为一个 turn",
      "飞书语音回复现在在聊天气泡中显示时长",
      "共享网关可为不同 DM 联系人分配不同模型",
      "Mattermost 原生 /oc_queue 命令支持调节活跃运行队列模式、去抖时间和丢弃处理",
      "Provider 和模型恢复更清晰：OpenAI/Google/Mistral 等不再泄露内部 cache-boundary marker 到 prompt",
      "OpenRouter 用户可正常选择 DeepSeek V4 短模型 ID，不再因重复前缀导致 model_not_found",
      "/reasoning on 时 DeepSeek 兼容模型的答案与推理分离显示",
      "Codex 订阅额度耗尽时自动切换到配置的回退模型而非停止",
      "Google Gemini 3.5 Flash 可选完整 1M token 上下文窗口",
      "Cron 任务在本地 Provider 返回 LLM request failed 时可重试或切换回退模型"
    ]
  },
  {
    project: "hermes-agent",
    version: "0.18.0",
    date: "2026-07-01",
    tag: "v2026.7.1",
    url: "https://github.com/NousResearch/hermes-agent/releases/tag/v2026.7.1",
    prerelease: false,
    highlights_zh: [
      "P0/P1 全面清零：12 天内解决约 692 个最高优先级项（496 issues + 196 PRs），整个仓库 P0/P1 归零并计划持续保持",
      "Mixture-of-Agents 升级为一等模型：每个 MoA 预设作为可选虚拟模型出现在 moa provider 下，CLI/TUI/桌面端均可直接选择",
      "MoA 可视化推理过程：每个参考模型（GPT-5、Claude、Grok 等）的完整输出作为带标签块展示，聚合器答案实时流式传输",
      "Agent 自我验证机制：通过 completion contracts 判定任务完成，/goal 支持基于证据的完成判定而非模型主观断言",
      "/learn 一键技能化：描述任意工作流即可自动提取为可复用技能，写入 CONTRIBUTING.md 标准",
      "/journey 学习时间线：可查看/编辑/删除 Agent 积累的记忆和技能，配合桌面端记忆图（径向时间线）可视化",
      "后台并行扇出：delegate_task 支持后台多子代理并行执行，完成后汇总为单次回复，不阻塞当前对话",
      "桌面端一等 Projects：按配置文件管理代码仓库、编码轨道、审查面板、git worktree，桌面端变为编码驾驶舱",
      "网关可伸缩部署：支持 scale-to-zero 空闲休眠和 drain coordination 优雅排空，重启/迁移不中断进行中的对话",
      "自我改进成本优化：后台审查改用辅助模型、摘要上下文替代全量回放、自适应节奏，大幅降低 token 消耗",
      "/prompt 编辑器撰稿：通过 $EDITOR 在外部编辑器编写多行 prompt，告别单行输入限制",
      "Google Vertex AI 一等支持：通过服务账号 JSON 或 ADC 自动铸造和刷新 OAuth2 token，Gemini 模型开箱即用",
      "安全加固：MCP 配置持久化攻击面收紧、cron base_url 凭据外泄阻断、Slack xapp- token 脱敏、浏览器云元数据强制执行、aiohttp CVE 修复"
    ]
  },
  {
    project: "openclaw",
    version: "2026.7.1-beta.1",
    date: "2026-07-02",
    tag: "v2026.7.1-beta.1",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.7.1-beta.1",
    prerelease: true,
    highlights_zh: [
      "OpenAI GPT-5.6 模型支持：目录、能力和运行时选择路径全面识别 GPT-5.6 系列",
      "外部 harness 附加：openclaw attach 可对已有 Gateway 会话启动外部 harness，交互式 Codex 工作流更易恢复和检查",
      "Telegram Codex 工作流：Telegram 支持通过 /login 发起 Codex 配对、控制活跃 Codex 运行、跨瞬态 API 故障恢复最终回复",
      "事件驱动 cron 运行：新增 on-exit 调度类型，监听命令退出时唤醒 Agent；session-targeted 运行可干净分离",
      "原生应用刷新：iOS 采用 iOS 26 视觉系统，导航、设置、Chat、Talk 和引导流程更清晰；原生应用本地化扩展至 Apple 和 Android",
      "更丰富的消息能力：iMessage 支持原生投票创建/阅读/投票，内置用量页脚提供更清晰的每轮用量统计",
      "更安全的作用域对话：capability profiles 为每对话准备工具和访问边界，不削弱现有默认配置",
      "模型和 Provider 覆盖：GPT-5.6、Nemotron Super 1M 上下文窗口、保留显式 OpenRouter 认证头",
      "CLI 和节点工作流：openclaw attach、节点上下文路径支持、设备审批恢复指引、插件安装退出诊断更清晰",
      "Cron 和用量：退出触发调度、分离的 session-targeted 运行、进行中任务 doctor 警告、内置完整用量页脚",
      "原生应用和本地化：iOS 导航/设置/演示/Talk 控件现代化、Gateway 语音 Provider、QR 引导改进、瑞典语移动端本地化",
      "Doctor 和诊断：暴露 auth-profile、工作空间、设备配对、通道插件、内存 Provider、systemd 耗尽和 Windows LAN 防火墙发现",
      "对话和审查控件：准备作用域对话 capability profiles、新增 Cursor Agent 作为自动审查引擎",
      "Telegram 耐久性修复：恢复卡住的 ingress claims、重试重启丢失的媒体、存活瞬态轮询错误、死信有毒更新、保留转发富文本",
      "Agent 和上下文可靠性：保留运行时覆盖和引导的子代理任务、改善 harness 感知的上下文估计和压缩预检、超时静默本地流",
      "Provider 和网络安全：约束跨 Moonshot/MiniMax/Anthropic OAuth/Discord/Matrix 等路径的超大或畸形响应",
      "通道投递和路由：Slack 回复保持在活跃线程、保留账户绑定投递路由、保留 WeChat 会话路由",
      "Cron 正确性：超时时保留 Provider 和模型选择、保留启动追赶延迟、清除空白 thinking 覆盖",
      "内存和会话恢复：检测未索引的转录、笔记更新和 ChatGPT 导入时保留手编辑 frontmatter、避免跨目录恢复"
    ]
  },
  {
    project: "openclaw",
    version: "2026.7.1-beta.2",
    date: "2026-07-05",
    tag: "v2026.7.1-beta.2",
    url: "https://github.com/openclaw/openclaw/releases/tag/v2026.7.1-beta.2",
    prerelease: true,
    highlights_zh: [
      "OpenAI GPT-5.6 模型支持：目录、能力和运行时选择路径全面识别 GPT-5.6 系列",
      "外部 harness 附加：openclaw attach 可对已有 Gateway 会话启动外部 harness，交互式 Codex 工作流更易恢复和检查",
      "Telegram Codex 工作流：支持通过 /login 发起 Codex 配对、控制活跃 Codex 运行、跨瞬态 API 故障恢复最终回复",
      "事件驱动 cron 运行：新增 on-exit 调度类型，监听命令退出时唤醒 Agent；session-targeted 运行可干净分离",
      "原生应用刷新：iOS 采用 iOS 26 视觉系统，Chat、Talk、引导和重连流程更清晰；原生应用本地化扩展至 Apple 和 Android",
      "更丰富的消息能力：iMessage 支持原生投票创建/阅读/投票，内置用量页脚提供更清晰的每轮用量统计",
      "更安全的作用域对话：capability profiles 为每对话准备工具和访问边界，不削弱现有默认配置",
      "Mac 本地 Gateway 自动安装：macOS 应用可自动安装和启动本地 Gateway，减少首次使用前的手动配置",
      "ClawRouter Provider 插件：内置凭证作用域动态模型发现、OpenAI 兼容和原生 Anthropic/Gemini 传输、跨用量面的预算报告",
      "Control UI 导航改进：会话优先侧边栏、紧凑上下文指示器、暖色浅色主题、推理力度滑块、斜杠命令选择器",
      "Ollama 本地推理节点自动发现",
      "Doctor 和诊断增强：暴露 auth-profile、工作空间、设备配对、通道插件、内存 Provider、systemd 耗尽和 Windows 防火墙发现",
      "Telegram 耐久性修复：恢复卡住的 ingress claims、重试重启丢失的媒体、存活瞬态轮询错误、保留转发富文本",
      "Agent 和上下文可靠性：保留运行时覆盖和引导的子代理任务、改善 harness 感知的上下文估计和压缩预检",
      "Provider 和网络安全：约束跨 Moonshot/MiniMax/Anthropic OAuth/Discord/Matrix 等路径的超大或畸形响应",
      "Cron 正确性：超时时保留 Provider 和模型选择、保留启动追赶延迟、清除空白 thinking 覆盖"
    ]
  },
  {
    project: "hermes-agent",
    version: "0.18.1",
    date: "2026-07-08",
    tag: "v2026.7.7",
    url: "https://github.com/NousResearch/hermes-agent/releases/tag/v2026.7.7",
    prerelease: false,
    highlights_zh: [
      "基础设施补丁版本：汇总 v0.18.0 以来约 660 个 PR，含安装器/更新器 Windows 自修复、仪表板和网关修复、WhatsApp 仪表板配对、MCP 和 Provider 修复等大量稳定性工作",
      "667 个提交、约 990 个文件变更（+89.5k/-10.4k 行），完整策划发布说明将在 v0.19.0 中发布"
    ]
  },
  {
    project: "hermes-agent",
    version: "0.18.2",
    date: "2026-07-08",
    tag: "v2026.7.7.2",
    url: "https://github.com/NousResearch/hermes-agent/releases/tag/v2026.7.7.2",
    prerelease: false,
    highlights_zh: [
      "WhatsApp Baileys 依赖修复：解除 git commit 固定版本，改用已发布的 npm 包 7.0.0-rc13，确保安装和 Docker 镜像构建可靠性"
    ]
  },
];
