#!/usr/bin/env python3
"""AI Paper Daily - 每日论文发现与推送"""

import re
import sys
import yaml
from pathlib import Path
from datetime import datetime, timedelta

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent))

from common import CN_TZ, render_report, prepend_index_entry
from sources.arxiv_source import fetch_arxiv
from sources.huggingface_source import fetch_huggingface
from filter import filter_papers
from notifier import send_feishu, send_email
from storage import get_subscribers


def load_config() -> dict:
    """加载配置"""
    config_path = Path(__file__).parent.parent / "config.yaml"
    if config_path.exists():
        with open(config_path) as f:
            return yaml.safe_load(f)
    return {}


def norm_id(paper_id: str) -> str:
    """归一化论文 ID:去掉 arXiv 版本后缀（2608.06366v1 -> 2608.06366）"""
    return re.sub(r"v\d+$", "", paper_id or "")


def get_recent_pushed_ids(days: int = 7) -> set:
    """从最近 N 天的日报 Markdown 中提取已推送的 arXiv ID（归一化后）。

    日报文件已提交入库，跨 CI 运行持久——docs/*.md 就是系统的数据库。
    """
    docs_dir = Path(__file__).parent.parent / "docs"
    if not docs_dir.exists():
        return set()

    cutoff = datetime.now(CN_TZ) - timedelta(days=days)
    pushed = set()
    for md in docs_dir.glob("????-??-??.md"):
        try:
            file_date = datetime.strptime(md.stem, "%Y-%m-%d").replace(
                tzinfo=CN_TZ)
        except ValueError:
            continue
        if file_date < cutoff:
            continue
        for m in re.finditer(r"arxiv\.org/abs/([0-9.]+(?:v\d+)?)", md.read_text(encoding="utf-8")):
            pushed.add(norm_id(m.group(1)))
    return pushed


def fetch_windows(base_days: int, max_days: int) -> list:
    """候选不足时依次尝试的抓取窗口(天):基础窗口,+3 天,7 天,max_days,去重升序。"""
    wins = [base_days, base_days + 3, 7, max_days]
    out = []
    for d in wins:
        d = min(d, max_days)
        if d >= base_days and d not in out:
            out.append(d)
    return sorted(out)


def collect_candidates(keywords, categories, sources_config, days, recent_pushed) -> list:
    """抓取 days 天内的论文,多源去重(归一化 ID)并排除近 7 天已推送的。"""
    all_papers = []
    if sources_config.get("arxiv", True):
        try:
            all_papers.extend(fetch_arxiv(keywords, categories, max_results=100, days=days))
        except Exception as e:
            print(f"[arXiv] Failed: {e}")
    if sources_config.get("huggingface", True):
        try:
            all_papers.extend(fetch_huggingface(days=days))
        except Exception as e:
            print(f"[HuggingFace] Failed: {e}")

    seen = set()
    unique = []
    for p in all_papers:
        nid = norm_id(p["id"])
        if not nid or nid in seen:
            continue
        seen.add(nid)
        if nid in recent_pushed:
            continue
        unique.append(p)
    print(f"Total unique papers: {len(unique)} (excluded {len(seen) - len(unique)} already pushed)")
    return unique


def top_up(selected: list, candidates: list, min_papers: int) -> list:
    """selected 少于 min_papers 时,按热度从未选中的候选里补足(不超过 min_papers)。"""
    if len(selected) >= min_papers:
        return selected
    chosen = {norm_id(p["id"]) for p in selected}
    rest = [p for p in candidates if norm_id(p["id"]) not in chosen]
    rest.sort(key=lambda x: x.get("votes", 0) + x.get("stars", 0) + (10 if x.get("has_code") else 0),
              reverse=True)
    out = list(selected)
    for p in rest[: min_papers - len(selected)]:
        p.setdefault("reason", "补足")
        out.append(p)
    return out


