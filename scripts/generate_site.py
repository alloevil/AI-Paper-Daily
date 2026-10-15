"""Generate static site for AI Paper Daily from markdown reports.

Reads docs/YYYY-MM-DD.md files, parses paper entries, and injects them
into docs/template.html to produce docs/index.html and docs/feed.xml.
"""

import os
import re
import glob
from datetime import datetime, timezone
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom.minidom import parseString

from reports import parse_papers, parse_weekly_title

DIST_DIR = "docs"
SITE_TITLE = "AI Paper Daily"
SITE_DESC = "Daily AI paper digest · Agents / RAG / Knowledge graphs"
SITE_URL = "https://alloevil.github.io/AI-Paper-Daily"


def latest_content_date(reports: list, weekly_reports: tuple = ()) -> str:
    """Newest date the committed reports cover, as YYYY-MM-DD.

    feed.xml's lastBuildDate and the sitemap's home lastmod are derived from
    this instead of the wall clock: both stamps mean "the reports behind these
    pages last changed", and a clock reading would make every rebuild of
    unchanged report files dirty the committed site (CI would commit the diff
    forever). Empty archive falls back to today.
    """
    dates = [date_str for date_str, _ in reports]
    for _, date_range, _ in weekly_reports:
        dates += re.findall(r'\d{4}-\d{2}-\d{2}', date_range or '')
    return max(dates) if dates else datetime.now(timezone.utc).strftime('%Y-%m-%d')


PAGE_TEMPLATE = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — AI Paper Daily</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{page_url}">
<meta property="og:type" content="article">
<meta property="og:url" content="{page_url}">
<meta property="og:title" content="{title} — AI Paper Daily">
<meta property="og:description" content="{desc}">
<meta property="og:site_name" content="AI Paper Daily">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0b0d10" media="(prefers-color-scheme: dark)">
<script>
  // 首次绘制前定妥主题：auto（默认，交给 prefers-color-scheme）/ light / dark。
  // 只有显式选择才写 data-theme —— auto 时不写，系统切换就由 CSS 媒体查询实时接管。
  (function () {{
    try {{
      var t = localStorage.getItem('paperTheme');
      if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    }} catch (e) {{}}
  }})();
