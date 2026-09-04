# Roadmap

> Moved from issue #1 on 2026-09-04. Issues are for bug reports and feature requests; the roadmap lives here. To pick up an item, open an issue referencing it.

## Where we are

- **Collection** — arXiv API (keyword × category queries, weekend gap widening) + HuggingFace Daily Papers (with community upvotes)
- **Filtering** — LLM semantic scoring on relevance / novelty / open-source code availability, with a vote+star+code ranking fallback when no LLM is configured
- **Delivery** — Feishu interactive cards, responsive dark-mode HTML email, GitHub Pages site with per-day reports, tag/date filter buttons and an RSS feed
- **Storage** — committed markdown reports (`docs/*.md`) are the database (written by the shared renderer, parsed back by `scripts/reports.py`); dedup across sources
- **Zero-cost operation** — daily GitHub Actions run, fork-and-go, only `LLM_API_KEY` required

## Roadmap

- [x] **Weekly digest mode** — a Monday "top papers of the week" roundup re-ranked from the SQLite history, for people who find daily too chatty (#2)
- [x] **Pages site: full-text search + linkable filter state** — the site already filters by tag and date; add a client-side search box and put filter state in the URL hash so filtered views can be shared (#3)
- [ ] **More sources** — OpenReview (accepted papers from ICLR/NeurIPS/ICML cycles) and Semantic Scholar API are the best-fit candidates for the collector interface documented in the README's Custom Sources section
- [ ] **Citation/follow-up tracking** — flag when a previously-delivered paper releases code or gets a big follow-up, using the committed markdown report history (the SQLite layer was removed in #6)
- [ ] **Telegram delivery channel** — same notifier interface as Feishu, frequently requested for non-Feishu users

### Product

From a product review (2026-08-21) — conversion and retention fixes for the Pages site:

- [ ] Pages site: add a subscription conversion entry point (#7)
- [x] Read-later list with BibTeX/Markdown export on the Pages site (#8)

### Tech debt

Structural issues from a code review — the weekly/storage items in particular affect data correctness, not just cleanliness:

- [x] Deduplicate daily/weekly markdown rendering into a shared render_paper_md (and a CN_TZ constant) (#4)
- [x] Weekly re-ranking degrades to date order in production; weekly report unreachable on Pages (#5)
- [x] Decide the SQLite layer's fate: dead write path on ephemeral CI, markdown is the real database (#6)

## Non-goals

- Full-text PDF analysis — filtering stays abstract-level to keep the daily run at ~$0.001
- A hosted multi-user service — fork-and-run on your own Actions is the model

Numbered items have dedicated issues; the rest are open for discussion here.
