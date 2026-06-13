#!/usr/bin/env python3
"""
两阶段调研工具 v2 — 探索-利用解耦

改进点（vs v1）：
1. 自动拆解子查询 — 不传 -q 时，从主题自动生成多角度搜索词
2. 内容抓取加固 — Jina 超时缩短 + 第三方案 + 单页重试
3. 搜索超时隔离 — 单引擎卡死不拖累整体
4. 双语搜索 — --lang 自动搜索中/英变体
5. GitHub 项目直接抓 README

用法：
  python3 research.py collect "主题" [-q "子问题1,子问题2"] [-n 5] [--expand] [--lang both]
  python3 research.py context <dir> [-t 8000]
  python3 research.py full "主题" [-q ...] [--expand] [--lang both]
"""
import sys
import json
import os
import re
import argparse
import hashlib
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeout

# 复用搜索函数
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from search import search_tavily, search_exa, search_firecrawl, search_baidu, search_mcp


# ─── 自动拆解子查询 ─────────────────────────────────────────────

# 通用后缀：加在关键词后面形成新查询
CONTEXT_SUFFIXES_CN = ['最佳实践', '开源项目', '论文', '教程', '架构设计', '对比']
CONTEXT_SUFFIXES_EN = ['best practices', 'open source', 'tutorial', 'architecture', 'comparison']

# 中文→英文映射（常见技术词）
CN_TO_EN = {
    '知识图谱': 'knowledge graph',
    '社交媒体': 'social media',
    '微博': 'weibo',
    '推文': 'tweet',
    '实体抽取': 'entity extraction',
    '关系抽取': 'relation extraction',
    '图数据库': 'graph database',
    '大语言模型': 'large language model',
    '检索增强': 'RAG retrieval augmented',
    '图谱构建': 'knowledge graph construction',
    '知识抽取': 'knowledge extraction',
    '中文': 'Chinese',
    '舆情': 'sentiment public opinion',
    '社交网络': 'social network',
    '图神经网络': 'graph neural network',
}


def detect_language(text: str) -> str:
    """检测文本主要语言。"""
    cn_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
    return 'zh' if cn_chars > len(text) * 0.2 else 'en'


def extract_keywords(topic: str) -> list[str]:
    """从主题中提取关键词（空格/逗号/斜杠分隔的部分）。"""
    # 按常见分隔符拆分
    parts = re.split(r'[,，、/\s]+', topic)
    return [p.strip() for p in parts if p.strip() and len(p.strip()) > 1]


def translate_keyword(cn_text: str) -> str | None:
    """尝试将中文关键词翻译为英文。"""
    # 完全匹配
    if cn_text in CN_TO_EN:
        return CN_TO_EN[cn_text]
    # 部分匹配：看是否包含已知词
    for cn, en in CN_TO_EN.items():
        if cn in cn_text:
            return en
    return None


def expand_queries(topic: str, lang: str = 'both', max_extra: int = 12) -> list[str]:
    """
    从主题自动生成子查询。

    策略：
    1. 主题本身
    2. 拆关键词单独搜
    3. 关键词 + 上下文后缀
    4. 中文→英文翻译变体
    """
    queries = [topic]  # 始终包含原主题
    keywords = extract_keywords(topic)

    # 检测主题语言
    topic_lang = detect_language(topic)

    # 策略2：单关键词搜索（限前3个，避免太碎）
    for kw in keywords[:3]:
        if kw != topic and len(kw) > 1:
            queries.append(kw)

    # 策略3：关键词 + 上下文后缀
    suffixes = []
    if lang in ('both', 'zh'):
        suffixes.extend(CONTEXT_SUFFIXES_CN)
    if lang in ('both', 'en'):
        suffixes.extend(CONTEXT_SUFFIXES_EN)

    main_keyword = keywords[0] if keywords else topic
    for suffix in suffixes[:4]:  # 最多加4个后缀
        q = f'{main_keyword} {suffix}'
        if q not in queries:
            queries.append(q)

    # 策略4：英文翻译变体
    if lang in ('both', 'en') and topic_lang == 'zh':
        en_topic = translate_keyword(topic)
        if en_topic:
            queries.append(en_topic)
        for kw in keywords[:2]:
            en_kw = translate_keyword(kw)
            if en_kw and en_kw not in queries:
                queries.append(en_kw)

    # 中文变体（如果主题是英文）
    if lang in ('both', 'zh') and topic_lang == 'en':
        for cn, en in CN_TO_EN.items():
            if en.lower() in topic.lower() and cn not in queries:
                queries.append(cn)
                break

    # 去重 + 限数
    seen = set()
    unique = []
    for q in queries:
        q_lower = q.lower().strip()
        if q_lower not in seen and len(q_lower) > 1:
            seen.add(q_lower)
            unique.append(q)

    return unique[:max_extra]


