"""HuggingFace Daily Papers 数据源"""

import json
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import List, Dict


HF_PAPERS_API = "https://huggingface.co/api/daily_papers"


def fetch_huggingface(days: int = 2) -> List[Dict]:
    """从 HuggingFace Daily Papers 获取热门论文"""
    papers = []

    try:
        req = urllib.request.Request(HF_PAPERS_API, headers={
            "User-Agent": "PaperDiscovery/1.0",
            "Accept": "application/json",
        })
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[HuggingFace] Error: {e}")
        return []

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    for item in data:
        paper = item.get("paper", {})
        pub_at = item.get("publishedAt", "")

        # 解析日期
        try:
            pub_date = datetime.fromisoformat(pub_at.replace("Z", "+00:00"))
            if pub_date < cutoff:
                continue
        except (ValueError, TypeError):
            continue

        arxiv_id = paper.get("id", "")
        title = paper.get("title", "").strip()
        summary = paper.get("summary", "").strip()

        # 提取作者
        authors = [a.get("name", "") for a in paper.get("authors", [])]

        # 代码链接
        github_url = paper.get("githubUrl", "")

        papers.append({
            "id": arxiv_id,
            "title": title,
            "abstract": summary,
            "authors": authors[:5],
            "url": f"https://arxiv.org/abs/{arxiv_id}",
            "pdf_url": f"https://arxiv.org/pdf/{arxiv_id}",
            "published": pub_at,
            "source": "huggingface",
            "categories": [],
            "has_code": bool(github_url),
            "code_url": github_url or "",
            "votes": item.get("paper", {}).get("upvotes", 0),
        })

    print(f"[HuggingFace] Found {len(papers)} papers")
    return papers
