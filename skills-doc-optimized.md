# OpenClaw Skills 完全指南

<callout emoji="clipboard" background-color="light-blue">
整理时间：2026-03-23 ｜ 来源：docs.openclaw.ai、clawhub.ai、AgentSkills spec、本地实际 Skills
</callout>

## 本文档适合谁读

- **新手**：想了解 Skills 是什么、怎么快速上手
- **开发者**：想编写自定义 Skill 扩展 Agent 能力
- **运维/架构师**：需要管理、配置、发布 Skills

---

# 入门篇（5 分钟读完）

> 这一篇带你搞懂 Skill 的核心概念，看完就能理解它怎么工作。

## 一、Skill 是什么

**Skills 是模块化的知识包**，让 AI Agent 从「通用模型」变成「领域专家」。

类比关系：

<lark-table rows="3" cols="2" header-row="true" column-widths="350,350">
  <lark-tr>
    <lark-td>**概念**</lark-td>
    <lark-td>**作用**</lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>npm 包</lark-td>
    <lark-td>给 Node.js 项目加功能</lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>Skills</lark-td>
    <lark-td>给 AI Agent 加专业能力</lark-td>
  </lark-tr>
</lark-table>

每个 Skill 就是一个文件夹，核心是 `SKILL.md`，里面告诉 Agent：
1. **什么时候该用我**（description 触发机制）
1. **怎么用我**（Markdown 正文 = 操作指南）
1. **用什么工具**（scripts/references/assets 附件）

---

## 二、核心概念

### 2.1 结构（Anatomy）

```plaintext
skill-name/
├── SKILL.md              ← 必须，核心文件
│   ├── YAML frontmatter  ← name + description（触发条件）
│   └── Markdown body     ← 具体操作指南
├── scripts/              ← 可执行脚本（Python/Bash等）
├── references/           ← 参考文档（按需加载到上下文）
└── assets/               ← 输出资源（模板、图标等）
```

<callout emoji="key" background-color="light-yellow">
关键原则：渐进式加载（Progressive Disclosure）
</callout>

1. **元数据**（name + description）→ 始终在上下文中（~100 字）
1. **SKILL.md 正文**→ 触发后才加载（<5K 字）
1. **附件资源**→ Agent 自行决定是否需要

### 2.2 SKILL.md 最小结构

```yaml
---
name: weather
description: Get current weather and forecasts via wttr.in or Open-Meteo.
---
```

```markdown
# Weather

Use wttr.in for quick weather checks:
curl "wttr.in/Shanghai?format=3"
```

### 2.3 触发机制

Agent 在每个 turn 开始时，扫描所有 eligible skills 的 `name` + `description`，根据用户意图匹配。

<callout emoji="gift" background-color="light-red">
description 是唯一触发条件 — 正文里的「When to use」没用，因为正文要触发后才加载。
</callout>

### 2.4 可选 frontmatter 字段

<lark-table rows="7" cols="2" header-row="true" column-widths="350,350">
  <lark-tr>
    <lark-td>**字段**</lark-td>
    <lark-td>**作用**</lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>user-invocable</lark-td>
    <lark-td>是否暴露为用户斜杠命令（默认 true）</lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>disable-model-invocation</lark-td>
    <lark-td>排除模型触发，仅用户手动调用</lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>command-dispatch: tool</lark-td>
    <lark-td>斜杠命令直接调用工具，不经过模型</lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>metadata.openclaw.requires.bins</lark-td>
    <lark-td>需要的可执行文件</lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>metadata.openclaw.requires.env</lark-td>
    <lark-td>需要的环境变量</lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>metadata.openclaw.os</lark-td>
    <lark-td>限定操作系统</lark-td>
  </lark-tr>
</lark-table>

### 2.5 加载来源与优先级

```plaintext
workspace/skills/     ← 最高优先级（你的自定义）
  ↓ 覆盖
~/.openclaw/skills/   ← 中间层（全局共享）
  ↓ 覆盖
bundled skills        ← 最低（随安装包附带）
```

