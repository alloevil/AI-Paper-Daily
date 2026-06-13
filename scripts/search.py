#!/usr/bin/env python3
"""可靠的联网搜索工具。
链路：Tavily → Exa → Firecrawl → 百度(Playwright) → 小米MCP
输出格式化的搜索结果供 AI 直接使用。
"""
import sys
import json
import subprocess
import os
import urllib.request
import urllib.error


def search_tavily(query: str, max_results: int = 5) -> list | None:
    """通过 Tavily 搜索，返回 [{title, url, snippet}] 或 None。"""
    api_key = os.environ.get('TAVILY_API_KEY', '')
    if not api_key:
        return None
    try:
        body = json.dumps({
            "api_key": api_key,
            "query": query,
            "max_results": max_results,
            "search_depth": "basic",
            "include_answer": False
        }).encode()
        req = urllib.request.Request(
            'https://api.tavily.com/search',
            data=body,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        results = []
        for r in data.get('results', [])[:max_results]:
            results.append({
                'title': r.get('title', ''),
                'url': r.get('url', ''),
                'snippet': r.get('content', '')[:300]
            })
        return results if results else None
    except Exception:
        return None


def search_exa(query: str, max_results: int = 5) -> list | None:
    """通过 Exa 神经搜索，返回 [{title, url, snippet}] 或 None。"""
    api_key = os.environ.get('EXA_API_KEY', '')
    if not api_key:
        return None
    try:
        body = json.dumps({
            "query": query,
            "numResults": max_results,
            "useAutoprompt": True,
            "contents": {"text": {"maxCharacters": 300}}
        }).encode()
        req = urllib.request.Request(
            'https://api.exa.ai/search',
            data=body,
            headers={
                'Content-Type': 'application/json',
                'x-api-key': api_key
            },
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        results = []
        for r in data.get('results', [])[:max_results]:
            snippet = ''
            if r.get('text'):
                snippet = r['text'][:300]
            results.append({
                'title': r.get('title', ''),
                'url': r.get('url', ''),
                'snippet': snippet
            })
        return results if results else None
    except Exception:
        return None


def search_firecrawl(query: str, max_results: int = 5) -> list | None:
    """通过 Firecrawl 搜索，返回 [{title, url, snippet}] 或 None。"""
    api_key = os.environ.get('FIRECRAWL_API_KEY', '')
    if not api_key:
        return None
    try:
        body = json.dumps({
            "query": query,
            "limit": max_results
        }).encode()
        req = urllib.request.Request(
            'https://api.firecrawl.dev/v1/search',
            data=body,
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}'
            },
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        results = []
        for r in data.get('data', [])[:max_results]:
            meta = r.get('metadata', {})
            results.append({
                'title': meta.get('title', ''),
                'url': meta.get('sourceURL', r.get('url', '')),
                'snippet': r.get('markdown', '')[:300]
            })
        return results if results else None
    except Exception:
        return None


def search_baidu(query: str, max_results: int = 5) -> list:
    """通过 Playwright + 百度搜索，返回 [{title, url, snippet}]。"""
    encoded = query.replace("'", "\\'")
    chrome_path = None
    search_root = '/root/.cache/ms-playwright'
    for dirpath, dirnames, filenames in os.walk(search_root):
        if 'chrome' in filenames:
            chrome_path = os.path.join(dirpath, 'chrome')
            break
    if not chrome_path:
        return []

    js_code = f"""
const {{ chromium }} = require('/app/node_modules/playwright');
(async () => {{
    const browser = await chromium.launch({{
        headless: true,
        executablePath: '{chrome_path}'
    }});
    const page = await browser.newPage();
    await page.goto('https://www.baidu.com/s?wd={encoded}', {{ waitUntil: 'domcontentloaded', timeout: 15000 }});
    const results = await page.evaluate(() => {{
        const items = [];
        document.querySelectorAll('h3 a').forEach(a => {{
            const text = a.innerText.trim();
            if (!text || text.length < 5) return;
            let url = a.href;
            try {{
                const u = new URL(url);
                if (u.searchParams.has('url')) url = u.searchParams.get('url');
            }} catch(e) {{}}
            if (!url || url.includes('baidu.com/s?') || url.includes('javascript:')) return;
            const container = a.closest('div') || a.parentElement?.parentElement;
            const snippetEl = container?.querySelector('.c-abstract, .c-span-last, .content-right_8Zs40, .c-font-normal, [class*=content]');
            items.push({{
                title: text,
                url: url,
                snippet: snippetEl ? snippetEl.innerText.trim() : ''
            }});
        }});
        return items.slice(0, {max_results});
    }});
    console.log(JSON.stringify(results));
    await browser.close();
}})();
"""
    result = subprocess.run(
        ['node', '-e', js_code],
        capture_output=True, text=True, timeout=30,
        env={**os.environ, 'PLAYWRIGHT_BROWSERS_PATH': '/root/.cache/ms-playwright'}
    )
    if result.returncode == 0 and result.stdout.strip():
        try:
            return json.loads(result.stdout.strip())
        except Exception:
            pass
    return []


def search_mcp(query: str, max_results: int = 5) -> list | None:
    """通过小米内部 MCP web-search 搜索，返回 [{title, url, snippet}] 或 None。"""
    try:
        import re
        init_body = json.dumps({
            "jsonrpc": "2.0", "method": "initialize", "id": 1,
            "params": {"protocolVersion": "2025-03-26", "capabilities": {},
                       "clientInfo": {"name": "openclaw", "version": "1.0.0"}}
        }).encode()
        req = urllib.request.Request(
            'http://one.mi.com/hubs-server/mcp/streamableHttp/web-search',
            data=init_body,
            headers={'Content-Type': 'application/json', 'Accept': 'text/event-stream, application/json'}
        )
        resp = urllib.request.urlopen(req, timeout=10)
        session_id = resp.headers.get('Mcp-Session-Id')

        search_body = json.dumps({
            "jsonrpc": "2.0", "method": "tools/call", "id": 2,
            "params": {"name": "web-search", "arguments": {
                "jsonrpc": "2.0", "method": "tools/call", "id": 1,
                "params": {"name": "web-search", "arguments": {"input": query}}
            }}
        }).encode()
        req2 = urllib.request.Request(
            'http://one.mi.com/hubs-server/mcp/streamableHttp/web-search',
            data=search_body,
            headers={'Content-Type': 'application/json', 'Accept': 'text/event-stream, application/json',
                     'Mcp-Session-Id': session_id}
        )
        resp2 = urllib.request.urlopen(req2, timeout=30)
        raw = resp2.read().decode()

        names = re.findall(r'"name":\s*"([^"]+)"', raw)
        snippets = re.findall(r'"snippet":\s*"([^"]*)"', raw)
        pure_urls = re.findall(r'"url":\s*"(https?://[^"]+)"', raw)

        filtered = []
        for i, u in enumerate(pure_urls):
            if not any(x in u for x in ['bochaai.com/api', '.jpg', '.png', 'thumbnail']):
                filtered.append({
                    'title': names[i] if i < len(names) else '',
                    'url': u,
                    'snippet': snippets[i] if i < len(snippets) else ''
                })
                if len(filtered) >= max_results:
                    break
        return filtered if filtered else None
    except Exception:
        return None


def search(query: str, max_results: int = 5) -> str:
    """搜索并返回格式化结果。链路：Tavily → Exa → Firecrawl → 百度 → 小米MCP"""
    attempts = [
        ('Tavily', lambda: search_tavily(query, max_results)),
        ('Exa', lambda: search_exa(query, max_results)),
        ('Firecrawl', lambda: search_firecrawl(query, max_results)),
        ('Baidu', lambda: search_baidu(query, max_results) or None),
        ('MCP', lambda: search_mcp(query, max_results)),
    ]

    results = None
    source = None
    for name, fn in attempts:
        try:
            r = fn()
            if r:
                results = r
                source = name
                break
        except Exception:
            continue

    if not results:
        return f'搜索"{query}"未找到结果。'

    lines = [f'搜索结果（来源: {source}）：\n']
    for i, r in enumerate(results, 1):
        title = r.get('title', '无标题')
        url = r.get('url', '')
        snippet = r.get('snippet', '')
        lines.append(f'{i}. **{title}**')
        if snippet:
            lines.append(f'   {snippet}')
        if url:
            lines.append(f'   🔗 {url}')
        lines.append('')

    return '\n'.join(lines)


if __name__ == '__main__':
    query = ' '.join(sys.argv[1:]) if len(sys.argv) > 1 else '测试搜索'
    print(search(query))