def main():
    config = load_config()

    # 周报模式：python scripts/main.py --weekly
    if "--weekly" in sys.argv:
        from weekly import run_weekly
        run_weekly(config)
        return

    print(f"=== AI Paper Daily {datetime.now(CN_TZ).strftime('%Y-%m-%d %H:%M')} ===")

    keywords = config.get("keywords", ["LLM agent", "knowledge graph", "RAG"])
    categories = config.get("categories", ["cs.AI", "cs.CL"])
    max_papers = config.get("max_papers", 10)
    language = config.get("language", "zh")
    sources_config = config.get("sources", {})
    notify_config = config.get("notify", {})

    min_papers = config.get("min_papers", 4)
    max_fetch_days = config.get("max_fetch_days", 14)

    # 1+2. 多源采集 + 去重。
    # arXiv 周末不发布新论文,周日/周一默认窗口更宽;候选不足 min_papers 时逐步放宽窗口
    # (近 7 天已推送的仍被排除,所以放宽只会补入最近未收录的论文)。
    now_cn = datetime.now(CN_TZ)
    base_days = {0: 4, 6: 3}.get(now_cn.weekday(), 2)  # 周一=4天, 周日=3天, 其余=2天
    recent_pushed = get_recent_pushed_ids(days=7)
    unique_papers = []
    for days in fetch_windows(base_days, max_fetch_days):
        print(f"Fetch window: {days} days")
        unique_papers = collect_candidates(keywords, categories, sources_config, days, recent_pushed)
        if len(unique_papers) >= min_papers:
            break
        print(f"Only {len(unique_papers)} new candidates (< {min_papers}), widening window")

    if len(unique_papers) < min_papers:
        # 宁缺毋滥:不发不足 min_papers 篇的日报(与"空日报不提交"同理)
        print(f"Only {len(unique_papers)} new candidates within {max_fetch_days} days "
              f"(< min_papers {min_papers}); skipping today's digest")
        return

    # 3. AI 筛选;LLM 选得少于 min_papers 时按热度从剩余候选补足
    selected, filter_mode = filter_papers(unique_papers, keywords, max_papers, language)
    selected = top_up(selected, unique_papers, min_papers)
    if len(selected) < min_papers:
        print("Not enough papers selected after filtering; skipping today's digest")
        return

    # 4. 推送(推送去重靠已提交的日报 md,见 get_recent_pushed_ids;
    #    原 SQLite 保存/push_log 从未被读回,已随 #6 删除)
    if notify_config.get("feishu", True):
        send_feishu(selected)

    if notify_config.get("email", False):
        subscribers = get_subscribers()
        if subscribers:
            send_email(selected, subscribers)

    # 5. 生成 Markdown 报告（用于 GitHub Pages）
    today = datetime.now(CN_TZ).strftime("%Y-%m-%d")
    generate_report(selected, today, filter_mode)

    print(f"\n=== Done! Pushed {len(selected)} papers ===")

    # LLM 配置了 key 却调用失败：报告和推送已完成,但以非零退出码让 CI 标红
    if filter_mode == "error":
        print("[Main] AI filtering failed (see stderr); exiting non-zero", file=sys.stderr)
        sys.exit(1)


def generate_report(papers: list, date: str, filter_mode: str = "no-key"):
    """生成每日 Markdown 报告"""
    docs_dir = Path(__file__).parent.parent / "docs"
    docs_dir.mkdir(parents=True, exist_ok=True)

    weekday = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][
        datetime.strptime(date, "%Y-%m-%d").weekday()
    ]

    filter_label = {
        "ai": "AI 语义筛选",
        "no-key": "热度回退（未配置 LLM）",
        "error": "热度回退（AI 筛选失败）",
    }.get(filter_mode, "热度回退")

    content = render_report(
        papers,
        title=f"📄 论文日报 | {date}（{weekday}）",
        footer_extra=f"_本期筛选方式：{filter_label}_",
    )

    report_path = docs_dir / f"{date}.md"
    report_path.write_text(content, encoding="utf-8")

    # 更新 index.md
    prepend_index_entry(f"- [{date}（{weekday}）]({date}.md) - {len(papers)} 篇论文\n")

    print(f"[Report] Generated {report_path}")


if __name__ == "__main__":
    main()
