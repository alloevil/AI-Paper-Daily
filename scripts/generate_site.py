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
        paper['tag'] = tag_match.group(1).strip() if tag_match else ''

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


def generate_rss(reports: list[tuple[str, list[dict]]], max_items: int = 50) -> str:
    """Generate RSS 2.0 feed XML."""
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
    rss_xml = generate_rss(reports)
    with open(os.path.join(DIST_DIR, 'feed.xml'), 'w', encoding='utf-8') as f:
        f.write(rss_xml)

    print(f"[OK] index.html generated ({len(reports)} dates, {total_papers} papers)")
    print(f"[OK] feed.xml generated")


if __name__ == "__main__":
    main()
