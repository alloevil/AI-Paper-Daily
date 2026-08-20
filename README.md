<div align="center">

# 📄 AI Paper Daily

**Automated daily discovery of cutting-edge AI papers, delivered to Feishu / Email**

[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/alloevil/AI-Paper-Daily/daily.yml?label=daily%20discovery&logo=github-actions&logoColor=white)](https://github.com/alloevil/AI-Paper-Daily/actions)
[![License](https://img.shields.io/github/license/alloevil/AI-Paper-Daily)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11+-blue?logo=python&logoColor=white)](https://www.python.org/)
[![Stars](https://img.shields.io/github/stars/alloevil/AI-Paper-Daily?style=social)](https://github.com/alloevil/AI-Paper-Daily/stargazers)
[![GitHub Pages](https://img.shields.io/badge/🌐_Website-GitHub_Pages-6366f1?logo=githubpages&logoColor=white)](https://alloevil.github.io/AI-Paper-Daily/)

🌐 [Live Website](https://alloevil.github.io/AI-Paper-Daily/) · [Quick Start](#-quick-start) · [How It Works](#-how-it-works) · [Configuration](#-configuration) · [Custom Sources](#-custom-sources)

</div>

---

Spending 10 minutes a day scrolling through papers? Too much work. **AI Paper Daily** automates it: collect → filter → deliver. You only read the highlights.

## ✨ Why AI Paper Daily

| Feature | Description |
|:---|:---|
| 🔍 **Multi-source** | arXiv API + HuggingFace Daily Papers |
| 🤖 **AI Filtering** | LLM-powered semantic filtering, not just keyword matching |
| 📬 **Multi-channel** | Feishu messages / Email subscriptions / GitHub Pages |
| 🏷️ **Smart Tags** | Auto-categorize by Agent, RAG, Knowledge Graph, LLM, etc. |
| 📊 **Code First** | Prioritize papers with open-source code for easy reproduction |
| 🆓 **Zero Cost** | Runs on GitHub Actions, no server needed. Just fork and go |

## 📦 Preview

<details>
<summary>📱 Feishu delivery (click to expand)</summary>

```
📄 Paper Daily | 2026.06.26 (Thu)

1. AgentBench: Evaluating LLMs as Agents 📦Code 👍128
   A unified benchmark for evaluating LLMs as agents across 8 task environments
   [Paper] | [PDF] | [Code]

2. Self-RAG: Learning to Retrieve, Generate, and Critique 📦Code 👍95
   Improves RAG quality via self-reflection without additional training data
   [Paper] | [PDF] | [Code]

...

10 papers total | Powered by AI Paper Daily
```

</details>

<details>
<summary>📧 Email delivery (click to expand)</summary>

Responsive HTML email with dark mode support. Includes paper title, recommendation reason, and direct links.

</details>

## 🚀 Quick Start

### Step 1: Fork this repo

Click the **Fork** button in the top-right corner.

### Step 2: Configure Secrets

Go to `Settings → Secrets and variables → Actions` and add:

| Secret | Required | Description |
|:---|:---:|:---|
| `LLM_API_KEY` | ✅ | LLM API Key (for filtering & summarization) |
| `LLM_BASE_URL` | ⬚ | LLM API endpoint (default: `https://api.openai.com/v1`) |
| `FEISHU_WEBHOOK` | ⬚ | Feishu bot webhook URL |
| `SMTP_HOST` | ⬚ | SMTP server address |
| `SMTP_PORT` | ⬚ | SMTP SSL port (default: `465`) |
| `SMTP_USER` | ⬚ | Email account |
| `SMTP_PASS` | ⬚ | Email password / app password |

> 💡 **Minimum setup**: Only `LLM_API_KEY` is required. Papers will be committed as markdown reports and published as GitHub Pages.

### Step 3: Enable Actions

Go to `Actions`, click **"I understand my workflows, go ahead and enable them"**.

### Step 4: Customize keywords (optional)

Edit `config.yaml` to set your research interests:

```yaml
keywords:
  - "LLM agent"
  - "knowledge graph"
  - "RAG retrieval augmented generation"
  - "multi-agent system"
```

### Step 5: Test it

Go to `Actions → Daily AI Paper Daily → Run workflow` and trigger a manual run.

## 🔧 How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Actions                        │
│               (Daily at 12:00 Beijing Time)              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  arXiv   │  │ Hugging  │  │ Papers   │   Collection │
│  │   API    │  │  Face    │  │ With Code│              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │             │             │                     │
│       └──────┬──────┴──────┬──────┘                     │
│              ▼             ▼                            │
│         ┌────────┐   ┌──────────┐                      │
│         │  Dedup │   │ AI Filter│   Filtering           │
│         │        │   │ & Summary│                      │
│         └────┬───┘   └────┬─────┘                      │
│              └──────┬─────┘                             │
│                     ▼                                   │
│         ┌──────────────────┐                            │
│         │ Markdown Reports │   Persistence              │
│         │ (docs/*.md, git) │                            │
│         └────────┬─────────┘                            │
│                  ▼                                      │
│    ┌─────────────┼─────────────┐                        │
│    ▼             ▼             ▼                        │
│ ┌──────┐   ┌──────────┐   ┌────────┐                   │
│ │Feishu│   │  Email   │   │ GitHub │   Delivery        │
│ │Webhook│  │  SMTP    │   │ Pages  │                   │
│ └──────┘   └──────────┘   └────────┘                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Collection

- **arXiv**: Query via API with keyword + category combinations; fetch window widens automatically on Sunday/Monday to cover the weekend publishing gap
- **HuggingFace**: Scrape Daily Papers hot list, includes community upvotes

### Filtering

Candidate papers are sent to an LLM for scoring based on:
1. Relevance to your keywords
2. Novelty and practical value
3. Availability of open-source code (prioritized)
4. Community votes / stars

Falls back to vote + star + code ranking when LLM is unavailable.

### Delivery

- **Feishu**: Interactive cards via Webhook, clean formatting
- **Email**: Responsive HTML with dark mode support
- **GitHub Pages**: Markdown reports, supports custom domains

## 📋 Configuration

Edit `config.yaml`:

```yaml
# ── Keywords & Categories ──────────────────────
keywords:
  - "LLM agent"
  - "knowledge graph"
  - "RAG retrieval augmented generation"
  - "multi-agent system"
  - "tool use language model"
  - "agentic AI"

categories:        # arXiv categories (combined with keywords)
  - "cs.AI"        # Artificial Intelligence
  - "cs.CL"        # Computation and Language
  - "cs.IR"        # Information Retrieval
  - "cs.MA"        # Multiagent Systems

# ── Delivery Settings ──────────────────────────
max_papers: 10     # Max papers per day
language: "zh"     # zh=Chinese summary, en=English summary

# ── Data Sources ───────────────────────────────
sources:
  arxiv: true
  huggingface: true

# ── Delivery Channels ──────────────────────────
notify:
  feishu: true     # Requires FEISHU_WEBHOOK secret
  email: false     # Requires SMTP_* secrets

# ── Weekly Digest ──────────────────────────────
weekly: true            # Monday "top papers of the week" roundup
weekly_max_papers: 15   # Top N after re-ranking
```

## 📊 Weekly Digest

Every Monday the workflow runs `python scripts/main.py --weekly`: it rebuilds the
last 7 days of delivered papers from the committed daily reports (markdown is
the system's database), re-ranks them by votes / stars / open-source code,
and delivers a "Weekly Roundup" through the same channels as the daily run —
Feishu card, email, and a `docs/weekly-YYYY-WW.md` Pages report.

The weekly digest intentionally repeats papers already delivered daily (that's
the point), so it bypasses the daily push-log dedup. Disable it with
`weekly: false` in `config.yaml`, or trigger it manually via
**Actions → Run workflow → mode: weekly**.

## 📁 Project Structure

```
AI-Paper-Daily/
├── scripts/
│   ├── sources/              # Data source collectors
│   │   ├── arxiv_source.py   # arXiv API
│   │   └── huggingface_source.py  # HuggingFace Daily Papers
│   ├── filter.py             # AI filtering & summarization
│   ├── common.py             # Shared renderer (paper block / report / index) + CN_TZ
│   ├── notifier.py           # Delivery (Feishu cards / HTML email)
│   ├── reports.py            # Read layer: parse committed markdown reports
│   ├── storage.py            # Subscriber list (light file data)
│   ├── weekly.py             # Weekly digest (re-rank last 7 days)
│   └── main.py               # Entry point (--weekly for weekly mode)
├── tests/                    # Unit tests (python -m unittest discover tests)
├── config.yaml               # Configuration
├── data/                     # Data directory (auto-created)
├── docs/                     # GitHub Pages reports
└── .github/workflows/
    └── daily.yml             # CI/CD workflow
```

## 🔌 Custom Sources

Want to add a new paper source? Implement a collector function:

```python
# scripts/sources/my_source.py

def fetch_my_source(keywords: list[str], days: int = 2) -> list[dict]:
    """Fetch papers from a custom source"""
    papers = []
    # ... your collection logic ...

    for item in data:
        papers.append({
            "id": "unique_id",
            "title": "Paper Title",
            "abstract": "Abstract",
            "authors": ["Author List"],
            "url": "Paper URL",
            "pdf_url": "PDF URL",
            "published": "Publication Date",
            "source": "my_source",
            "categories": [],
            "has_code": True,
            "code_url": "GitHub URL",
            "votes": 0,
        })

    return papers
```

Then register it in `scripts/main.py`:

```python
from sources.my_source import fetch_my_source

# Add to collection phase
all_papers.extend(fetch_my_source(keywords, days=2))
```

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## ❓ FAQ

<details>
<summary><b>Q: How much does the LLM API cost?</b></summary>

One call per day, filtering ~50 papers uses ~2000-4000 tokens. With GPT-4o-mini that's about $0.001/day — essentially free.

</details>

<details>
<summary><b>Q: Which LLMs are supported?</b></summary>

Any OpenAI API-compatible service: OpenAI, Azure OpenAI, DeepSeek, Moonshot, local Ollama, etc. Just change `LLM_BASE_URL`.

</details>

<details>
<summary><b>Q: How to get a Feishu Webhook?</b></summary>

Feishu group → Settings → Group Bots → Add Bot → Custom Bot → Copy the Webhook URL.

</details>

<details>
<summary><b>Q: Can I change the delivery time?</b></summary>

Edit the `schedule_cron` field in `config.yaml`. Standard cron format (UTC). For example `0 6 * * *` = 14:00 Beijing Time.

</details>

<details>
<summary><b>Q: Where is the data stored?</b></summary>

The committed markdown reports under `docs/` are the system's database: the
daily run writes them, and the weekly digest and website rebuild everything by
parsing them back. `data/` only holds light files like the email subscriber list.

</details>

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

- 🐛 [Report a Bug](https://github.com/alloevil/AI-Paper-Daily/issues/new?template=bug_report.md)
- 💡 [Request a Feature](https://github.com/alloevil/AI-Paper-Daily/issues/new?template=feature_request.md)
- 🔧 [Submit a PR](https://github.com/alloevil/AI-Paper-Daily/pulls)

## 📄 License

[MIT](LICENSE) © [alloevil](https://github.com/alloevil)

---

<div align="center">

**Found it useful? Give it a ⭐ Star!**

[![Star History Chart](https://api.star-history.com/svg?repos=alloevil/AI-Paper-Daily&type=Date)](https://star-history.com/#alloevil/AI-Paper-Daily&Date)

</div>
