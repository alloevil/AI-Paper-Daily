# 📄 AI Paper Daily

<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="AI Paper Daily pipeline: the arXiv API and HuggingFace Daily Papers are collected across the cs.AI, cs.CL, cs.IR and cs.MA categories, an LLM scores every paper on keyword relevance, novelty, open-source code and community votes, the top 10 become the committed Markdown report docs/*.md, and every Monday scripts/main.py --weekly re-ranks the last 7 days into a top-15 weekly-YYYY-WW.md roundup. Cron: 04 * * * daily at 12:00 Beijing, 05 * * 1 Monday weekly at 13:00 Beijing.">
</p>

**AI Paper Daily** is an automated daily paper digest that collects, filters and summarises new AI research on LLM agents, RAG, knowledge graphs and multi-agent systems for people who cannot read arXiv every morning.

<div align="center">

**Automated daily discovery of cutting-edge AI papers, delivered to Feishu / Email**

[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/alloevil/AI-Paper-Daily/daily.yml?label=daily%20discovery&logo=github-actions&logoColor=white)](https://github.com/alloevil/AI-Paper-Daily/actions)
[![License](https://img.shields.io/github/license/alloevil/AI-Paper-Daily)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11+-blue?logo=python&logoColor=white)](https://www.python.org/)
[![Stars](https://img.shields.io/github/stars/alloevil/AI-Paper-Daily?style=social)](https://github.com/alloevil/AI-Paper-Daily/stargazers)
[![GitHub Pages](https://img.shields.io/badge/🌐_Website-GitHub_Pages-6366f1?logo=githubpages&logoColor=white)](https://alloevil.github.io/AI-Paper-Daily/)

🌐 [Live Website](https://alloevil.github.io/AI-Paper-Daily/) · [Quick Start](#-quick-start) · [How It Works](#-how-it-works) · [Configuration](#-configuration) · [Custom Sources](#-custom-sources)

</div>

---

## What it is

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
│  ┌──────────┐  ┌──────────┐                             │
│  │  arXiv   │  │ Hugging  │     Collection              │
│  │   API    │  │  Face    │                             │
│  └────┬─────┘  └────┬─────┘                             │
│       │             │                                   │
│       └──────┬──────┴──────┐                            │
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

## Install

Python 3.11 (the version the workflow pins). The only third-party dependency is PyYAML.

```bash
git clone https://github.com/alloevil/AI-Paper-Daily.git
cd AI-Paper-Daily
pip install -r requirements.txt

python scripts/main.py            # one daily run (needs LLM_API_KEY in the environment)
python scripts/main.py --weekly   # weekly roundup, re-ranked from the committed daily reports
python scripts/generate_site.py   # rebuild docs/: index.html, weekly pages, feed.xml, robots.txt, sitemap.xml
```

Running it as the intended automation needs no local install at all — fork the repo, add `LLM_API_KEY`, enable Actions. See Quick Start above.

## When to use it

- You track LLM agents, RAG, knowledge graphs or multi-agent systems and want a short daily list instead of the arXiv firehose.
- You want papers with open-source code surfaced first — code availability is one of the scoring inputs and shows up as a tag.
- You want your own topic list: the keywords and arXiv categories in `config.yaml` are yours to edit, and the LLM filter follows them.
- You want the archive to be plain files. Every digest is committed Markdown, so it is greppable, diffable, and the site can be rebuilt from it.
- You want zero infrastructure: GitHub Actions plus one LLM key, no server.

## When NOT to use it

- You need exhaustive coverage of a field. Only papers matching the configured keywords and categories can appear, capped at `max_papers` (10) per day, and the HuggingFace source only sees what is on its hot list. This is a sampler, not a literature review.
- You want a human-curated newsletter. Selection is one LLM scoring pass with no editor, so a badly worded abstract can sink a good paper.
- You need the summaries to be authoritative. They are LLM-generated from the abstract (in Chinese by default) and can flatten or misstate a paper's actual contribution — read the linked paper before citing it.
- You want each daily digest as its own web page. `docs/.nojekyll` disables Jekyll, so the dated files are served as raw Markdown (`2026-09-05.md` is 200, `2026-09-05.html` is 404); the HTML pages are the home page plus one page per week, and the daily content is inlined into the home page.
- You want reasoning about a paper beyond its abstract. It never fetches the PDF or the code — it works from titles, abstracts, categories, vote counts and whether a code link exists.
- You want delivery guarantees. GitHub Actions cron is best-effort; a dropped run means that day has no digest, and the workflow deliberately skips the commit rather than pushing an empty one.

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
<summary><b>Q: Which data sources does it actually use?</b></summary>

Two: the arXiv API (keyword × category search) and HuggingFace Daily Papers. They correspond one-to-one to `scripts/sources/arxiv_source.py` and `scripts/sources/huggingface_source.py`, and to the two switches under `sources:` in `config.yaml`. Papers With Code is **not** implemented — the name only appears in a source-to-emoji lookup in `scripts/notifier.py`. The site metadata used to list it and has been corrected.

</details>

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

Edit the `schedule` cron expressions in `.github/workflows/daily.yml` — `0 4 * * *` is the daily run (12:00 Beijing) and `0 5 * * 1` the Monday weekly roundup (13:00 Beijing). Standard cron format, UTC; for example `0 6 * * *` = 14:00 Beijing Time. `config.yaml` has no schedule field, only a pointer to the workflow.

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

---

<p align="center">
  <a href="https://github.com/oil-oil/beautify-github-readme"><img src="./assets/readme/made-with-beautify.svg" width="300" alt="README made with beautify-github-readme"></a>
</p>
