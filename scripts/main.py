#!/usr/bin/env python3
"""AI Paper Daily - 每日论文发现与推送"""

import re
import sys
import yaml
from pathlib import Path
from datetime import datetime, timezone, timedelta

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent))

from sources.arxiv_source import fetch_arxiv
from sources.huggingface_source import fetch_huggingface
from filter import filter_papers
from notifier import send_feishu, send_email
from storage import save_papers, mark_pushed, log_push, get_subscribers


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

    日报文件已提交入库，跨 CI 运行持久，比一次性 runner 上的 SQLite 可靠。
    """
    docs_dir = Path(__file__).parent.parent / "docs"
    if not docs_dir.exists():
        return set()

    cutoff = datetime.now(timezone(timedelta(hours=8))) - timedelta(days=days)
    pushed = set()
    for md in docs_dir.glob("????-??-??.md"):
        try:
            file_date = datetime.strptime(md.stem, "%Y-%m-%d").replace(
                tzinfo=timezone(timedelta(hours=8)))
        except ValueError:
            continue
        if file_date < cutoff:
            continue
        for m in re.finditer(r"arxiv\.org/abs/([0-9.]+(?:v\d+)?)", md.read_text(encoding="utf-8")):
            pushed.add(norm_id(m.group(1)))
    return pushed


def main():
    config = load_config()

    # 周报模式：python scripts/main.py --weekly
    if "--weekly" in sys.argv:
        from weekly import run_weekly
        run_weekly(config)
        return

    print(f"=== AI Paper Daily {datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M')} ===")

    keywords = config.get("keywords", ["LLM agent", "knowledge graph", "RAG"])
    categories = config.get("categories", ["cs.AI", "cs.CL"])
    max_papers = config.get("max_papers", 10)
    language = config.get("language", "zh")
    sources_config = config.get("sources", {})
    notify_config = config.get("notify", {})

    # 1. 多源采集
    # arXiv 周末不发布新论文,周日/周一按需放宽时间窗口,避免空日报
    now_cn = datetime.now(timezone(timedelta(hours=8)))
    days = {0: 4, 6: 3}.get(now_cn.weekday(), 2)  # 周一=4天, 周日=3天, 其余=2天
    print(f"Fetch window: {days} days")

    all_papers = []

    if sources_config.get("arxiv", True):
        try:
            arxiv_papers = fetch_arxiv(keywords, categories, max_results=100, days=days)
            all_papers.extend(arxiv_papers)
        except Exception as e:
            print(f"[arXiv] Failed: {e}")

    if sources_config.get("huggingface", True):
        try:
            hf_papers = fetch_huggingface(days=days)
            all_papers.extend(hf_papers)
        except Exception as e:
            print(f"[HuggingFace] Failed: {e}")

    if not all_papers:
        print("No papers found, exiting")
        return

    # 2. 去重：当天多源去重（归一化 ID，arXiv 带 v1 后缀而 HF 不带）+ 排除近 7 天已推送
    recent_pushed = get_recent_pushed_ids(days=7)
    seen = set()
    unique_papers = []
    for p in all_papers:
        nid = norm_id(p["id"])
        if not nid or nid in seen:
            continue
        seen.add(nid)
        if nid in recent_pushed:
            continue
        unique_papers.append(p)
    print(f"Total unique papers: {len(unique_papers)} "
          f"(excluded {len(seen) - len(unique_papers)} already pushed)")

    if not unique_papers:
        print("All papers already pushed, exiting")
        return

    # 3. AI 筛选
    selected, filter_mode = filter_papers(unique_papers, keywords, max_papers, language)
    if not selected:
        print("No papers selected after filtering")
        return

    # 4. 保存到数据库
    new_count = save_papers(selected)
    print(f"Saved {new_count} new papers to database")

    # 5. 推送
    today = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d")

    if notify_config.get("feishu", True):
        if send_feishu(selected):
            mark_pushed([p["id"] for p in selected])
            log_push(today, len(selected), "feishu", "ok")
        else:
            log_push(today, len(selected), "feishu", "failed")

    if notify_config.get("email", False):
        subscribers = get_subscribers()
        if subscribers:
            if send_email(selected, subscribers):
                log_push(today, len(selected), "email", "ok")
            else:
                log_push(today, len(selected), "email", "failed")

    # 6. 生成 Markdown 报告（用于 GitHub Pages）
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

    lines = [
        f"# 📄 论文日报 | {date}（{weekday}）\n",
    ]

    for i, p in enumerate(papers, 1):
        source_emoji = {"arxiv": "📑", "huggingface": "🤗", "paperswithcode": "💻"}.get(
            p.get("source", ""), "📄"
        )
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

    filter_label = {
        "ai": "AI 语义筛选",
        "no-key": "热度回退（未配置 LLM）",
        "error": "热度回退（AI 筛选失败）",
    }.get(filter_mode, "热度回退")
    lines.append(f"\n---\n_本期筛选方式：{filter_label}_\n\n_由 [AI Paper Daily](https://github.com/alloevil/AI-Paper-Daily) 自动生成_")

    report_path = docs_dir / f"{date}.md"
    report_path.write_text("\n".join(lines), encoding="utf-8")

    # 更新 index.md
    index_path = docs_dir / "index.md"
    existing = index_path.read_text(encoding="utf-8") if index_path.exists() else "# 📄 AI Paper Daily\n\n每日论文发现与推送\n\n## 历史记录\n\n"
    # 在历史记录开头插入新条目
    entry = f"- [{date}（{weekday}）]({date}.md) - {len(papers)} 篇论文\n"
    if entry not in existing:
        existing = existing.replace("## 历史记录\n\n", f"## 历史记录\n\n{entry}")
        index_path.write_text(existing, encoding="utf-8")

    print(f"[Report] Generated {report_path}")


if __name__ == "__main__":
    main()
