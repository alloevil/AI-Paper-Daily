#!/usr/bin/env python3
"""Paper Discovery - 每日论文发现与推送"""

import sys
import yaml
from pathlib import Path
from datetime import datetime, timezone, timedelta

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent))

from sources.arxiv_source import fetch_arxiv
from sources.huggingface_source import fetch_huggingface
from sources.paperswithcode_source import fetch_paperswithcode
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


def main():
    print(f"=== Paper Discovery {datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M')} ===")

    config = load_config()
    keywords = config.get("keywords", ["LLM agent", "knowledge graph", "RAG"])
    categories = config.get("categories", ["cs.AI", "cs.CL"])
    max_papers = config.get("max_papers", 10)
    language = config.get("language", "zh")
    sources_config = config.get("sources", {})
    notify_config = config.get("notify", {})

    # 1. 多源采集
    all_papers = []

    if sources_config.get("arxiv", True):
        try:
            arxiv_papers = fetch_arxiv(keywords, categories, max_results=50, days=2)
            all_papers.extend(arxiv_papers)
        except Exception as e:
            print(f"[arXiv] Failed: {e}")

    if sources_config.get("huggingface", True):
        try:
            hf_papers = fetch_huggingface(days=2)
            all_papers.extend(hf_papers)
        except Exception as e:
            print(f"[HuggingFace] Failed: {e}")

    if sources_config.get("paperswithcode", True):
        try:
            pwc_papers = fetch_paperswithcode(keywords, days=2, max_results=30)
            all_papers.extend(pwc_papers)
        except Exception as e:
            print(f"[PapersWithCode] Failed: {e}")

    if not all_papers:
        print("No papers found, exiting")
        return

    # 2. 去重（按 id）
    seen = set()
    unique_papers = []
    for p in all_papers:
        if p["id"] and p["id"] not in seen:
            seen.add(p["id"])
            unique_papers.append(p)
    print(f"Total unique papers: {len(unique_papers)}")

    # 3. AI 筛选
    selected = filter_papers(unique_papers, keywords, max_papers, language)
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
    generate_report(selected, today)

    print(f"\n=== Done! Pushed {len(selected)} papers ===")


def generate_report(papers: list, date: str):
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

    lines.append(f"\n---\n_由 [Paper Discovery](https://github.com/alloevil/paper-discovery) 自动生成_")

    report_path = docs_dir / f"{date}.md"
    report_path.write_text("\n".join(lines), encoding="utf-8")

    # 更新 index.md
    index_path = docs_dir / "index.md"
    existing = index_path.read_text(encoding="utf-8") if index_path.exists() else "# 📄 Paper Discovery\n\n每日论文发现与推送\n\n## 历史记录\n\n"
    # 在历史记录开头插入新条目
    entry = f"- [{date}（{weekday}）]({date}.md) - {len(papers)} 篇论文\n"
    if entry not in existing:
        existing = existing.replace("## 历史记录\n\n", f"## 历史记录\n\n{entry}")
        index_path.write_text(existing, encoding="utf-8")

    print(f"[Report] Generated {report_path}")


if __name__ == "__main__":
    main()
