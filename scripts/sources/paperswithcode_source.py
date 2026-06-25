"""Papers With Code 数据源"""

import json
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import List, Dict


PWC_API = "https://paperswithcode.com/api/v1/papers/"


def fetch_paperswithcode(keywords: List[str], days: int = 2,
                          max_results: int = 30) -> List[Dict]:
    """从 Papers With Code 获取论文"""
    papers = []

    for keyword in keywords[:3]:  # 限制关键词避免过多请求
        params = urllib.parse.urlencode({
            "q": keyword,
            "ordering": "-proceeding",
            "items_per_page": max_results,
        })
        url = f"{PWC_API}?{params}"

        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "PaperDiscovery/1.0",
            })
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"[PapersWithCode] Error for '{keyword}': {e}")
            continue

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        for item in data.get("results", []):
            pub_date_str = item.get("published", "")
            try:
                pub_date = datetime.fromisoformat(pub_date_str.replace("Z", "+00:00"))
                if pub_date < cutoff:
                    continue
            except (ValueError, TypeError):
                continue

            arxiv_id = item.get("arxiv_id", "")
            title = item.get("title", "").strip()
            abstract = item.get("abstract", "").strip()

            # 代码仓库
            repo_url = item.get("repository_url", "")
            has_code = bool(repo_url)

            papers.append({
                "id": arxiv_id or item.get("id", ""),
                "title": title,
                "abstract": abstract,
                "authors": [],  # PWC 不直接提供作者列表
                "url": f"https://arxiv.org/abs/{arxiv_id}" if arxiv_id else item.get("url_abs", ""),
                "pdf_url": f"https://arxiv.org/pdf/{arxiv_id}" if arxiv_id else "",
                "published": pub_date_str,
                "source": "paperswithcode",
                "categories": [],
                "has_code": has_code,
                "code_url": repo_url,
                "stars": item.get("repository_stars", 0),
                "votes": 0,
            })

        import time
        time.sleep(1)  # 避免限流

    # 去重（按 id）
    seen = set()
    unique = []
    for p in papers:
        if p["id"] not in seen:
            seen.add(p["id"])
            unique.append(p)

    print(f"[PapersWithCode] Found {len(unique)} unique papers")
    return unique
