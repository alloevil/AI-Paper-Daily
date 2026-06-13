#!/usr/bin/env python3
"""抓取国家市场监管总局总局文件第一页的所有文章及正文。
用法: python3 scripts/samr_fetch.py [--output output.json]
"""
import json
import re
import sys
import urllib.request
import urllib.error
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "https://www.samr.gov.cn"
LIST_API = f"{BASE_URL}/api-gateway/jpaas-publish-server/front/page/build/unit"
LIST_PARAMS = {
    "parseType": "bulidstatic",
    "webId": "29e9522dc89d4e088a953d8cede72f4c",
    "tplSetId": "5c30fb89ae5e48b9aefe3cdf49853830",
    "pageType": "column",
    "tagId": "内容区域",
    "pageId": "5a1c443ecf8c471bb9577ba1ae5d2883",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": f"{BASE_URL}/zw/zjwj/index.html",
}


def fetch_url(url: str, timeout: int = 15) -> str:
    """发起 HTTP GET 请求。"""
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, Exception) as e:
        return ""


def get_article_list() -> list[dict]:
    """获取文章列表。"""
    params = "&".join(f"{k}={urllib.parse.quote(v)}" for k, v in LIST_PARAMS.items())
    url = f"{LIST_API}?{params}"
    html = fetch_url(url)
    if not html:
        return []

    data = json.loads(html)
    content_html = data.get("data", {}).get("html", "")

    items = re.findall(
        r'<a href="(/zw/[^"]+)"[^>]*title="([^"]+)"', content_html
    )

    # 提取日期
    dates = re.findall(
        r'<li class="nav04Left02_contenttime">([^<]+)</li>', content_html
    )

    articles = []
    for i, (path, title) in enumerate(items):
        date = dates[i] if i < len(dates) else ""
        articles.append({
            "title": title,
            "url": f"{BASE_URL}{path}",
            "date": date,
        })
    return articles


def extract_content(html: str) -> str:
    """从文章页面提取正文内容。"""
    # 去掉 script 和 style
    text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL)
    # 去掉 HTML 标签
    text = re.sub(r"<[^>]+>", "\n", text)
    # 清理空白
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    # 过滤噪音
    noise = ["首页", "导航", "Copyright", "备案", "京ICP", "公安部",
             "网站地图", "联系我们", "无障碍", "政府网站", "标识码"]
    content_lines = [
        l for l in lines
        if len(l) > 3 and not any(n in l for n in noise)
    ]
    return "\n".join(content_lines)


def fetch_article(article: dict) -> dict:
    """获取单篇文章的正文。"""
    html = fetch_url(article["url"])
    if html:
        article["content"] = extract_content(html)
    else:
        article["content"] = "(获取失败)"
    return article


def main():
    parser = argparse.ArgumentParser(description="抓取市场监管总局文件")
    parser.add_argument("--output", "-o", default=None, help="输出 JSON 文件路径")
    parser.add_argument("--workers", "-w", type=int, default=5, help="并发数")
    args = parser.parse_args()

    print("正在获取文章列表...")
    articles = get_article_list()
    print(f"找到 {len(articles)} 篇文章\n")

    print("正在抓取正文（并发）...")
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(fetch_article, a): a for a in articles}
        done = 0
        for future in as_completed(futures):
            done += a if (a := len(str(done))) else 1
            print(f"  进度: {done}/{len(articles)}", end="\r")

    print(f"\n完成！共获取 {len(articles)} 篇文章\n")

    # 输出
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(articles, f, ensure_ascii=False, indent=2)
        print(f"已保存到 {args.output}")
    else:
        # 打印摘要
        for i, a in enumerate(articles, 1):
            print(f"{i}. [{a['date']}] {a['title']}")
            preview = a.get("content", "")[:200].replace("\n", " ")
            print(f"   {preview}...")
            print()


if __name__ == "__main__":
    main()
