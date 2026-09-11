# 📄 AI Paper Daily

<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="AI Paper Daily pipeline: the arXiv API is queried by keyword × category across cs.AI, cs.CL, cs.IR and cs.MA and the HuggingFace Daily Papers hot list is fetched without keyword filtering, an LLM scores the candidates on keyword relevance, novelty, open-source code and community votes when LLM_API_KEY is set (without a key it falls back to a votes + open-code ranking, the mode every committed report records), up to 10 papers become the committed Markdown report docs/*.md, and every Monday scripts/main.py --weekly re-ranks the last 7 days into a top-15 weekly-YYYY-WW.md roundup. Cron: 0 4 * * * daily at 12:00 Beijing, 0 5 * * 1 Monday weekly at 13:00 Beijing.">
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
| 🤖 **AI Filtering** | One LLM selection pass per day when `LLM_API_KEY` is set; without a key the digest is a votes + open-code ranking (the mode used for every committed report) |
| 📬 **Multi-channel** | Feishu messages / Email subscriptions / GitHub Pages |
| 🏷️ **Smart Tags** | Tag each entry with its selection signal — 高票 / 有代码 / 最新论文 — and filter on those |
| 📊 **Code First** | Prioritize papers with open-source code for easy reproduction |
| 🆓 **No Server Cost** | Runs on GitHub Actions + GitHub Pages (free tier for public repos). `LLM_API_KEY` is optional; without it the digest uses the votes/upvotes + open-code fallback |

## 📦 Preview

<details>
<summary>📱 Feishu delivery (click to expand)</summary>

Rendered by `scripts/notifier.py` from `docs/2026-09-11.md` (first two of ten entries):

```
📄 **论文日报 | 2026.09.11（周五）**

**1. SenseNova-U1.5: Towards Native Unified Visual Intelligence** 📦代码 👍78
   高票/有代码
   [论文](https://arxiv.org/abs/2609.11929) | [PDF](https://arxiv.org/pdf/2609.11929)

**2. T1: Terminal Agent Reinforcement Learning for Long-Horizon Tasks** 📦代码 👍34
   高票/有代码
   [论文](https://arxiv.org/abs/2609.11042) | [PDF](https://arxiv.org/pdf/2609.11042)

…

_共 10 篇 | 由 AI Paper Daily 自动推送_
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
| `LLM_API_KEY` | ⬚ | LLM API Key (enables LLM selection; without it the digest falls back to a votes + open-code ranking) |
| `LLM_BASE_URL` | ⬚ | LLM API endpoint (default: `https://api.openai.com/v1`) |
| `FEISHU_WEBHOOK` | ⬚ | Feishu bot webhook URL |
| `SMTP_HOST` | ⬚ | SMTP server address |
| `SMTP_PORT` | ⬚ | SMTP SSL port (default: `465`) |
| `SMTP_USER` | ⬚ | Email account |
| `SMTP_PASS` | ⬚ | Email password / app password |

> 💡 **Minimum setup**: No secret is strictly required. With none set, papers are still selected (by votes and open-source code), committed as markdown reports and published as GitHub Pages. Add `LLM_API_KEY` if you want the LLM selection pass instead.

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
- **HuggingFace**: Fetch the Daily Papers hot list from HuggingFace's public JSON API (`https://huggingface.co/api/daily_papers`), including community upvotes. That list is chosen by HuggingFace — it is not filtered by your keywords or categories, only by the fetch window.

### Filtering

When `LLM_API_KEY` is set, the candidates go to the LLM in a single call that scores them on:
1. Relevance to your keywords
2. Novelty and practical value
3. Availability of open-source code (prioritized)
4. Community votes / stars

Without a key — or if the call fails — it falls back to a votes + open-code ranking (`stars` is never populated by either collector, so in practice the fallback is votes + code). The 19 committed reports that record their mode all show this no-key fallback (`_本期筛选方式：热度回退（未配置 LLM）_`), i.e. the published archive was produced with no key set.

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

python scripts/main.py            # one daily run (LLM_API_KEY optional; without it the run falls back to the votes/code ranking)
python scripts/main.py --weekly   # weekly roundup, re-ranked from the committed daily reports
python scripts/generate_site.py   # rebuild docs/: index.html, weekly pages, feed.xml, robots.txt, sitemap.xml
```

Running it as the intended automation needs no local install at all — fork the repo, enable Actions, and add `LLM_API_KEY` only if you want the LLM selection pass. See Quick Start above.

## When to use it

- You track LLM agents, RAG, knowledge graphs or multi-agent systems and want a short daily list instead of the arXiv firehose.
- You want papers with open-source code surfaced first — code availability is one of the scoring inputs and shows up as a tag.
- You want your own topic list: the keywords and arXiv categories in `config.yaml` are yours to edit, and the filter follows them — the LLM when a key is set, the votes/code ranking otherwise.
- You want the archive to be plain files. Every digest is committed Markdown, so it is greppable, diffable, and the site can be rebuilt from it.
- You want zero infrastructure: GitHub Actions, no server (an LLM key is optional — see above).

## When NOT to use it

- You need exhaustive coverage of a field. arXiv candidates must match the configured keyword × category query; HuggingFace entries are chosen by HuggingFace and are not filtered by your keywords or categories, only by their publish window. At most `max_papers` (10) survive per day (the committed archive runs 4–10). This is a sampler, not a literature review.
- You want a human-curated newsletter. Selection is one automated pass with no editor — an LLM pass when a key is set, a votes/code ranking otherwise — so a badly worded abstract can sink a good paper.
- You need the summaries to be authoritative. With a key the one-line reason is LLM-generated from the abstract (in Chinese by default); in the committed archive that line is only the selection tag. Either way it can flatten or misstate a paper's actual contribution — read the linked paper before citing it.
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
  - "knowledge base"
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

Since 2026-08 the workflow runs `python scripts/main.py --weekly` every Monday: it rebuilds the
last 7 days of delivered papers from the committed daily reports (markdown is
the system's database), re-ranks them by votes / stars / open-source code,
and delivers a "Weekly Roundup" through the same channels as the daily run —
Feishu card, email, and a `docs/weekly-YYYY-WW.md` Pages report. The archived
weekly reports are W34–W37; the earlier dailies predate the weekly mode.

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
│   ├── generate_site.py      # Site builder (index.html / weekly pages / feed.xml / robots.txt / sitemap.xml)
│   └── main.py               # Entry point (--weekly for weekly mode)
├── tests/                    # Unit tests (python -m unittest discover tests)
├── config.yaml               # Configuration
├── data/                     # Optional subscriber list (data/subscribers.txt read by storage.py; create it yourself)
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

Not measured here — the repo records no token counts, candidate counts or spend. The only code-level bounds are that each candidate abstract is truncated to 200 characters and the response is capped at 4000 tokens (`scripts/filter.py`), the arXiv fetch is capped at 100 results (`scripts/main.py`), and a run makes at most one LLM call. Cost therefore depends on your endpoint's pricing; it is zero if you leave `LLM_API_KEY` unset and keep the votes/code fallback.

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
