# 📄 Paper Discovery

每日自动发现 Agent、RAG、知识图谱、知识库等领域的最新论文，支持飞书/邮件推送。

## ✨ 特性

- 🔍 **多源采集**：arXiv API + HuggingFace Daily Papers + Papers With Code
- 🤖 **AI 筛选**：LLM 语义过滤，只推送高价值论文
- 📬 **多渠道推送**：飞书消息 / 邮件订阅 / GitHub Pages
- 🏷️ **智能分类**：按 Agent、RAG、Knowledge Graph、LLM 等标签自动归类
- 📊 **代码优先**：优先推送有开源代码的论文
- 🆓 **完全免费**：基于 GitHub Actions 运行，无需服务器

## 🚀 快速开始

### 1. Fork 本仓库

### 2. 配置 Secrets（Settings → Secrets and variables → Actions）

| Secret | 说明 |
|--------|------|
| `LLM_API_KEY` | LLM API Key（用于论文筛选和摘要） |
| `LLM_BASE_URL` | LLM API 地址（可选，默认 OpenAI） |
| `FEISHU_WEBHOOK` | 飞书群机器人 Webhook（可选） |
| `SMTP_HOST` | 邮件服务器（可选） |
| `SMTP_USER` | 邮箱账号（可选） |
| `SMTP_PASS` | 邮箱密码（可选） |

### 3. 启用 GitHub Actions

进入 Actions 页面，启用 Workflow。

### 4. 自定义关键词

编辑 `config.yaml` 修改你关注的研究方向。

## 📁 项目结构

```
paper-discovery/
├── scripts/
│   ├── sources/          # 数据源采集器
│   │   ├── arxiv.py      # arXiv API
│   │   ├── huggingface.py # HuggingFace Daily Papers
│   │   └── paperswithcode.py # Papers With Code
│   ├── filter.py         # AI 筛选和摘要
│   ├── notifier.py       # 推送（飞书/邮件）
│   ├── storage.py        # 数据存储（SQLite + JSON）
│   └── main.py           # 入口
├── config.yaml           # 配置文件
├── data/                 # 数据目录
├── docs/                 # GitHub Pages
└── .github/workflows/    # CI/CD
```

## 📋 配置说明

编辑 `config.yaml`：

```yaml
# 关注的关键词
keywords:
  - "LLM agent"
  - "knowledge graph"
  - "RAG retrieval augmented"
  - "knowledge base"
  - "multi-agent"
  - "tool use LLM"

# 每日推送数量
max_papers: 10

# 推送时间（UTC）
schedule_cron: "0 4 * * *"  # 北京时间 12:00

# 语言偏好
language: "zh"  # zh=中文摘要, en=英文摘要
```

## 🤝 Contributing

欢迎提交 PR 添加新的数据源！

## 📄 License

MIT
