"""周报模式 - 过去 7 天 top 论文汇总

从 SQLite 历史中取最近 7 天的论文,按 投票+星标+代码 复合分重排,
取 top N 生成周报(飞书/邮件/Pages 报告)。周报有意重复日报已推送
的论文——这正是它的价值——因此不经过日报的推送去重逻辑。

CI runner 上 papers.db 不持久(data/papers.db 在 .gitignore 中),
此时回退到解析已提交的日报 Markdown,与日报去重逻辑同一思路。
"""

import re
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Dict

from storage import get_papers_since, log_push, get_subscribers
from notifier import send_feishu, send_email

DOCS_DIR = Path(__file__).parent.parent / "docs"


def weekly_score(paper: Dict) -> int:
    """周报重排分：投票 + 星标 + 有代码加成（与 filter.py 的无 LLM 回退一致）"""
    return (paper.get("votes", 0) or 0) + (paper.get("stars", 0) or 0) + \
        (10 if paper.get("has_code") else 0)


def rank_papers(papers: List[Dict], top_n: int = 15) -> List[Dict]:
    """按周报分重排取 top N,同分按发布时间新者优先"""
    return sorted(
        papers,
        key=lambda p: (weekly_score(p), p.get("published") or ""),
        reverse=True,
    )[:top_n]


def papers_from_reports(days: int = 7) -> List[Dict]:
    """从最近 N 天的日报 Markdown 重建论文列表（CI 上 SQLite 不持久时的回退）"""
    from generate_site import parse_papers

    if not DOCS_DIR.exists():
        return []

    cutoff = datetime.now(timezone(timedelta(hours=8))) - timedelta(days=days)
    papers = []
    seen = set()
    for md in sorted(DOCS_DIR.glob("????-??-??.md"), reverse=True):
        try:
            file_date = datetime.strptime(md.stem, "%Y-%m-%d").replace(
                tzinfo=timezone(timedelta(hours=8)))
        except ValueError:
            continue
        if file_date < cutoff:
            continue
        for p in parse_papers(str(md)):
            links = p.get("links", {})
            url = links.get("paper", "")
            pid = re.sub(r"v\d+$", "", url.rsplit("/", 1)[-1]) if url else p["title"]
            if pid in seen:
                continue
            seen.add(pid)
            tag = p.get("tag", "")
            papers.append({
                "id": pid,
                "title": p["title"],
                "abstract": p.get("abstract", ""),
                "url": url,
                "pdf_url": links.get("pdf", ""),
                "code_url": links.get("code", ""),
                "has_code": bool(links.get("code")) or "有代码" in tag,
                "votes": 10 if "高票" in tag else 0,
                "stars": 0,
                "reason": tag,
                "published": md.stem,
                "source": "report",
            })
    return papers


def generate_weekly_report(papers: List[Dict], start: str, end: str,
                           total: int) -> Path:
    """生成周报 Markdown（docs/weekly-YYYY-WW.md),返回文件路径"""
    DOCS_DIR.mkdir(parents=True, exist_ok=True)

    iso = datetime.strptime(end, "%Y-%m-%d").isocalendar()
    week_label = f"{iso[0]}-W{iso[1]:02d}"

    lines = [
        f"# 📄 论文周报 | {week_label}（{start} ~ {end}）\n",
        f"过去 7 天共推送 {total} 篇论文，以下为按热度（投票 / 星标 / 开源代码）重排的 Top {len(papers)}：\n",
    ]

    for i, p in enumerate(papers, 1):
        code_tag = " 📦代码" if p.get("has_code") else ""
        lines.append(f"## {i}. {p['title']}{code_tag}\n")
        lines.append(f"_{p.get('reason', '')}_\n")
        if p.get("abstract"):
            lines.append(f"> {p['abstract'][:200]}...\n")
        links = []
        if p.get("url"):
            links.append(f"[📄 论文]({p['url']})")
        if p.get("pdf_url"):
            links.append(f"[📥 PDF]({p['pdf_url']})")
        if p.get("code_url"):
            links.append(f"[💻 代码]({p['code_url']})")
        lines.append(" | ".join(links))
        lines.append("")

    lines.append(f"\n---\n_由 [AI Paper Daily](https://github.com/alloevil/AI-Paper-Daily) 自动生成_")

    report_path = DOCS_DIR / f"weekly-{week_label}.md"
    report_path.write_text("\n".join(lines), encoding="utf-8")

    # 更新 index.md（与日报同样的历史记录条目风格）
    index_path = DOCS_DIR / "index.md"
    if index_path.exists():
        existing = index_path.read_text(encoding="utf-8")
        entry = f"- [📊 周报 {week_label}](weekly-{week_label}.md) - Top {len(papers)}\n"
        if entry not in existing and "## 历史记录\n\n" in existing:
            existing = existing.replace("## 历史记录\n\n", f"## 历史记录\n\n{entry}")
            index_path.write_text(existing, encoding="utf-8")

    print(f"[Weekly] Generated {report_path}")
    return report_path


def run_weekly(config: dict):
    """周报入口：取近 7 天论文 -> 重排 top N -> 报告 + 推送"""
    now_cn = datetime.now(timezone(timedelta(hours=8)))
    print(f"=== AI Paper Weekly {now_cn.strftime('%Y-%m-%d %H:%M')} ===")

    if not config.get("weekly", True):
        print("[Weekly] Disabled in config.yaml (weekly: false), exiting")
        return

    top_n = config.get("weekly_max_papers", 15)
    notify_config = config.get("notify", {})

    # 1. 取过去 7 天论文：优先 SQLite,CI 上 DB 不持久时回退日报 Markdown
    papers = get_papers_since(days=7)
    source = "sqlite"
    if not papers:
        papers = papers_from_reports(days=7)
        source = "markdown reports"
    print(f"[Weekly] {len(papers)} papers in the last 7 days (from {source})")

    if not papers:
        print("[Weekly] No papers in window, exiting")
        return

    # 2. 重排取 top N
    ranked = rank_papers(papers, top_n)
    print(f"[Weekly] Top {len(ranked)} after re-ranking")

    # 3. 生成周报 + 推送(绕过日报推送去重:周报有意重复日报内容)
    end = now_cn.strftime("%Y-%m-%d")
    start = (now_cn - timedelta(days=6)).strftime("%Y-%m-%d")
    generate_weekly_report(ranked, start, end, total=len(papers))

    title = f"论文周报 | {start} ~ {end}"
    if notify_config.get("feishu", True):
        status = "ok" if send_feishu(ranked, title=title) else "failed"
        log_push(end, len(ranked), "feishu-weekly", status)

    if notify_config.get("email", False):
        subscribers = get_subscribers()
        if subscribers:
            status = "ok" if send_email(ranked, subscribers,
                                        title="AI Paper Weekly") else "failed"
            log_push(end, len(ranked), "email-weekly", status)

    print(f"\n=== Done! Weekly roundup: {len(ranked)} papers ===")