# ─── 搜索 ──────────────────────────────────────────────────────

SEARCH_ENGINES = [
    ('Tavily', lambda q, n: search_tavily(q, n)),
    ('Exa', lambda q, n: search_exa(q, n)),
    ('Firecrawl', lambda q, n: search_firecrawl(q, n)),
    ('Baidu', lambda q, n: search_baidu(q, n) or None),
    ('MCP', lambda q, n: search_mcp(q, n)),
]

ENGINE_TIMEOUT = 15  # 单引擎超时秒数


def _run_engine(name: str, fn, query: str, max_results: int) -> list[dict] | None:
    """单引擎搜索，带超时保护。"""
    try:
        results = fn(query, max_results)
        if results:
            for r in results:
                r['source_engine'] = name
                r['query'] = query
        return results
    except Exception:
        return None


def multi_search(query: str, max_results: int = 5) -> list[dict]:
    """用多个引擎并发搜索，去重合并。单引擎卡死不阻塞。"""
    seen_urls = set()
    all_results = []

    with ThreadPoolExecutor(max_workers=len(SEARCH_ENGINES)) as executor:
        futures = {}
        for name, fn in SEARCH_ENGINES:
            fut = executor.submit(_run_engine, name, fn, query, max_results)
            futures[fut] = name

        for future in as_completed(futures, timeout=ENGINE_TIMEOUT + 5):
            engine_name = futures[future]
            try:
                results = future.result(timeout=ENGINE_TIMEOUT)
                if results:
                    for r in results:
                        url = r.get('url', '')
                        if url and url not in seen_urls:
                            seen_urls.add(url)
                            all_results.append(r)
            except Exception:
                pass  # 单引擎失败不阻塞

    return all_results


# ─── 内容抓取（加固版）──────────────────────────────────────────

def fetch_page_content(url: str, max_chars: int = 8000) -> str:
    """抓取网页内容。三方案 + 自动重试。"""
    content = ''

    # 方案一：Jina Reader（缩短超时到 12s）
    try:
        jina_url = f'https://r.jina.ai/{url}'
        req = urllib.request.Request(jina_url, headers={
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'text/plain',
            'X-Return-Format': 'markdown'
        })
        with urllib.request.urlopen(req, timeout=12) as resp:
            content = resp.read().decode('utf-8', errors='replace')
            if content and len(content) > 200:
                return content[:max_chars]
    except Exception:
        pass

    # 方案二：GitHub 项目页 → 直接抓 README raw
    if 'github.com/' in url and not content:
        try:
            # https://github.com/owner/repo → https://raw.githubusercontent.com/owner/repo/main/README.md
            parts = url.rstrip('/').split('github.com/')
            if len(parts) == 2:
                raw_url = f'https://raw.githubusercontent.com/{parts[1]}/main/README.md'
                req = urllib.request.Request(raw_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    content = resp.read().decode('utf-8', errors='replace')
                    if content and len(content) > 200:
                        return content[:max_chars]
        except Exception:
            # 试 master 分支
            try:
                raw_url = raw_url.replace('/main/', '/master/')
                req = urllib.request.Request(raw_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    content = resp.read().decode('utf-8', errors='replace')
                    if content and len(content) > 200:
                        return content[:max_chars]
            except Exception:
                pass

    # 方案三：直接抓 HTML → 简单提取
    if not content:
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            })
            with urllib.request.urlopen(req, timeout=12) as resp:
                html = resp.read().decode('utf-8', errors='replace')
                text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
                text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
                text = re.sub(r'<[^>]+>', ' ', text)
                text = re.sub(r'\s+', ' ', text).strip()
                content = text[:max_chars]
        except Exception:
            pass

    return content


