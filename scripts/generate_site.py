"""Generate static site for AI Paper Daily from markdown reports.

Reads docs/YYYY-MM-DD.md files, parses paper entries, and injects them
into docs/template.html to produce docs/index.html and docs/feed.xml.
"""

import os
import re
import glob
from datetime import datetime, timezone, timedelta
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom.minidom import parseString

DIST_DIR = "docs"
SITE_TITLE = "AI Paper Daily"
SITE_DESC = "Daily AI Paper Discovery · Agent / RAG / Knowledge Graph"
SITE_URL = "https://alloevil.github.io/AI-Paper-Daily"


def parse_papers(filepath: str) -> list[dict]:
    """Parse a YYYY-MM-DD.md file and return a list of paper dicts."""
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


WEEKLY_PAGE_TEMPLATE = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — AI Paper Daily</title>
<meta name="description" content="{desc}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📊</text></svg>">
<style>
  :root {{
    --primary: #6366f1;
    --primary-hover: #818cf8;
    --blue: #3b82f6;
    --ink: #f7f8f8;
    --ink-muted: #d0d6e0;
    --ink-subtle: #8a8f98;
    --ink-tertiary: #62666d;
    --canvas: #010102;
    --surface-1: #0f1011;
    --surface-2: #141516;
    --hairline: #23252a;
    --hairline-strong: #34343a;
    --font-sans: 'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
  }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: var(--font-sans); background: var(--canvas); color: var(--ink);
         -webkit-font-smoothing: antialiased; line-height: 1.5; }}
  .container {{ max-width: 960px; margin: 0 auto; padding: 0 24px; }}
  .masthead {{ padding: 20px 0 16px; border-bottom: 1px solid var(--hairline);
               display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 12px; }}
  .masthead h1 {{ font-size: 20px; font-weight: 600; letter-spacing: -0.4px; }}
  .masthead .range {{ font-size: 13px; color: var(--ink-subtle); }}
  .masthead a {{ padding: 6px 14px; font-size: 13px; font-weight: 500; color: var(--ink-subtle);
                 border: 1px solid var(--hairline); border-radius: 8px; text-decoration: none; }}
  .masthead a:hover {{ color: var(--ink); border-color: var(--hairline-strong); }}
  .intro {{ padding: 16px 0 4px; font-size: 14px; color: var(--ink-subtle); }}
  .paper-card {{ display: flex; padding: 16px 0; border-radius: 8px; }}
  .paper-card:hover {{ background: var(--surface-1); }}
  .paper-card + .paper-card {{ border-top: 1px solid var(--hairline); }}
  .relevance-bar {{ width: 4px; border-radius: 2px; flex-shrink: 0; margin-right: 16px; align-self: stretch; }}
  .relevance-bar.high {{ background: var(--primary); }}
  .relevance-bar.mid {{ background: var(--blue); }}
  .relevance-bar.low {{ background: var(--ink-tertiary); }}
  .paper-content {{ flex: 1; min-width: 0; }}
  .paper-header {{ display: flex; align-items: flex-start; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }}
  .paper-title {{ font-size: 15px; font-weight: 500; color: var(--ink); text-decoration: none; line-height: 1.4; }}
  .paper-title:hover {{ color: var(--primary-hover); }}
  .paper-tag {{ display: inline-block; padding: 1px 8px; font-size: 11px; font-weight: 500;
                color: var(--ink-muted); background: var(--surface-2); border: 1px solid var(--hairline);
                border-radius: 10px; white-space: nowrap; flex-shrink: 0; }}
  .paper-abstract {{ font-size: 14px; color: var(--ink-subtle); margin-bottom: 8px; line-height: 1.55; }}
  .paper-links {{ display: flex; gap: 8px; font-size: 13px; }}
  .paper-links a {{ color: var(--ink-tertiary); text-decoration: none; }}
  .paper-links a:hover {{ color: var(--primary-hover); }}
  .footer {{ margin-top: 48px; padding: 24px 0; border-top: 1px solid var(--hairline);
             text-align: center; font-size: 12px; color: var(--ink-tertiary); }}
  .footer a {{ color: var(--ink-subtle); text-decoration: none; }}
  .footer a:hover {{ color: var(--ink); }}
  @media (max-width: 640px) {{
    .container {{ padding: 0 16px; }}
    .paper-header {{ flex-direction: column; gap: 4px; }}
    .relevance-bar {{ margin-right: 12px; }}
    .paper-links {{ flex-wrap: wrap; }}
  }}
