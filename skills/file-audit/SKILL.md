---
name: file-audit
description: >
  审核加载的提示词文件（AGENTS.md/SOUL.md/IDENTITY.md/TOOLS.md 等），
  检查冲突、矛盾、重复、缺失。适用于：用户说"看下加载的文件"、"检查配置"、
  "有没有冲突"、"审核 prompt"、"清理配置"等场景。
applyTo: "**"
---

# 提示词文件审核 Skill

审核 workspace 和系统层的 bootstrap 文件，发现冲突、矛盾、重复和缺失。

---

## When to Use

| 场景 | 使用此 skill？ |
|---|---|
| 用户说"看下加载的文件" / "检查配置" | ✅ 是 |
| 用户说"有没有冲突" / "审核 prompt" | ✅ 是 |
| 用户说"清理配置" / "整理文件" | ✅ 是 |
| 用户只是问某个具体文件内容 | ❌ 否，直接 read |

---

## 审核流程

### Step 1: 扫描文件存在性

检查以下文件在 workspace 中是否存在且非空：

| 文件 | 必须存在 | 说明 |
|---|---|---|
| `AGENTS.md` | ✅ | 操作规则 |
| `SOUL.md` | ✅ | 人设与安全协议 |
| `IDENTITY.md` | ✅ | 身份定义 |
| `USER.md` | ✅ | 用户信息 |
| `MEMORY.md` | ⚠️ | 长期记忆（首次可为空） |
| `TOOLS.md` | ⚠️ | 工具笔记（可为空） |
| `HEARTBEAT.md` | ⚠️ | 心跳配置（可为空） |

### Step 2: 检查系统层加载

通过 hook 配置判断是否加载了系统层文件：

```bash
# 检查 bootstrap-agent-prompts hook 是否启用
grep -A2 "bootstrap-agent-prompts" ~/.openclaw/openclaw.json
```

如果启用，检查 `/app/xiaomi/prompts/` 下的同名文件是否与 workspace 文件存在语义冲突。

### Step 3: 跨文件一致性检查

检查以下维度的矛盾：

| 检查项 | 涉及文件 | 具体内容 |
|---|---|---|
| **语言规则** | SOUL.md 内部 | 是否重复定义了语言要求 |
| **人设一致性** | SOUL.md + IDENTITY.md | 名字、风格、emoji 是否一致 |
| **安全规则** | SOUL.md + AGENTS.md | 安全边界是否矛盾 |
| **心跳规范** | AGENTS.md + HEARTBEAT.md | 心跳处理逻辑是否一致 |
| **引用完整性** | AGENTS.md → TOOLS.md | 引用的文件是否有内容 |
| **新会话提醒** | AGENTS.md vs SOUL.md | "提醒用户" vs "拒绝说教" 张力 |

### Step 4: 内部重复检查

- SOUL.md 内是否有重复段落（如语言规则出现两次）
- AGENTS.md 内是否有重复规则
- IDENTITY.md 和 SOUL.md 是否重复定义同一属性

### Step 5: 输出报告

使用以下格式输出：

```markdown
## 📋 Prompt 文件审核报告

### ✅ 正常
- 列出无问题的文件和检查项

### ⚠️ 警告（不阻塞但建议修复）
- 重复定义：SOUL.md 语言规则出现 2 次
- 张力：AGENTS.md 要求新会话提醒 vs SOUL.md 拒绝说教

### ❌ 冲突（需要修复）
- 具体矛盾描述 + 文件位置 + 建议修复方案

### 📝 建议
- 可选的优化建议
```

---

## 快速执行

收到审核请求时，按以下步骤执行：

1. `read` 所有 workspace bootstrap 文件
2. `grep` 检查重复模式
3. 交叉比对关键属性
4. 输出审核报告
5. 如有冲突，提出修复方案

---

## 修复策略

| 类型 | 方式 |
|---|---|
| 内部重复 | 直接去重，保留一处 |
| 跨文件矛盾 | 明确哪个文件为准（通常 SOUL.md > AGENTS.md） |
| 系统层冲突 | 需用户决定：改 workspace 层或禁用系统层 |
| 缺失文件 | 提示创建或留空 |
