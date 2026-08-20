"""Markdown 报告读取层 — docs/*.md 是系统唯一的事实数据源

日报/周报由 common.render_report 写入、提交入库,跨 CI 运行持久;
本模块把它们解析回结构化论文数据,供站点生成与周报重排使用。
写侧(common.py)与读侧(本模块)共同构成 md-as-database 的契约,
两侧的格式变更必须同步。
"""

import re


def parse_papers(filepath: str) -> list[dict]:
    """Parse a daily/weekly report md file and return a list of paper dicts."""
    with open(filepath, encoding="utf-8") as f:
        content = f.read()

    papers = []
    # Split by ## N. headers
    sections = re.split(r'^## \d+\.\s+', content, flags=re.MULTILINE)

    for section in sections[1:]:  # skip the first part (title before ## 1.)
        paper = {}

        # Title: first non-empty line
        lines = section.strip().split('\n')
        if not lines:
            continue
        title = lines[0].strip()
        # 剥离日报标题里拼接的展示性标签（如 " 📦代码"），
        # 避免污染回流到站点/RSS/周报（周报双标签的根因）
        title = re.sub(r'(\s*📦代码)+$', '', title).strip()
        paper['title'] = title

        # Tag: look for _italic text_ on its own line
        tag_match = re.search(r'^\s*_(.+?)_\s*$', section, re.MULTILINE)
        tag = tag_match.group(1).strip() if tag_match else ''
        # Votes: numeric upvote appended by the renderer (『高票/有代码 👍128』)。
        # 历史日报没有该数值,缺省 0。剥离后 tag 保持纯文本,
        # 避免污染站点过滤按钮与周报 reason。
        votes_match = re.search(r'👍(\d+)', tag)
        paper['votes'] = int(votes_match.group(1)) if votes_match else 0
        tag = re.sub(r'\s*👍\d+', '', tag).strip()
        paper['tag'] = tag

        # Abstract: blockquote text
        abstract_lines = []
        for line in section.split('\n'):
            line_stripped = line.strip()
            if line_stripped.startswith('> '):
                abstract_lines.append(line_stripped[2:])
        paper['abstract'] = ' '.join(abstract_lines).strip()
        # Truncate long abstracts
        if len(paper['abstract']) > 300:
            paper['abstract'] = paper['abstract'][:297] + '...'

        # Links: extract from the link line
        links = {}
        # Find all markdown links
        for m in re.finditer(r'\[(📄 论文|📥 PDF|💻 代码)\]\(([^)]+)\)', section):
            label, url = m.group(1), m.group(2)
            if '论文' in label:
                links['paper'] = url
            elif 'PDF' in label:
                links['pdf'] = url
            elif '代码' in label:
                links['code'] = url
        paper['links'] = links

        # Relevance from tag
        tag = paper.get('tag', '')
        if '高票' in tag or '有代码' in tag:
            paper['relevance'] = 3  # high
        elif '最新' in tag:
            paper['relevance'] = 2  # medium
        else:
            paper['relevance'] = 1  # other

        # Extract unique tags for filtering
        tag_parts = [t.strip() for t in re.split(r'[/,、]', tag) if t.strip()]
        paper['tags'] = tag_parts

        if paper['title']:
            papers.append(paper)

    return papers


def parse_weekly_title(filepath: str) -> str:
    """Extract the date-range part of a weekly report title.

    `# 📄 论文周报 | 2026-W34（2026-08-14 ~ 2026-08-20）` -> `2026-08-14 ~ 2026-08-20`
    (best-effort; empty string when the header is absent).
    """
    with open(filepath, encoding="utf-8") as f:
        first_line = f.readline()
    m = re.search(r'（([^）]+)）', first_line)
    return m.group(1) if m else ''
