---
name: xiaomi-news-curation-filter
description: "Filtering heuristics and bilingual output format for curating daily news relevant to Xiaomi's business strategy — prioritizing policy, supply chain, competitive landscape, chip roadmaps, and macro indicators while excluding internal data and generic tech news."
---

# Xiaomi Daily News Curation Filter

A reference guide for selecting and formatting high-value news items from a
raw daily feed for Xiaomi strategic intelligence purposes.  The same logic
applies to any consumer-electronics OEM news pipeline.

---

## 1. Priority Tiers

Process candidate items top-down.  Stop when the target count is reached.

### Tier 1 — Must-Include (highest business impact)
| Category | Examples |
|---|---|
| Policy / tariff changes | Import/export duties, trade-war measures, VAT adjustments affecting components or finished goods |
| Supply-chain cost signals | Panel (OLED/LCD) pricing trends, DRAM/NAND contract prices, PMIC/RF component shortages or surpluses |
| Geopolitical logistics impacts | Port disruptions, sanctions on suppliers, shipping-lane closures |
| Macroeconomic indicators | PMI readings, CPI/PPI data, stagflation forecasts for key markets (China, India, EU, SEA) |

### Tier 2 — Include when quota allows
| Category | Examples |
|---|---|
| Competitive landscape shifts | Market-share realignments, category-level strategy pivots (not individual SKU launches) |
| Chip / foundry roadmaps | TSMC/Samsung node capacity, Qualcomm/MediaTek roadmap changes, HiSilicon re-entry signals |
| Platform / OS ecosystem moves | Android policy changes, app-store regulation, Google/Microsoft enterprise shifts |

### Tier 3 — Include only if quota not yet met
| Category | Examples |
|---|---|
| Broad consumer-sentiment trends | Survey data on upgrade cycles, brand-perception studies |
| Regulatory product-safety updates | New certification requirements in target markets |

---

## 2. Exclusion Rules

Discard any item that matches **any** of the following:

1. **Xiaomi-internal data** — press releases, earnings commentary, product
   announcements, or executive statements from Xiaomi itself.
2. **Competitor press releases / individual product launches** — e.g. "Samsung
   launches Galaxy S series" is not actionable unless it signals a price war
   or supply reallocation.
3. **Generic tech news without direct business impact** — e.g. AI hype
   articles, software-version changelogs, app reviews.
4. **Duplicate signals** — if two items cover the same underlying event, keep
   the one with the most specific data (numbers > narrative).
5. **Opinion / analysis pieces without primary data** — editorials that cite
   no original data source.

---

## 3. Target Output Volume

- **Minimum:** 8 items  
- **Maximum:** 12 items  
- If fewer than 8 Tier-1/2 items exist in the feed, surface the deficit to
  the operator rather than padding with low-value content.

---

## 4. Bilingual Output Format (Chinese + English)

Each item MUST be rendered in **both Simplified Chinese and English**.
Use the following template for every item:

```
### {序号}. {中文标题}
**English:** {English headline}

- **来源 / Source:** {publication name} — {YYYY-MM-DD}
- **分类 / Category:** {Tier category, e.g. 供应链成本 / Supply-Chain Cost}
- **摘要 / Summary (ZH):** {2–3 sentence Chinese summary}
- **Summary (EN):** {2–3 sentence English summary}
- **战略相关性 / Strategic Relevance:** {1 sentence explaining why this matters to Xiaomi}
```

Ordering: sort by **Tier first, then by recency** (newest first within tier).

---

## 5. Filtering Decision Checklist

For each candidate item, ask in sequence:

1. Does it contain a **concrete number, policy text, or named data point**?
   → No concrete data → likely Tier 3 or exclude.
2. Does the event **change a cost, constraint, or market-access condition**
   for Xiaomi or its direct supply chain?
   → Yes → Tier 1 or Tier 2.
3. Is the primary subject **Xiaomi itself** or a **competitor's product launch**?
   → Yes → Exclude (rules 1 & 2 above).
4. Has a materially identical story already been selected?
   → Yes → Exclude duplicate.
5. Does it affect **≥1 of Xiaomi's top-5 revenue markets** (China, India,
   Western Europe, SEA, LatAm)?
   → No → Deprioritize to Tier 3.

---

## 6. Integration Notes

- This filter is designed to run **after** raw feed collection (e.g. output
  of `daily_news.py`) and **before** final report assembly.
- Typical raw feed size: 100–200 candidate items.
- Expected selection rate: ~5–10 % of raw items pass to the final report.
- The prompt file driving LLM-assisted selection should embed these tier
  definitions verbatim so the model applies consistent criteria.

---

## 7. Example Application

```
Raw feed: 146 items
After exclusion rules: ~60 items remain
After tier ranking + dedup: 12 items selected
Output: bilingual report, sorted Tier1 → Tier2, newest-first within tier
```

Typical breakdown for a 12-item report:
- Tier 1 (Policy/Tariff + Supply Chain + Macro): 5–7 items
- Tier 2 (Competitive landscape + Chip roadmap): 3–4 items
- Tier 3 (Sentiment / regulatory): 1–2 items