</script>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📊</text></svg>">
<style>
  /* Same token set as docs/template.html: light is the base, dark only under
     prefers-color-scheme and deliberately not pure black. Every text colour is >=4.5:1 on
     canvas / surface-1 / surface-2, every non-text colour >=3:1 (WCAG 2.2 SC 1.4.3 / 1.4.11). */
  :root {{
    color-scheme: light;
    --primary: #4f46e5;
    --primary-hover: #4338ca;
    --blue: #2563eb;
    --ink: #14161c;
    --ink-muted: #3d4350;
    --ink-subtle: #565d6a;
    --ink-tertiary: #666d7a;
    --canvas: #ffffff;
    --surface-1: #f8f9fb;
    --surface-2: #f0f2f7;
    --hairline: #e4e7ed;
    --hairline-strong: #cdd3dd;
    --focus: #4f46e5;
    --font-sans: 'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
  }}
  @media (prefers-color-scheme: dark) {{
    :root:not([data-theme="light"]) {{
      color-scheme: dark;
      --primary: #6366f1;
      --primary-hover: #a5b4fc;
      --blue: #60a5fa;
      --ink: #eceef2;
      --ink-muted: #c3c8d2;
      --ink-subtle: #9aa2af;
      --ink-tertiary: #7f8794;
      --canvas: #0b0d10;
      --surface-1: #12141a;
      --surface-2: #191c22;
      --hairline: #262c36;
      --hairline-strong: #363d47;
      --focus: #a5b4fc;
    }}
  }}
  /* Explicit dark: :root[data-theme] outranks the :root inside the media query, so it wins even
     when the system is light. These values must match the block above verbatim (tests/test_theme.py
     asserts it). */
  :root[data-theme="dark"] {{
    color-scheme: dark;
    --primary: #6366f1;
    --primary-hover: #a5b4fc;
    --blue: #60a5fa;
    --ink: #eceef2;
    --ink-muted: #c3c8d2;
    --ink-subtle: #9aa2af;
    --ink-tertiary: #7f8794;
    --canvas: #0b0d10;
    --surface-1: #12141a;
    --surface-2: #191c22;
    --hairline: #262c36;
    --hairline-strong: #363d47;
    --focus: #a5b4fc;
  }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  /* Keyboard focus must be visible (WCAG 2.2 SC 2.4.7). */
  a:focus-visible, button:focus-visible, input:focus-visible,
  select:focus-visible, summary:focus-visible, [tabindex]:focus-visible {{
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }}
  body {{ font-family: var(--font-sans); background: var(--canvas); color: var(--ink);
         -webkit-font-smoothing: antialiased; line-height: 1.5; }}
  .container {{ max-width: 960px; margin: 0 auto; padding: 0 24px; }}
  .masthead {{ padding: 16px 0 2px; display: flex; align-items: center;
               flex-wrap: wrap; gap: 8px 16px; }}
  /* Wordmark lives in the utility bar, not as a heading - one title block per page. */
  .brand-name {{ display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600;
                 letter-spacing: -0.01em; color: var(--ink); text-decoration: none; }}
  .brand-icon {{ font-size: 16px; }}
  .brand-name:hover {{ color: var(--primary-hover); }}
  /* The issue head is the page title: kicker (issue no.), date as H1, meta under it. */
  .issue-head {{ padding: 10px 0 4px; }}
  .issue-kicker {{ font-size: 12px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase;
                   color: var(--ink-tertiary); font-variant-numeric: tabular-nums; }}
  .issue-date {{ font-size: 32px; font-weight: 700; letter-spacing: -0.7px; line-height: 1.15; margin: 6px 0 8px; }}
  .issue-foot {{ display: flex; align-items: center; justify-content: space-between; gap: 12px;
                 flex-wrap: wrap; padding-bottom: 12px; }}
  .issue-meta {{ font-size: 14px; color: var(--ink-subtle); font-variant-numeric: tabular-nums; }}
  .masthead a {{ padding: 6px 14px; font-size: 14px; font-weight: 500; color: var(--ink-subtle);
                 border: 1px solid var(--hairline); border-radius: 8px; text-decoration: none; }}
  .masthead a:hover {{ color: var(--ink); border-color: var(--hairline-strong); }}
  /* Nav chips are direct children of .nav, so the flex gap has to live here too. */
  .nav {{ display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }}
  .theme-toggle {{ padding: 5px 12px; font-size: 14px; font-weight: 500; font-family: var(--font-sans);
                   color: var(--ink-subtle); background: transparent; border: 1px solid var(--hairline);
                   border-radius: 8px; cursor: pointer; white-space: nowrap; }}
  .theme-toggle:hover {{ color: var(--ink); border-color: var(--hairline-strong); }}
  .paper-card {{ display: flex; padding: 18px 0; border-radius: 8px; }}
  .paper-card:hover {{ background: var(--surface-1); }}
  .paper-card + .paper-card {{ border-top: 1px solid var(--hairline); }}
  .paper-index {{ flex-shrink: 0; width: 2.6em; padding-top: 3px; font-size: 14px; font-weight: 600;
                  font-variant-numeric: tabular-nums; color: var(--ink-tertiary); }}
  .paper-content {{ flex: 1; min-width: 0; }}
  .paper-header {{ display: flex; align-items: flex-start; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }}
  .paper-title {{ font-size: 18px; font-weight: 600; color: var(--ink); text-decoration: none; line-height: 1.4; }}
  .paper-title:hover {{ color: var(--primary-hover); }}
  .paper-tag {{ display: inline-block; padding: 1px 8px; font-size: 13px; font-weight: 500;
                color: var(--ink-muted); background: var(--surface-2); border: 1px solid var(--hairline);
                border-radius: 10px; white-space: nowrap; flex-shrink: 0; }}
  .paper-abstract {{ font-size: 16px; color: var(--ink-subtle); margin-bottom: 8px; line-height: 1.65;
                     max-width: 68ch; padding-left: 12px; border-left: 2px solid var(--hairline); }}
  .paper-links {{ display: flex; gap: 8px; font-size: 14px; }}
  .paper-links a {{ display: inline-flex; align-items: center; min-height: 24px;
                    color: var(--ink-subtle); text-decoration: none; }}
  .paper-links a:hover {{ color: var(--primary-hover); }}
  .footer {{ margin-top: 48px; padding: 24px 0; border-top: 1px solid var(--hairline);
             text-align: center; font-size: 13px; color: var(--ink-tertiary); }}
  .footer a {{ color: var(--ink-subtle); text-decoration: none; }}
  .footer a:hover {{ color: var(--ink); }}
  @media (max-width: 640px) {{
    .container {{ padding: 0 16px; }}
    .paper-header {{ flex-direction: column; gap: 4px; }}
    .issue-date {{ font-size: 24px; }}
    .paper-index {{ width: 2.2em; }}
    .paper-links {{ flex-wrap: wrap; }}
  }}
    /* 跨页导航的过渡：与首页同一套 View Transition，浏览器不支持时退化为瞬切。
       日报/周报页只有这一处动效，所以 reduced-motion 一关就完全静止。 */
    @view-transition {{ navigation: auto; }}
    ::view-transition-old(root) {{ animation-duration: .18s; }}
    ::view-transition-new(root) {{ animation-duration: .22s; }}

    /* reduced-motion: the cross-document transition above is the only motion here; switching it
       off changes no information. */
    @media (prefers-reduced-motion: reduce) {{
      *, *::before, *::after {{
        animation-duration: .001ms !important;
        animation-delay: .001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: .001ms !important;
      }}
      /* View Transition 的伪元素不在 `*` 的匹配范围内，必须单独关掉 */
      ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) {{
        animation: none !important;
      }}
    }}
