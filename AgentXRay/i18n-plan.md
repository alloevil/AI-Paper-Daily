# AgentXRay i18n PR Plan

## 目标
给 AgentXRay 添加中英文国际化支持（i18n），让中文用户也能无障碍使用。

## 设计原则
1. **零依赖** — 项目风格是零框架零 CDN，i18n 也不引入任何库
2. **最小侵入** — 语言包内联在 `index.html` 的 `<script>` 中，不新增文件请求
3. **自动检测 + 手动切换** — 默认跟随浏览器语言，同时在 Settings 面板提供语言选择
4. **持久化** — 语言偏好保存到 localStorage

## 需要翻译的文本清单

### HTML 静态文本
| 位置 | 英文原文 | 中文翻译 |
|------|---------|---------|
| sidebar h1 | AgentXRay | AgentXRay |
| search placeholder | Filter sessions | 搜索会话 |
| toggle | Include archived | 包含已归档 |
| toggle | Auto-refresh | 自动刷新 |
| toggle | Auto-scroll | 自动滚动 |
| main h2 | No session selected | 未选择会话 |
| main meta | Select an agent and session from the left. | 从左侧选择一个 Agent 和会话 |
| empty | Session messages will appear here. | 会话消息将在此显示 |
| settings h2 | Settings | 设置 |
| settings label | OpenClaw Directory | OpenClaw 目录 |
| settings label | Codex Directory | Codex 目录 |
| settings label | Claude Code Directory | Claude Code 目录 |
| settings btn | Reset to Defaults | 恢复默认 |
| settings btn | Save | 保存 |
| settings btn (gear) | Settings | 设置 |
| loading | Loading… | 加载中… |

### JS 动态文本
| 变量/位置 | 英文原文 | 中文翻译 |
|-----------|---------|---------|
| platformLabels | OpenClaw sessions | OpenClaw 会话 |
| platformLabels | Codex sessions | Codex 会话 |
| platformLabels | Claude Code sessions | Claude Code 会话 |
| no sessions | No sessions match this filter. | 没有匹配的会话 |
| formatDate fallback | Unknown time | 未知时间 |
| tool toggle | toggle | 展开/收起 |
| spawn link | View sub-agent log → | 查看子 Agent 日志 → |
| spawn link | View execution output ↓ | 查看执行输出 ↓ |
| expand btn | Show all | 显示全部 |
| load more | Load earlier messages | 加载更早的消息 |
| tool call | tool | 工具 |
| tool result | tool result | 工具结果 |
| summary labels | Messages / Tools / Tokens / Duration / Top Tools / Slowest Turn | 消息 / 工具 / Token / 时长 / 热门工具 / 最慢轮次 |
| badge | active / archived | 活跃 / 已归档 |
| breadcrumb | Parent → | 父级 → |
| graph tooltip | User · / Assistant · / Reasoning · | 用户 · / 助手 · / 推理 · |
| SPAWN badge | SPAWN | 子代理 |
| role labels | USER / ASSISTANT / TOOL RESULT / REASONING | 用户 / 助手 / 工具结果 / 推理 |
| error prefix | Error | 错误 |

## 实现方案

### 1. 语言包对象（内联在 script 中）