此外还可通过 `skills.load.extraDirs` 添加额外目录。

**常见 Bundled Skills（50+）**：`coding-agent`、`weather`、`healthcheck`、`skill-creator` 等。

**常见 Workspace Skills（飞书专用）**：`feishu-bitable`、`feishu-calendar`、`feishu-create-doc`、`feishu-task` 等。

---

# 进阶篇（10 分钟读完）

> 这一篇教你如何从零编写 Skill，掌握设计模式和 description 技巧。

## 三、5 分钟上手：创建你的第一个 Skill

跟着下面 3 步走，5 分钟内创建一个可用的 Skill。

### 3.1 第一步：创建目录结构

```bash
mkdir -p workspace/skills/my-first-skill
```

### 3.2 第二步：编写 SKILL.md

创建 `workspace/skills/my-first-skill/SKILL.md`：

```markdown
---
name: my-first-skill
description: 回显用户输入的 Skill，用于学习 Skill 结构。当用户说"测试skill"、"echo"时触发。
---

# My First Skill

这是一个学习用的 Skill。

## 用法
当用户输入内容时，直接回显用户说的话。
```

### 3.3 第三步：验证

```bash
openclaw skills list          # 确认 skill 出现在列表中
openclaw skills info my-first-skill  # 查看详情
```

<callout emoji="bulb" background-color="light-blue">
恭喜！你已经创建了一个 Skill。它的核心就是 frontmatter（触发条件）+ body（操作指南）。
</callout>

---

## 四、Skill 编写指南

### 4.1 设计原则

<lark-table rows="5" cols="2" header-row="true" column-widths="350,350">
  <lark-tr>
    <lark-td>**原则**</lark-td>
    <lark-td>**说明**</lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>简洁为王</lark-td>
    <lark-td>上下文窗口是公共资源，每多一行都有 token 成本</lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>假设 Agent 已经很聪明</lark-td>
    <lark-td>只补充 Agent 不知道的东西</lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>渐进式披露</lark-td>
    <lark-td>核心放 SKILL.md，细节放 references/</lark-td>
  </lark-tr>
  <lark-tr>
    <lark-td>合适的自由度</lark-td>
    <lark-td>高=纯文本指导 / 中=伪代码+参数 / 低=固定脚本</lark-td>
  </lark-tr>
</lark-table>

### 4.2 description 编写要点

这是触发 Skill 的**唯一机制**，必须：
- 描述 Skill 做什么
- 列出具体的触发场景/关键词
- 包含所有「何时使用」信息

<callout emoji="white_check_mark" background-color="light-green">
好的 description 示例
</callout>

```yaml
description: |
  飞书多维表格（Bitable）的创建、查询、编辑和管理工具。
  当以下情况时使用：
  (1) 需要创建或管理飞书多维表格 App
  (2) 需要在多维表格中新增、查询、修改、删除记录
  (3) 用户提到"多维表格"、"bitable"、"数据表"
```

<callout emoji="x" background-color="light-red">
差的 description 示例
</callout>

```yaml
description: "Feishu bitable tool"
```

### 4.3 参考设计模式

**模式 1：高层指南 + 按需引用**

```markdown
# PDF Processing
## Quick start
[核心代码示例]
## Advanced
- **Form filling**: See [references/FORMS.md]
```

**模式 2：按领域分文件**

```plaintext
bigquery-skill/
├── SKILL.md
└── references/
    ├── finance.md
    ├── sales.md
    └── product.md
```

**模式 3：条件加载**

```markdown
## Editing
Simple edits → 直接改 XML
**Tracked changes** → See [REDLINING.md]
```

---

## 五、常用 Skill 实例分析

> 通过从简到繁的实际案例，感受 Skill 设计的不同层次。

### 5.1 weather — 极简 Skill

```yaml
---
name: weather
description: Get current weather and forecasts. Use when user asks about weather.
---
```