</style>
{extra_head}
</head>
<body>
  <div class="container">
    <header class="masthead">
      <a class="brand-name" href="./"><span class="brand-icon">📊</span>AI Paper Daily</a>
      <div class="nav">{nav}<button type="button" id="theme-toggle" class="theme-toggle" onclick="cycleTheme()">◐ Auto</button></div>
    </header>
    <div class="issue-head">
      <p class="issue-kicker">{kicker}</p>
      <h1 class="issue-date">{range}</h1>
      <div class="issue-foot">
        <p class="issue-meta">{issue_meta}</p>
      </div>
    </div>
{cards}
    <footer class="footer">
      <p class="footer-tagline">AI Paper Daily — daily digest of agent, RAG and knowledge-graph papers</p>
      <p>Built by <a href="https://github.com/alloevil">alloevil</a> · <a href="https://github.com/alloevil/AI-Paper-Daily">GitHub</a> · <a href="{site_url}/feed.xml">RSS</a></p>
    </footer>
  </div>
<script>
// --- 主题：auto（跟随系统）→ light → dark 循环，选择存 localStorage。 ---
// auto 时不写 data-theme，系统切换由 CSS 媒体查询实时接管；显式选择才写属性覆盖它。
const THEME_KEY = 'paperTheme';
const THEME_LABELS = {{ auto: '◐ Auto', light: '☀ Light', dark: '☾ Dark' }};

function currentTheme() {{
  const t = document.documentElement.getAttribute('data-theme');
  return (t === 'light' || t === 'dark') ? t : 'auto';
}}

// theme-color 跟着走：auto 时交回给两条 media 查询，显式选择时把两条都改成同一个色。
function syncThemeColor(mode) {{
  const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
  if (metas.length < 2) return;
  if (mode === 'auto') {{
    metas[0].setAttribute('media', '(prefers-color-scheme: light)');
    metas[0].setAttribute('content', '#ffffff');
    metas[1].setAttribute('media', '(prefers-color-scheme: dark)');
    metas[1].setAttribute('content', '#0b0d10');
  }} else {{
    metas.forEach(m => {{ m.removeAttribute('media'); m.setAttribute('content', mode === 'dark' ? '#0b0d10' : '#ffffff'); }});
  }}
}}

function renderThemeButton(mode) {{
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.textContent = THEME_LABELS[mode];
  btn.title = 'Theme: ' + THEME_LABELS[mode] + ' (click to switch)';
  btn.setAttribute('aria-label', 'Toggle theme (current: ' + THEME_LABELS[mode] + ')');
  syncThemeColor(mode);
}}