</style>
</head>
<body>
  <div class="container">
    <header class="masthead">
      <div>
        <h1>📊 {title}</h1>
        <span class="range">{range}</span>
      </div>
      <a href="./">← 返回日报</a>
    </header>
    <p class="intro">{desc}</p>
{cards}
    <footer class="footer">
      <p>Built by <a href="https://github.com/alloevil">alloevil</a> · <a href="https://github.com/alloevil/AI-Paper-Daily">GitHub</a> · <a href="{site_url}/feed.xml">RSS</a></p>
    </footer>
  </div>
</body>
</html>
'''


def render_weekly_page(week_label: str, date_range: str, papers: list[dict]) -> str:
    """Render a standalone HTML page for one weekly-YYYY-WNN.md report."""
    cards = '\n'.join(paper_card_html(p) for p in papers)
    return WEEKLY_PAGE_TEMPLATE.format(
        title=f'论文周报 {week_label}',
        range=_esc(date_range),
        desc=f'过去 7 天按热度（投票 / 星标 / 开源代码）重排的 Top {len(papers)}',
        cards=cards,
        site_url=SITE_URL,
    )


def collect_weekly_reports() -> list[tuple[str, str, list[dict]]]:
    """Find weekly-YYYY-WNN.md reports, newest first.

    Returns (week_label, date_range, papers) tuples.
    """
    weekly_files = sorted(
        glob.glob(os.path.join(DIST_DIR, 'weekly-????-W??.md')), reverse=True)
    out = []
    for fpath in weekly_files:
        m = re.search(r'weekly-(\d{4}-W\d{2})\.md$', fpath)
        if not m:
            continue
        papers = parse_papers(fpath)
        if papers:
            out.append((m.group(1), parse_weekly_title(fpath), papers))
    return out


def paper_card_html(paper: dict) -> str:
    """Generate HTML for a single paper card."""
    title = paper['title']
    tag = paper.get('tag', '')
    abstract = paper.get('abstract', '')
    links = paper.get('links', {})
    relevance = paper.get('relevance', 1)

    # Relevance class
    rel_class = {3: 'high', 2: 'mid', 1: 'low'}.get(relevance, 'low')

    # Tag HTML
    tag_html = f'<span class="paper-tag">{_esc(tag)}</span>' if tag else ''

    # Links HTML
    link_parts = []
    if links.get('paper'):
        link_parts.append(f'<a href="{_esc(links["paper"])}" target="_blank" rel="noopener">📄 论文</a>')
    if links.get('pdf'):
        link_parts.append(f'<a href="{_esc(links["pdf"])}" target="_blank" rel="noopener">📥 PDF</a>')
    if links.get('code'):
        link_parts.append(f'<a href="{_esc(links["code"])}" target="_blank" rel="noopener">💻 代码</a>')
    links_html = ' · '.join(link_parts)

    # Paper URL for title link
    paper_url = links.get('paper', '#')

    # Data attributes for filtering
    tags_attr = ','.join(paper.get('tags', []))

    return f'''      <div class="paper-card" data-relevance="{relevance}" data-tags="{_esc(tags_attr)}">
        <div class="relevance-bar {rel_class}"></div>
        <div class="paper-content">
          <div class="paper-header">
            <a class="paper-title" href="{_esc(paper_url)}" target="_blank" rel="noopener">{_esc(title)}</a>
            {tag_html}
          </div>
          <p class="paper-abstract">{_esc(abstract)}</p>
          <div class="paper-links">{links_html}</div>
        </div>
      </div>'''


def _esc(text: str) -> str:
    """Escape HTML entities."""
    return (text
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&#39;'))


def generate_rss(reports: list[tuple[str, list[dict]]],
                 weekly_reports: list[tuple[str, str, list[dict]]] = (),
                 max_items: int = 50) -> str:
    """Generate RSS 2.0 feed XML.

    Weekly roundups appear as one item each (linking to the rendered
    weekly page), ahead of the per-paper daily items.
    """
    rss = Element('rss', version='2.0')
    rss.set('xmlns:atom', 'http://www.w3.org/2005/Atom')
    ch = SubElement(rss, 'channel')
    SubElement(ch, 'title').text = SITE_TITLE
    SubElement(ch, 'description').text = SITE_DESC
    SubElement(ch, 'link').text = SITE_URL
    SubElement(ch, 'language').text = 'zh-CN'
    SubElement(ch, 'lastBuildDate').text = datetime.now(timezone.utc).strftime(
        '%a, %d %b %Y %H:%M:%S +0000')
    al = SubElement(ch, 'atom:link')
    al.set('href', f'{SITE_URL}/feed.xml')
    al.set('rel', 'self')
    al.set('type', 'application/rss+xml')

    for week_label, date_range, papers in weekly_reports:
        item = SubElement(ch, 'item')
        SubElement(item, 'title').text = f"📊 论文周报 {week_label}（{date_range}）"
        SubElement(item, 'description').text = (
            f"过去 7 天按热度重排的 Top {len(papers)}："
            + '；'.join(p['title'] for p in papers[:5]) + '…')
        page_url = f"{SITE_URL}/weekly-{week_label}.html"
        SubElement(item, 'link').text = page_url
        SubElement(item, 'guid').text = page_url
        end_date = date_range.split('~')[-1].strip() if date_range else ''
        try:
            pub_date = datetime.strptime(end_date, '%Y-%m-%d').strftime(
                '%a, %d %b %Y 18:00:00 +0000')
        except ValueError:
            pub_date = ''
        SubElement(item, 'pubDate').text = pub_date

    count = 0
    for date_str, papers in reports:
        for p in papers:
            if count >= max_items:
                break
            item = SubElement(ch, 'item')
            SubElement(item, 'title').text = f"📄 {p['title']} ({date_str})"
            SubElement(item, 'description').text = p.get('abstract', '')
            paper_url = p.get('links', {}).get('paper', SITE_URL)
            SubElement(item, 'link').text = paper_url
            SubElement(item, 'guid').text = f"{paper_url}#{date_str}"
            try:
                pub_date = datetime.strptime(date_str, '%Y-%m-%d').strftime(
                    '%a, %d %b %Y 18:00:00 +0000')
            except ValueError:
                pub_date = ''
            SubElement(item, 'pubDate').text = pub_date
            count += 1
        if count >= max_items:
            break

    xml_str = tostring(rss, encoding='unicode', xml_declaration=False)
    pretty = parseString(xml_str).toprettyxml(indent='  ', encoding=None)
    lines = pretty.split('\n')
    if lines and lines[0].startswith('<?xml'):
        return '\n'.join(lines)
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + pretty


def main():
    os.makedirs(DIST_DIR, exist_ok=True)

    template_path = os.path.join(DIST_DIR, 'template.html')
    try:
        with open(template_path, encoding='utf-8') as f:
            template = f.read()
    except FileNotFoundError:
        print("[ERROR] docs/template.html not found!")
        return

    # Find all YYYY-MM-DD.md files
    md_files = sorted(glob.glob(os.path.join(DIST_DIR, '????-??-??.md')), reverse=True)

    reports = []
    total_papers = 0
    for fpath in md_files:
        m = re.search(r'(\d{4}-\d{2}-\d{2})\.md$', fpath)
        if m:
            date_str = m.group(1)
            papers = parse_papers(fpath)
            if papers:
                reports.append((date_str, papers))
                total_papers += len(papers)

    if not reports:
        print("[WARN] No report files found")
        return

    # Collect all unique tags
    all_tags = set()
    for _, papers in reports:
        for p in papers:
            for t in p.get('tags', []):
                all_tags.add(t)

    # Generate date selector options
    date_options = []
    for i, (date_str, _) in enumerate(reports[:30]):
        selected = ' selected' if i == 0 else ''
        date_options.append(f'<option value="{date_str}"{selected}>{date_str}</option>')
    date_filters_html = '\n        '.join(date_options)

    # Generate paper sections for each date
    sections = []
    for i, (date_str, papers) in enumerate(reports[:30]):
        display = '' if i == 0 else 'none'
        cards = '\n'.join(paper_card_html(p) for p in papers)
        weekday_map = {0: '周一', 1: '周二', 2: '周三', 3: '周四', 4: '周五', 5: '周六', 6: '周日'}
        try:
            dt = datetime.strptime(date_str, '%Y-%m-%d')
            weekday = weekday_map.get(dt.weekday(), '')
        except ValueError:
            weekday = ''
        sections.append(
            f'    <div class="date-section" data-date="{date_str}" style="display:{display}">\n'
            f'      <div class="date-header">\n'
            f'        <h3>📄 {date_str}（{weekday}）</h3>\n'
            f'        <span class="date-count">{len(papers)} 篇论文</span>\n'
            f'      </div>\n'
            f'{cards}\n'
            f'    </div>'
        )

    sections_html = '\n'.join(sections)

    # Generate tag filter buttons
    tag_buttons = ['<button class="filter-btn active" onclick="filterTag(\'all\')">全部</button>']
    for tag in sorted(all_tags):
        tag_buttons.append(
            f'<button class="filter-btn" onclick="filterTag(\'{_esc(tag)}\')">{_esc(tag)}</button>'
        )
    tag_filters_html = '\n        '.join(tag_buttons)

    # Inject into template
    html = template

    # Weekly roundups: render standalone pages, link the latest from the nav
    weekly_reports = collect_weekly_reports()
    for week_label, date_range, papers in weekly_reports:
        page_path = os.path.join(DIST_DIR, f'weekly-{week_label}.html')
        with open(page_path, 'w', encoding='utf-8') as f:
            f.write(render_weekly_page(week_label, date_range, papers))
    if weekly_reports:
        latest_label = weekly_reports[0][0]
        html = html.replace(
            '<!-- WEEKLY_LINK -->',
            f'<a href="weekly-{latest_label}.html">📊 周报 {latest_label}</a>')

    # Update stats
    html = html.replace('id="stat-papers">0<', f'id="stat-papers">{total_papers}<')
    html = html.replace('id="stat-dates">0<', f'id="stat-dates">{len(reports)}<')

    # Inject date selector
    html = re.sub(
        r'(<select class="date-select" id="date-select"[^>]*>)\s*\n(.*?)\s*\n(\s*</select>)',
        lambda m: f'{m.group(1)}\n        {date_filters_html}\n{m.group(3)}',
        html, flags=re.DOTALL
    )

    # Inject tag filters
    html = re.sub(
        r'(<!-- TAG_FILTERS -->)(.*?)(<!-- /TAG_FILTERS -->)',
        lambda m: f'{m.group(1)}\n        {tag_filters_html}\n      {m.group(3)}',
        html, flags=re.DOTALL
    )

    # Inject content
    marker = '<!-- CONTENT_MARKER -->'
    if marker in html:
        parts = html.split(marker)
        html = parts[0] + sections_html + '\n    ' + parts[1]

    # Write index.html
    with open(os.path.join(DIST_DIR, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)

    # Generate RSS feed
    rss_xml = generate_rss(reports, weekly_reports)
    with open(os.path.join(DIST_DIR, 'feed.xml'), 'w', encoding='utf-8') as f:
        f.write(rss_xml)

    print(f"[OK] index.html generated ({len(reports)} dates, {total_papers} papers)")
    if weekly_reports:
        print(f"[OK] {len(weekly_reports)} weekly page(s) generated")
    print(f"[OK] feed.xml generated")


if __name__ == "__main__":
    main()
