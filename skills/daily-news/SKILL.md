---
name: daily-news
description: 每日科技情报任务。当 cron 触发"每日科技情报"任务，或用户要求手动执行今日新闻推送时使用。执行流程：运行 daily_news.py（自动抓 RSS + 读飞书表格 + 构建精筛 prompt）→ AI 语义精筛 → 飞书推送。
---

# Daily News Skill

## 概述

每日科技情报的完整执行链路，面向**小米公司领导**，筛选标准是**信息增量**（内部感知不到的才推）。

Skill 内已打包所有必要文件：
- `scripts/daily_news.py` — 主流程脚本（自动读飞书表格 + 抓 RSS + 构建精筛 prompt）
- `scripts/rss_fetch.py` — RSS 抓取脚本（12 个 RSS 源 + 百度搜索补充，并发抓取 + 当日缓存）
- `references/RSS新闻筛选项目.md` — 筛选标准和输出格式
- `references/rss_config.json` — RSS 源列表和关键词配置

---

## ⚙️ 安装前提

### Python 依赖
```bash
pip install feedparser
```

### Playwright + Chromium（可选，百度搜索补充源需要）
```bash
npx playwright install chromium
npx playwright install-deps chromium
```

---

## 执行步骤

### 唯一一步：运行脚本 + AI 精筛 + 推送

```bash
python3 <skill_dir>/scripts/daily_news.py > /tmp/daily_news_prompt.txt 2>/tmp/daily_news_log.txt
```

脚本会自动完成：
1. ✅ 读取飞书表格最近 50 条参考新闻（tenant token 硬编码，无需 Agent 手动操作）
2. ✅ 并发抓取 12 个 RSS 源 + 百度搜索补充源
3. ✅ 去重 + 反向噪音过滤 + 分类打标
4. ✅ 拼装完整精筛 prompt

Agent 只需：读取 `/tmp/daily_news_prompt.txt` → AI 精选 8-12 条 → `message` 推送给目标用户。

---

## 性能说明

- **并发抓取**：RSS 8 线程 + 百度 4 线程，总耗时约 5-10s
- **当日缓存**：RSS 结果缓存在 `/tmp/daily_news_cache/`，同天再触发秒返回
- **强制刷新**：`python3 scripts/rss_fetch.py --refresh`

---

## 筛选核心原则

**这条新闻的信息，接收者内部团队能不能直接感知到？**
- ✅ 感知不到 → 推送
- ❌ 已能感知 → 跳过

详细标准见 `references/RSS新闻筛选项目.md`。

---

## 输出格式

```
20260325

供应链成本
1. 英特尔和 AMD 通知 3-4 月 CPU 涨价
  - 来源：[36Kr](https://...)

====== English Daily Briefing ======

20260325

Supply Chain
1. Intel and AMD raise CPU prices for March-April
  - Source: [36Kr](https://...)
```

中英双语，`====== English Daily Briefing ======` 分隔，每条带来源链接，8-12 条。