```markdown
# Weather
Use wttr.in: curl "wttr.in/{city}?format=3"
Or Open-Meteo API for detailed forecasts.
```

<callout emoji="bulb" background-color="light-blue">
要点：description 触发 → 正文给出操作方案 → Agent 自行执行
</callout>

### 5.2 feishu-bitable — 中等复杂度

- description 列出 5 种触发场景
- 正文说明 27 种字段类型、高级筛选、批量操作
- 引用外部工具（feishu_bitable_app 系列）

### 5.3 coding-agent — 高复杂度

- 委托编码任务给 Codex/Claude Code
- 涉及子进程管理、PTY、权限模式
- 低自由度（固定命令格式）

### 5.4 skill-creator — 元 Skill

- 教 Agent 如何创建新 Skill
- 包含完整的 6 步流程
- 引用了设计模式参考文档

---

# 参考篇（按需查阅）

> 这一篇汇总了管理命令、配置细节、安全规则和成本考量，按需查阅即可。

## 六、Skill 管理

### 6.1 命令行管理

```bash
# 搜索
openclaw skills search "calendar"
clawhub search "postgres backups"

# 安装
openclaw skills install <slug>
clawhub install my-skill

# 更新
openclaw skills update --all
clawhub update my-skill

# 查看
openclaw skills list
openclaw skills list --eligible  # 只看符合条件的
openclaw skills info <name>

# 发布到 ClawHub
clawhub publish ./my-skill --slug my-skill --version 1.2.0
```

### 6.2 ClawHub（技能市场）

- 网址：[https://clawhub.com](https://clawhub.com)
- 类比：npm registry，但是给 AI Agent 的
- 命令：`npx clawhub@latest install <slug>`
- 支持版本管理、回滚、changelog

### 6.3 配置管理

```plaintext
// ~/.openclaw/openclaw.json
{
  skills: {
    entries: {
      "image-lab": {
        enabled: true,
        apiKey: "...",
        env: { GEMINI_API_KEY: "..." }
      },
      peekaboo: { enabled: true },
      sag: { enabled: false }
    },
    load: {
      extraDirs: ["~/shared-skills"],
      watch: true
    }
  }
}
```

---

## 七、安全注意事项

1. 第三方 Skill = **不可信代码**，启用前先读
1. `skills.entries.*.env` 注入到**宿主机**进程，不在沙箱中
1. 敏感信息不要放进 prompt 和日志
1. 用 `skills.allowBundled` 限制 bundled skills 白名单

---

## 八、Token 成本

Skill 列表注入系统提示的成本公式：

```plaintext
总字符数 = 195 + Σ(97 + len(name) + len(description) + len(location))
```

- 有 Skill 时基础开销：195 字符
- 每个 Skill 约：97 字符 + 实际字段长度
- 粗估：~24 tokens/Skill（不含字段内容）

<callout emoji="bar_chart" background-color="light-green">
实际影响：20 个 Skill ≈ 额外 ~500-1000 tokens，通常可以忽略。
</callout>

---

## 九、参考链接

- 官方文档：[https://docs.openclaw.ai/tools/skills](https://docs.openclaw.ai/tools/skills)
- 配置参考：[https://docs.openclaw.ai/tools/skills-config](https://docs.openclaw.ai/tools/skills-config)
- ClawHub 市场：[https://clawhub.com](https://clawhub.com)
- AgentSkills 规范：[https://agentskills.io](https://agentskills.io)
- GitHub：[https://github.com/clawdhub/openclaw](https://github.com/clawdhub/openclaw)
- Discord 社区：[https://discord.com/invite/clawd](https://discord.com/invite/clawd)

---

## 下一步行动

1. **动手试**：按「5 分钟上手」创建你的第一个 Skill，体验从零到一的完整流程
2. **读一个真 Skill**：打开 `workspace/skills/feishu-bitable/SKILL.md`，对照本文档理解它的结构和 description 设计
3. **发一个 Skill**：试着写一个解决你日常痛点的 Skill，发布到 ClawHub 让大家一起用