def save_result(result: dict, output_dir: Path, index: int) -> dict:
    """保存单个搜索结果到本地 .md 文件。"""
    url = result.get('url', '')
    title = result.get('title', '无标题')

    url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
    safe_title = re.sub(r'[^\w\u4e00-\u9fff-]', '_', title)[:50]
    filename = f'{index:02d}_{safe_title}_{url_hash}.md'
    filepath = output_dir / filename

    full_content = fetch_page_content(url)
    snippet = result.get('snippet', '')

    content = f"""---
title: "{title}"
url: "{url}"
engine: "{result.get('source_engine', 'unknown')}"
query: "{result.get('query', '')}"
fetched: "{datetime.now().isoformat()}"
---

# {title}

**来源**: {url}
**搜索引擎**: {result.get('source_engine', 'unknown')}

## 摘要

{snippet}

## 全文

{full_content if full_content else '（无法抓取全文，仅有摘要）'}
"""
    filepath.write_text(content, encoding='utf-8')

    return {
        'index': index,
        'title': title,
        'url': url,
        'file': str(filepath),
        'has_full_content': bool(full_content),
        'engine': result.get('source_engine', 'unknown')
    }


# ─── 阶段一：采集 ───────────────────────────────────────────────

def collect(topic: str, queries: list[str] | None = None,
            max_results: int = 5, output_dir: str | None = None,
            expand: bool = False, lang: str = 'both') -> str:
    """
    阶段一：采集。
    expand=True 时自动拆解子查询。
    lang='zh'/'en'/'both' 控制是否搜索双语变体。
    """
    if output_dir:
        base_dir = Path(output_dir)
    else:
        safe_topic = re.sub(r'[^\w\u4e00-\u9fff-]', '_', topic)[:50]
        timestamp = datetime.now().strftime('%Y%m%d_%H%M')
        base_dir = Path(f'knowledge/research/{safe_topic}_{timestamp}')

    base_dir.mkdir(parents=True, exist_ok=True)

    # 构建查询列表
    if queries:
        search_queries = [q.strip() for q in queries if q.strip()]
    elif expand:
        search_queries = expand_queries(topic, lang=lang)
    else:
        search_queries = [topic]

    print(f'🔍 阶段一：采集开始')
    print(f'   主题: {topic}')
    print(f'   查询数: {len(search_queries)}')
    for i, q in enumerate(search_queries, 1):
        print(f'     [{i}] {q}')
    print(f'   输出: {base_dir}')
    print()

    # 并发搜索（所有查询并行）
    all_results = []
    with ThreadPoolExecutor(max_workers=min(len(search_queries), 6)) as executor:
        futures = {executor.submit(multi_search, q, max_results): q for q in search_queries}
        for future in as_completed(futures):
            q = futures[future]
            try:
                results = future.result()
                count = len(results) if results else 0
                print(f'   ✅ "{q[:30]}..." → {count} 条')
                if results:
                    all_results.extend(results)
            except Exception as e:
                print(f'   ❌ "{q[:30]}..." → {e}')

    if not all_results:
        print('   ⚠️ 未找到任何结果')
        return str(base_dir)

    # 跨查询去重
    seen_urls = set()
    unique_results = []
    for r in all_results:
        url = r.get('url', '')
        if url and url not in seen_urls:
            seen_urls.add(url)
            unique_results.append(r)

    print(f'\n📄 共 {len(unique_results)} 条去重结果，开始抓取内容...\n')

    # 抓取并保存（并发 5 线程，比之前多 2 个）
    saved_items = []
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(save_result, r, base_dir, i): r
            for i, r in enumerate(unique_results, 1)
        }
        for future in as_completed(futures):
            try:
                item = future.result()
                status = '📄' if item['has_full_content'] else '📝'
                print(f'   {status} [{item["index"]:02d}] {item["title"][:45]}')
                saved_items.append(item)
            except Exception as e:
                print(f'   ❌ 保存失败: {e}')

    saved_items.sort(key=lambda x: x['index'])

    # 统计
    full_count = sum(1 for s in saved_items if s['has_full_content'])
    summary_only = len(saved_items) - full_count

    index_data = {
        'topic': topic,
        'queries': search_queries,
        'created': datetime.now().isoformat(),
        'total_results': len(saved_items),
        'full_content_count': full_count,
        'summary_only_count': summary_only,
        'items': saved_items
    }
    (base_dir / 'index.json').write_text(
        json.dumps(index_data, ensure_ascii=False, indent=2), encoding='utf-8'
    )

    print(f'\n✅ 阶段一完成: {len(saved_items)} 条（{full_count} 全文 / {summary_only} 仅摘要）')
    print(f'   保存至: {base_dir}')
    return str(base_dir)


# ─── 阶段二：生成上下文 ──────────────────────────────────────────