function cycleTheme() {{
  const order = ['auto', 'light', 'dark'];
  const next = order[(order.indexOf(currentTheme()) + 1) % order.length];
  if (next === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', next);
  try {{ localStorage.setItem(THEME_KEY, next); }} catch (e) {{}}
  renderThemeButton(next);
}}

document.addEventListener('DOMContentLoaded', () => renderThemeButton(currentTheme()));
</script>
</body>
</html>
'''

_MONTHS = ('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')


def _issue_label(date_str: str) -> str:
    """'2026-09-14' -> 'Mon, 14 Sep 2026'（与 arXiv 列表页的日期写法同形）。"""
    try:
        dt = datetime.strptime(date_str, '%Y-%m-%d')
    except ValueError:
        return date_str
    return f'{_WEEKDAYS[dt.weekday()]}, {dt.day} {_MONTHS[dt.month - 1]} {dt.year}'


def _week_label(date_range: str) -> str:
    """'2026-09-08 ~ 2026-09-14' -> '8 Sep – 14 Sep 2026'；解析失败时原样返回。"""
    parts = [p.strip() for p in re.split(r'[~–]|\s-\s', date_range) if p.strip()]
    if len(parts) != 2:
        return date_range
    try:
        a = datetime.strptime(parts[0], '%Y-%m-%d')
        b = datetime.strptime(parts[1], '%Y-%m-%d')
    except ValueError:
        return date_range
    return f'{a.day} {_MONTHS[a.month - 1]} – {b.day} {_MONTHS[b.month - 1]} {b.year}'


def _jsonld(payload: dict) -> str:
    """A JSON-LD block, escaped for embedding in HTML."""
    import json as _json
    body = _json.dumps(payload, ensure_ascii=False, indent=2)
    return f'<script type="application/ld+json">\n{body}\n</script>'


# 标签来自日报数据（中文："高票/有代码"、"最新论文"），只影响展示：
# data-tag 与 URL hash 仍用原始值做键，所以过滤与分享链接不受语言影响。
# 顺序有意义：长键在前，否则 "最新论文" 会被 "最新" 提前吃掉。
_TAG_MAP = (
    ("高票", "high-votes", "High votes"),
    ("有代码", "code", "Code"),
    ("最新论文", "newest", "Newest"),
    ("最新", "newest", "Newest"),
)


def _tag_label(raw: str) -> str:
    """把数据里的中文标签翻成展示用的英文；未知标签原样返回。"""
    parts = []
    for part in raw.split('/'):
        for zh, _slug, en in _TAG_MAP:
            part = part.replace(zh, en)
        parts.append(part.strip())
    return ' · '.join(p for p in parts if p)


def _tag_slug(raw: str) -> str:
    """标签的机器键（data-tags / URL hash 用）：稳定的英文 slug，与界面语言无关。"""
    out = raw
    for zh, slug, _en in _TAG_MAP:
        out = out.replace(zh, slug)
    return out


def render_page(*, title: str, date_range: str, desc: str, papers: list[dict],
                page_url: str, nav: str, extra_head: str = '',
                kicker: str = '', issue_meta: str = '') -> str:
    """Render one standalone page. Daily pages and weekly pages share this.

    ``title`` is the document title (head); ``kicker`` / ``date_range`` / ``issue_meta`` form the
    期号头 in the body — date big, period and count small, the way a paper runs its masthead.
    """
    return PAGE_TEMPLATE.format(
        title=title,
        kicker=_esc(kicker),
        issue_meta=_esc(issue_meta),
        range=_esc(date_range),
        desc=_esc(desc),
        cards='\n'.join(paper_card_html(p, i + 1) for i, p in enumerate(papers)),
        site_url=SITE_URL,
        page_url=page_url,
        nav=nav,
        extra_head=extra_head,
    )


def render_weekly_page(week_label: str, date_range: str, papers: list[dict]) -> str:
    """Render a standalone HTML page for one weekly-YYYY-WNN.md report."""
    page_url = f'{SITE_URL}/weekly-{week_label}.html'
    return render_page(
        title=f'Weekly roundup {week_label}',
        kicker=f'Weekly · {week_label}',
        issue_meta=f'Top {len(papers)} · re-ranked by votes, stars and open code',
        date_range=_week_label(date_range),
        desc=f'Top {len(papers)} of the last 7 days, re-ranked by votes, stars and open code',
        papers=papers,
        page_url=page_url,
        nav='<a href="./">← Back to the digest</a>',
        extra_head=_jsonld({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": f"Weekly roundup {week_label} ({date_range})",
            "inLanguage": "en",
            "url": page_url,
            "isPartOf": {"@type": "WebSite", "name": SITE_TITLE, "url": SITE_URL},
            "author": {"@type": "Person", "name": "alloevil",
                       "url": "https://github.com/alloevil"},
        }),
    )


_WEEKDAYS = {0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun'}


def render_daily_page(date_str: str, papers: list[dict],
                      prev_date: str | None = None, next_date: str | None = None,
                      issue_no: int | None = None) -> str:
    """Render one day's digest as its own page.

    The archive used to be reachable only as raw Markdown (docs/.nojekyll disables Jekyll), which
    left every day beyond the newest 30 with no indexable page: the content existed, the page did
    not. This is that page.
    """
    try:
        weekday = _WEEKDAYS.get(datetime.strptime(date_str, '%Y-%m-%d').weekday(), '')
    except ValueError:
        weekday = ''
    label = f'{date_str} ({weekday})' if weekday else date_str
    page_url = f'{SITE_URL}/{date_str}.html'
    titles = '; '.join(p['title'] for p in papers[:3])
    desc = f'{label} · {len(papers)} papers: {titles}…'
    tags = sorted({t for p in papers for t in p.get('tags', [])})[:4]
    links = ['<a href="./">← Back to the digest</a>']
    if next_date:
        links.append(f'<a href="{next_date}.html">Next day →</a>')
    if prev_date:
        links.append(f'<a href="{prev_date}.html">← Previous day</a>')
    return render_page(
        title=f'Daily digest {label}',
        kicker=f'Issue {issue_no}' if issue_no else 'Issue',
        issue_meta=f'{len(papers)} papers',
        date_range=_issue_label(date_str),
        desc=desc,
        papers=papers,
        page_url=page_url,
        nav=''.join(links),
        extra_head=_jsonld({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": f"Daily digest | {label}",
            "datePublished": date_str,
            "inLanguage": "en",
            "url": page_url,
            "isPartOf": {"@type": "WebSite", "name": SITE_TITLE, "url": SITE_URL},
            "author": {"@type": "Person", "name": "alloevil",
                       "url": "https://github.com/alloevil"},
            "about": [{"@type": "Thing", "name": _tag_label(t)} for t in tags],
        }),
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


def paper_card_html(paper: dict, index: int | None = None) -> str:
    """Generate HTML for a single paper card.

    The card is a table-of-contents entry, not a marketing card: a numbered gutter, then title,
    meta line, abstract and actions. The old 4px relevance bar is gone — it repeated what the tag
    chip already says, and colour is the wrong channel for a signal that must survive greyscale.
    """
    title = paper['title']
    tag = paper.get('tag', '')
    abstract = paper.get('abstract', '')
    links = paper.get('links', {})
    relevance = paper.get('relevance', 1)

    # 目次号：报纸目录式的扫读锚点（也方便口头引用"今天第 3 篇"）
    index_html = (f'<span class="paper-index" aria-hidden="true">{index:02d}</span>'
                  if index else '')

    # Tag HTML
    tag_html = f'<span class="paper-tag">{_esc(_tag_label(tag))}</span>' if tag else ''

    # Links HTML
    link_parts = []
    if links.get('paper'):
        link_parts.append(f'<a href="{_esc(links["paper"])}" target="_blank" rel="noopener">📄 Paper</a>')
    if links.get('pdf'):
        link_parts.append(f'<a href="{_esc(links["pdf"])}" target="_blank" rel="noopener">📥 PDF</a>')
    if links.get('code'):
        link_parts.append(f'<a href="{_esc(links["code"])}" target="_blank" rel="noopener">💻 Code</a>')
    links_html = ' · '.join(link_parts)

    # Paper URL for title link
    paper_url = links.get('paper', '#')

    # Data attributes for filtering
    tags_attr = ','.join(_tag_slug(t) for t in paper.get('tags', []))

    # 摘要：arXiv / HF 的英文原文，按引文块排版（左侧竖线 + 缩进），
    # 让它读起来是"引用"，而不是本页用英文写的正文。
    # lang="en" 是 WCAG 3.1.2（Language of Parts）：文档 lang="zh-CN"，
    # 引文块单独声明英文，屏幕阅读器才会用英文发音。
    abstract_html = (f'<blockquote class="paper-abstract" lang="en">{_esc(abstract)}</blockquote>'
                     if abstract else '')

    return f'''      <article class="paper-card" data-relevance="{relevance}" data-tags="{_esc(tags_attr)}">
        {index_html}
        <div class="paper-content">
          <div class="paper-header">
            <a class="paper-title" lang="en" href="{_esc(paper_url)}" target="_blank" rel="noopener">{_esc(title)}</a>
            {tag_html}
          </div>
          {abstract_html}
          <div class="paper-links">{links_html}</div>
        </div>
      </article>'''


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
    SubElement(ch, 'language').text = 'en'
    SubElement(ch, 'lastBuildDate').text = datetime.strptime(
        latest_content_date(reports, weekly_reports), '%Y-%m-%d'
    ).replace(tzinfo=timezone.utc).strftime('%a, %d %b %Y 18:00:00 +0000')
    al = SubElement(ch, 'atom:link')
    al.set('href', f'{SITE_URL}/feed.xml')
    al.set('rel', 'self')
    al.set('type', 'application/rss+xml')

    for week_label, date_range, papers in weekly_reports:
        item = SubElement(ch, 'item')
        SubElement(item, 'title').text = f"📊 Weekly roundup {week_label} ({date_range})"
        SubElement(item, 'description').text = (
            f"Top {len(papers)} of the last 7 days by heat: "
            + '; '.join(p['title'] for p in papers[:5]) + '…')
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
    tag_labels = {_tag_slug(t): _tag_label(t) for t in all_tags}

    # Generate date selector options
    date_options = []
    for i, (date_str, _) in enumerate(reports[:30]):
        selected = ' selected' if i == 0 else ''
        date_options.append(f'<option value="{date_str}"{selected}>{date_str}</option>')
    date_filters_html = '\n        '.join(date_options)

    # Generate paper sections for each date
    # 期号：把 62 期日报按时间从旧到新编号，最新一期 = len(reports)。首页的期号头与
    # 每个 section 的 data-issue 都取自这里（claims 的 issue-numbers 回执按同一口径复算）。
    sections = []
    for i, (date_str, papers) in enumerate(reports[:30]):
        display = '' if i == 0 else 'none'
        issue_no = len(reports) - i
        cards = '\n'.join(paper_card_html(p, n + 1) for n, p in enumerate(papers))
        sections.append(
            f'    <div class="date-section" data-date="{date_str}" data-issue="{issue_no}"'
            f' data-count="{len(papers)}" style="display:{display}">\n'
            f'{cards}\n'
            f'    </div>'
        )

    sections_html = '\n'.join(sections)

    # Generate tag filter buttons
    tag_buttons = ['<button class="filter-btn active" data-tag="all" onclick="filterTag(\'all\')">All</button>']
    for tag in sorted(all_tags):
        tag_buttons.append(
            f'<button class="filter-btn" data-tag="{_esc(_tag_slug(tag))}" onclick="filterTag(\'{_esc(_tag_slug(tag))}\')">{_esc(tag_labels[_tag_slug(tag)])}</button>'
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
    # 周报入口只留在期号头那一组（同一入口不做两处）

    # Daily pages: one per committed digest, every day — not just the 30 inlined in the index.
    # prev/next links give crawlers and readers a chain through the whole archive.
    for i, (date_str, papers) in enumerate(reports):
        next_date = reports[i - 1][0] if i > 0 else None
        prev_date = reports[i + 1][0] if i + 1 < len(reports) else None
        with open(os.path.join(DIST_DIR, f'{date_str}.html'), 'w', encoding='utf-8') as f:
            f.write(render_daily_page(date_str, papers, prev_date, next_date,
                                      issue_no=len(reports) - i))
    print(f"[OK] {len(reports)} daily page(s) generated")

    # 首页期号头：服务端先渲染最新一期（无 JS 也正确），JS 换日期时再改写。
    newest_date, newest_papers = reports[0]
    newest_label = _issue_label(newest_date)
    week_label = weekly_reports[0][0] if weekly_reports else ''
    older_date = reports[1][0] if len(reports) > 1 else ''
    issue_nav = []
    if older_date:
        issue_nav.append(f'<a class="issue-arrow" href="{older_date}.html">← {older_date}</a>')
    html = html.replace('<!-- ISSUE_HEAD -->', (
        '      <div class="issue-head" id="issue-head">\n'
        f'      <p class="issue-kicker">Issue <span id="issue-no">{len(reports)}</span></p>\n'
        f'      <h1 class="issue-date" id="issue-date">{newest_label}</h1>\n'
        '      <div class="issue-foot">\n'
        '      <p class="issue-meta"><span id="issue-count">'
        f'{len(newest_papers)} papers</span> · '
        '<span class="stat-num" id="stat-papers">0</span> papers over '
        '<span class="stat-num" id="stat-dates">0</span> days</p>\n'
        f'      <nav class="issue-nav" id="issue-nav">{"".join(issue_nav)}</nav>\n'
        + (f'      <a class="issue-arrow" href="weekly-{week_label}.html">Weekly {week_label} ↗</a>\n'
           if week_label else '')
        + '      </div>\n'
        '    </div>'))

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

    # Generate robots.txt
    # 注意：robots 协议是 origin 级的，抓取器只读 alloevil.github.io/robots.txt，
    # 不会读子路径下的这一份。所以这个文件是"约定 + 备用"性质：部分工具和
    # AI 抓取器确实会探测子路径，将来若换独立域名它才真正生效。要真正屏蔽
    # 或声明 sitemap，得改站点根仓库 alloevil.github.io 的 robots.txt。
    with open(os.path.join(DIST_DIR, 'robots.txt'), 'w', encoding='utf-8') as f:
        f.write("User-agent: *\nAllow: /\n\n"
                f"Sitemap: {SITE_URL}/sitemap.xml\n")
    print("[OK] robots.txt generated")

    # Generate sitemap.xml
    # 只收录真正的 HTML 页面：首页 + 每篇周报页 + 每个日报页。刻意不收录的：
    #   - 每日 docs/YYYY-MM-DD.md 与 index.md：docs/.nojekyll 关掉了 Jekyll，
    #     它们只以 text/markdown 形式 200；同日期的 .html 才是页面，已收录。
    #   - template.html：本脚本的渲染输入，不是页面（它自带指向首页的
    #     rel=canonical，所以即使被抓到也会归并到首页）。
    #   - feed.xml 和图片等静态资源：不是页面，塞进 sitemap 只会稀释它。
    # Index uses the newest committed report date (its content changes when a
    # digest lands — inlined into this page); each weekly page uses its covered
    # week's end date. Both are real, past content dates, and neither reads the
    # clock, so rebuilding an unchanged archive leaves sitemap.xml byte-identical.
    build_date = latest_content_date(reports, weekly_reports)
    def _weekly_lastmod(date_range: str) -> str:
        dates = re.findall(r'\d{4}-\d{2}-\d{2}', date_range)
        return dates[-1] if dates else build_date
    urls = [(f'{SITE_URL}/', build_date)] + [
        (f'{SITE_URL}/weekly-{wl}.html', _weekly_lastmod(dr))
        for wl, dr, _ in weekly_reports] + [
        (f'{SITE_URL}/{date_str}.html', date_str) for date_str, _ in reports]
    sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n'
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
               + '\n'.join(
                   f'  <url><loc>{loc}</loc><lastmod>{lastmod}</lastmod></url>'
                   for loc, lastmod in urls)
               + '\n</urlset>\n')
    with open(os.path.join(DIST_DIR, 'sitemap.xml'), 'w', encoding='utf-8') as f:
        f.write(sitemap)
    print("[OK] sitemap.xml generated")

    print(f"[OK] index.html generated ({len(reports)} dates, {total_papers} papers)")
    if weekly_reports:
        print(f"[OK] {len(weekly_reports)} weekly page(s) generated")
    print(f"[OK] feed.xml generated")


if __name__ == "__main__":
    main()