```javascript
const I18N = {
  en: {
    filterSessions: 'Filter sessions',
    includeArchived: 'Include archived',
    autoRefresh: 'Auto-refresh',
    autoScroll: 'Auto-scroll',
    noSessionSelected: 'No session selected',
    selectHint: 'Select an agent and session from the left.',
    emptyMessages: 'Session messages will appear here.',
    settings: 'Settings',
    openclawDir: 'OpenClaw Directory',
    codexDir: 'Codex Directory',
    claudeCodeDir: 'Claude Code Directory',
    resetDefaults: 'Reset to Defaults',
    save: 'Save',
    loading: 'Loading…',
    noMatch: 'No sessions match this filter.',
    unknownTime: 'Unknown time',
    toggle: 'toggle',
    showAll: 'Show all',
    loadEarlier: 'Load earlier messages',
    active: 'active',
    archived: 'archived',
    spawn: 'SPAWN',
    viewSubAgent: 'View sub-agent log →',
    viewExecOutput: 'View execution output ↓',
    user: 'USER',
    assistant: 'ASSISTANT',
    toolResult: 'TOOL RESULT',
    reasoning: 'REASONING',
    messages: 'Messages',
    tools: 'Tools',
    tokens: 'Tokens',
    duration: 'Duration',
    topTools: 'Top Tools',
    slowestTurn: 'Slowest Turn',
    language: 'Language',
    platformOpenClaw: 'OpenClaw sessions',
    platformCodex: 'Codex sessions',
    platformClaudeCode: 'Claude Code sessions',
  },
  'zh-CN': {
    filterSessions: '搜索会话',
    includeArchived: '包含已归档',
    autoRefresh: '自动刷新',
    autoScroll: '自动滚动',
    noSessionSelected: '未选择会话',
    selectHint: '从左侧选择一个 Agent 和会话',
    emptyMessages: '会话消息将在此显示',
    settings: '设置',
    openclawDir: 'OpenClaw 目录',
    codexDir: 'Codex 目录',
    claudeCodeDir: 'Claude Code 目录',
    resetDefaults: '恢复默认',
    save: '保存',
    loading: '加载中…',
    noMatch: '没有匹配的会话',
    unknownTime: '未知时间',
    toggle: '展开/收起',
    showAll: '显示全部',
    loadEarlier: '加载更早的消息',
    active: '活跃',
    archived: '已归档',
    spawn: '子代理',
    viewSubAgent: '查看子 Agent 日志 →',
    viewExecOutput: '查看执行输出 ↓',
    user: '用户',
    assistant: '助手',
    toolResult: '工具结果',
    reasoning: '推理',
    messages: '消息',
    tools: '工具',
    tokens: 'Token',
    duration: '时长',
    topTools: '热门工具',
    slowestTurn: '最慢轮次',
    language: '语言',
    platformOpenClaw: 'OpenClaw 会话',
    platformCodex: 'Codex 会话',
    platformClaudeCode: 'Claude Code 会话',
  }
};
```

### 2. 核心 i18n 函数

```javascript
const I18N_KEY = 'agent-xray-lang';

function detectLanguage() {
  const saved = localStorage.getItem(I18N_KEY);
  if (saved && I18N[saved]) return saved;
  const nav = navigator.language || 'en';
  if (nav.startsWith('zh')) return 'zh-CN';
  return 'en';
}

function t(key) {
  const lang = state.language || 'en';
  return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
}

function setLanguage(lang) {
  state.language = lang;
  localStorage.setItem(I18N_KEY, lang);
  applyI18n();
}

function applyI18n() {
  // Update all data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  // Re-render dynamic content
  renderAgents();
  renderSessions();
}
```

### 3. Settings 面板新增语言选择

在 Settings 面板的最前面加一个 Language 下拉：

```html
<div class="settings-field">
  <label data-i18n="language">Language</label>
  <select id="settingLanguage" class="agent-select">
    <option value="en">English</option>
    <option value="zh-CN">简体中文</option>
  </select>
</div>
```

### 4. HTML 标记方式

静态文本用 `data-i18n` 属性标记：

```html
<h2 data-i18n="noSessionSelected">No session selected</h2>
<input data-i18n-placeholder="filterSessions" placeholder="Filter sessions">
<button data-i18n-title="settings" title="Settings">⚙</button>
```

### 5. 修改清单

| 文件 | 改动 |
|------|------|
| `public/index.html` | 添加 I18N 对象、t() 函数、语言检测/切换逻辑；HTML 元素加 data-i18n 属性；Settings 面板加语言选择；所有硬编码字符串改为 t() 调用 |
| `README.md` | 补充 i18n 说明段落 |

### 6. PR 信息

**Title:** feat: add i18n support (English + Simplified Chinese)

**Description:**
This PR adds internationalization (i18n) support to AgentXRay.

- Zero external dependencies — language packs are inlined in `index.html`
- Auto-detects browser language (Chinese browsers default to zh-CN)
- Manual language switch in Settings panel, persisted to localStorage
- All UI text strings extracted into language packs
- Currently supports: English (en) and Simplified Chinese (zh-CN)
- Easy to extend: just add a new key to the `I18N` object

Closes #N/A (no existing issue — will open one first)
