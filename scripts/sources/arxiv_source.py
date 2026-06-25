"""arXiv API 数据源"""

import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from typing import List, Dict
import time


ARXIV_API = "http://export.arxiv.org/api/query"
NS = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}


def fetch_arxiv(keywords: List[str], categories: List[str],
                max_results: int = 50, days: int = 2) -> List[Dict]:
    """从 arXiv 获取最近论文"""
    papers = []

    # 构建查询：关键词 OR 分类
    keyword_query = " OR ".join([f'all:"{kw}"' for kw in keywords])
    cat_query = " OR ".join([f"cat:{cat}" for cat in categories])
    query = f"({keyword_query}) AND ({cat_query})"

    params = urllib.parse.urlencode({
        "search_query": query,
        "start": 0,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    })

    url = f"{ARXIV_API}?{params}"
    print(f"[arXiv] Fetching: {url[:120]}...")

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "PaperDiscovery/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            xml_data = resp.read().decode("utf-8")
    except Exception as e:
        print(f"[arXiv] Error: {e}")
        return []

    root = ET.fromstring(xml_data)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    for entry in root.findall("atom:entry", NS):
        title = entry.find("atom:title", NS).text.strip().replace("\n", " ")
        summary = entry.find("atom:summary", NS).text.strip().replace("\n", " ")
        published = entry.find("atom:published", NS).text
        link = entry.find("atom:id", NS).text

        # 解析日期
        pub_date = datetime.fromisoformat(published.replace("Z", "+00:00"))
        if pub_date < cutoff:
            continue

        # 提取作者
        authors = []
        for author in entry.findall("atom:author", NS):
            name = author.find("atom:name", NS).text
            authors.append(name)

        # 提取分类
        cats = []
        for cat in entry.findall("atom:category", NS):
            cats.append(cat.get("term"))

        # 提取 PDF 链接
        pdf_link = ""
        for link_el in entry.findall("atom:link", NS):
            if link_el.get("title") == "pdf":
                pdf_link = link_el.get("href")

        # 检查是否有代码（arXiv 不直接提供，但可以检查 comment 字段）
        comment_el = entry.find("arxiv:comment", NS)
        has_code = False
        code_url = ""
        if comment_el is not None:
            comment = comment_el.text or ""
            if "github.com" in comment or "code" in comment.lower():
                has_code = True
                # 尝试提取 GitHub URL
                import re
                gh_match = re.search(r'https?://github\.com/[^\s\)]+', comment)
                if gh_match:
                    code_url = gh_match.group(0)

        papers.append({
            "id": link.split("/abs/")[-1],
            "title": title,
            "abstract": summary,
            "authors": authors[:5],  # 最多5个作者
            "url": link,
            "pdf_url": pdf_link,
            "published": published,
            "source": "arxiv",
            "categories": cats,
            "has_code": has_code,
            "code_url": code_url,
            "votes": 0,
        })

    print(f"[arXiv] Found {len(papers)} papers")
    return papers
