"""共享基础层:时区常量 + 日报/周报共用的 Markdown 渲染

docs/*.md 是系统的事实数据源(周报与站点都从中重建数据),论文块的
渲染格式是读写两侧的契约,只能在这里改。
"""

import re
from pathlib import Path
from datetime import timezone, timedelta
from typing import Dict, List, Optional

# 北京时间,全项目唯一定义处
CN_TZ = timezone(timedelta(hours=8))

DOCS_DIR = Path(__file__).parent.parent / "docs"

INDEX_HISTORY_HEADER = "## 历史记录\n\n"
DEFAULT_INDEX = f"# 📄 AI Paper Daily\n\n每日论文发现与推送\n\n{INDEX_HISTORY_HEADER}"

_CODE_TAG_SUFFIX = re.compile(r"(\s*📦代码)+$")


def render_paper_md(paper: Dict, ordinal: int) -> str:
    """渲染单篇论文的 Markdown 块(标题/理由/摘要/链接)。

    标题先剥离已有的『 📦代码』后缀再按 has_code 追加,
    防止周报重渲染日报标题时出现双标签(weekly-2026-W34 bug)。
    """
    title = _CODE_TAG_SUFFIX.sub("", paper["title"]).strip()
    code_tag = " 📦代码" if paper.get("has_code") else ""

    lines = [
        f"## {ordinal}. {title}{code_tag}\n",
        f"_{paper.get('reason', '')}_\n",
    ]

    if paper.get("abstract"):
        lines.append(f"> {paper['abstract'][:200]}...\n")

    links = []
    if paper.get("url"):
        links.append(f"[📄 论文]({paper['url']})")
    if paper.get("pdf_url"):
        links.append(f"[📥 PDF]({paper['pdf_url']})")
    if paper.get("code_url"):
        links.append(f"[💻 代码]({paper['code_url']})")
    lines.append(" | ".join(links))
    lines.append("")
    return "\n".join(lines)


def render_report(papers: List[Dict], title: str,
                  header_extra: Optional[str] = None,
                  footer_extra: Optional[str] = None) -> str:
    """渲染完整报告 Markdown:标题 + 可选导语 + 论文块 + 页脚"""
    lines = [f"# {title}\n"]
    if header_extra:
        lines.append(f"{header_extra}\n")
    for i, p in enumerate(papers, 1):
        lines.append(render_paper_md(p, i))

    footer = "\n---\n"
    if footer_extra:
        footer += f"{footer_extra}\n\n"
    footer += "_由 [AI Paper Daily](https://github.com/alloevil/AI-Paper-Daily) 自动生成_"
    lines.append(footer)
    return "\n".join(lines)


def prepend_index_entry(entry: str):
    """在 docs/index.md 的『## 历史记录』开头插入新条目(已存在则跳过)"""
    index_path = DOCS_DIR / "index.md"
    existing = (index_path.read_text(encoding="utf-8")
                if index_path.exists() else DEFAULT_INDEX)
    if entry in existing or INDEX_HISTORY_HEADER not in existing:
        return
    existing = existing.replace(INDEX_HISTORY_HEADER,
                                f"{INDEX_HISTORY_HEADER}{entry}")
    index_path.write_text(existing, encoding="utf-8")