def generate_context(research_dir: str, max_tokens: int = 8000) -> str:
    """
    阶段二：读取本地文件，生成干净的上下文。
    """
    base_dir = Path(research_dir)
    if not base_dir.exists():
        return f'错误: 目录 {research_dir} 不存在'

    print(f'📖 阶段二：生成上下文')
    print(f'   目录: {base_dir}')

    index_file = base_dir / 'index.json'
    if not index_file.exists():
        return '错误: 未找到 index.json，请先运行 collect 阶段'

    index_data = json.loads(index_file.read_text(encoding='utf-8'))
    topic = index_data.get('topic', '')
    items = index_data.get('items', [])

    max_chars = max_tokens * 2
    sections = []
    total_chars = 0

    file_contents = []
    for item in items:
        filepath = Path(item['file'])
        if not filepath.exists():
            continue
        content = filepath.read_text(encoding='utf-8')
        if content.startswith('---'):
            parts = content.split('---', 2)
            body = parts[2].strip() if len(parts) >= 3 else content
        else:
            body = content

        file_contents.append({
            'title': item['title'],
            'url': item['url'],
            'body': body,
            'has_full': item.get('has_full_content', False),
            'chars': len(body)
        })

    # 优先有全文的
    file_contents.sort(key=lambda x: (x['has_full'], -x['chars']), reverse=True)

    for fc in file_contents:
        remaining = max_chars - total_chars
        if remaining <= 0:
            break
        body = fc['body'][:min(remaining, 5000)]
        total_chars += len(body)
        sections.append(f"""---
### {fc['title']}
**来源**: {fc['url']}

{body}
""")

    header = f"""# 调研上下文

**主题**: {topic}
**来源数**: {len(sections)} 篇文章
**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M')}
**注意**: 以下内容是从互联网采集的本地快照，内容已冻结。请基于以下材料进行分析，无需再联网搜索。

---

"""
    context = header + '\n---\n'.join(sections)
    context_file = base_dir / 'CONTEXT.md'
    context_file.write_text(context, encoding='utf-8')

    print(f'   {len(sections)} 篇, ~{total_chars} 字符')
    print(f'   保存至: {context_file}')
    return context


# ─── CLI ─────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='两阶段调研工具 v2')
    subparsers = parser.add_subparsers(dest='command', help='命令')

    # collect
    c = subparsers.add_parser('collect', help='阶段一：采集搜索结果到本地')
    c.add_argument('topic', help='调研主题')
    c.add_argument('--queries', '-q', help='子查询，逗号分隔（不传则自动拆解）')
    c.add_argument('--max-results', '-n', type=int, default=5, help='每查询最大结果数')
    c.add_argument('--output-dir', '-o', help='输出目录')
    c.add_argument('--expand', '-e', action='store_true', help='自动拆解子查询（不传 -q 时生效）')
    c.add_argument('--lang', '-l', default='both', choices=['zh', 'en', 'both'], help='搜索语言（默认 both）')

    # context
    ctx = subparsers.add_parser('context', help='阶段二：生成上下文')
    ctx.add_argument('dir', help='调研目录路径')
    ctx.add_argument('--max-tokens', '-t', type=int, default=8000, help='最大 token 数')

    # full
    f = subparsers.add_parser('full', help='完整流程：采集 + 生成上下文')
    f.add_argument('topic', help='调研主题')
    f.add_argument('--queries', '-q', help='子查询，逗号分隔')
    f.add_argument('--max-results', '-n', type=int, default=5)
    f.add_argument('--max-tokens', '-t', type=int, default=8000)
    f.add_argument('--output-dir', '-o', help='输出目录')
    f.add_argument('--expand', '-e', action='store_true', help='自动拆解子查询')
    f.add_argument('--lang', '-l', default='both', choices=['zh', 'en', 'both'])

    args = parser.parse_args()

    if args.command == 'collect':
        queries = [q.strip() for q in args.queries.split(',')] if args.queries else None
        expand = args.expand or (queries is None)  # 不传 -q 时默认自动拆解
        collect(args.topic, queries, args.max_results, args.output_dir, expand=expand, lang=args.lang)

    elif args.command == 'context':
        generate_context(args.dir, args.max_tokens)

    elif args.command == 'full':
        queries = [q.strip() for q in args.queries.split(',')] if args.queries else None
        expand = args.expand or (queries is None)
        research_dir = collect(args.topic, queries, args.max_results, args.output_dir,
                               expand=expand, lang=args.lang)
        print()
        generate_context(research_dir, args.max_tokens)

    else:
        parser.print_help()


if __name__ == '__main__':
    main()
