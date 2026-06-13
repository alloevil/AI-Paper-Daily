#!/usr/bin/env python3
"""
RSS 新闻抓取 - 不依赖 feedparser，使用 xml.etree + curl
输出：筛选后的候选新闻 JSON
"""

import json
import sys
import hashlib
import subprocess
import time
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from html import unescape
from urllib.parse import urlparse

CONFIG_PATH = Path(__file__).parent.parent / "knowledge" / "rss_config.json"

FEEDS = {
    "ithome": "https://www.ithome.com/rss/",
    "36kr": "https://36kr.com/feed",
    "wallstreetcn": "https://plink.anyfeeder.com/weixin/wallstreetcn",
    "readhub": "https://readhub.cn/rss",
    "tmtpost": "https://www.tmtpost.com/rss.xml",
    "zaobao": "https://plink.anyfeeder.com/zaobao/realtime/china",
    "laoyaoba": "https://www.laoyaoba.com/api/rss/hbb",
    "letschuhai": "https://letschuhai.com/feed",
    "caixin": "https://www.caixin.com/rss",
    "cnmo": "https://www.cnmo.com/rss/news.xml",
    "reuters_world": "https://feeds.reuters.com/Reuters/worldNews",
    "reuters_tech": "https://feeds.reuters.com/reuters/technologyNews",
    "bloomberg-wsj": "https://plink.anyfeeder.com/barrons/international-markets",
    "scmp_tech": "https://www.scmp.com/rss/5/feed",
}

KEYWORDS = {
    "companies": [
        "小米", "Xiaomi", "Redmi", "Samsung", "三星", "Apple", "苹果",
        "Huawei", "华为", "Oppo", "Vivo", "Transsion", "传音", "Honor", "荣耀",
        "BYD", "比亚迪", "Nio", "蔚来", "Xpeng", "小鹏", "Li Auto", "理想",
        "Tesla", "特斯拉", "OpenAI", "Google", "谷歌", "Meta", "TikTok",
        "TSMC", "台积电", "Qualcomm", "高通", "MediaTek", "联发科",
    ],
    "topics": [
        "芯片", "chip", "半导体", "semiconductor", "关税", "tariff", "制裁", "sanction",
        "汇率", "exchange rate", "市场份额", "market share", "出海", "overseas",
        "AI", "人工智能", "大模型", "LLM", "自动驾驶", "autonomous driving", "EV", "电动车",
        "专利", "patent", "诉讼", "lawsuit",
    ],
}


def strip_html(text):
    if not text:
        return ""
    text = re.sub(r'<[^>]+>', '', text)
    text = unescape(text)
    return re.sub(r'\s+', ' ', text).strip()


def content_hash(title, link):
    raw = f"{title.strip().lower()}|{urlparse(link).path if link else ''}"
    return hashlib.md5(raw.encode()).hexdigest()


def curl_fetch(url, timeout=12):
    try:
        result = subprocess.run(
            ["curl", "-sL", "--connect-timeout", "5", "--max-time", str(timeout), url],
            capture_output=True, text=True, timeout=timeout + 5
        )
        return result.stdout if result.returncode == 0 else ""
    except Exception:
        return ""


def parse_rss(content):
    """Parse RSS/Atom XML, return list of dicts"""
    items = []
    try:
        root = ET.fromstring(content)
    except ET.ParseError:
        return items

    # RSS 2.0
    for item in root.iter('item'):
        title = strip_html(item.findtext('title', ''))
        link = item.findtext('link', '')
        desc = strip_html(item.findtext('description', ''))
        pub = item.findtext('pubDate', '')
        if title:
            items.append({'title': title, 'link': link, 'summary': desc[:500], 'published': pub})

    # Atom
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    for entry in root.iter('{http://www.w3.org/2005/Atom}entry'):
        title = strip_html(entry.findtext('{http://www.w3.org/2005/Atom}title', ''))
        link_el = entry.find('{http://www.w3.org/2005/Atom}link')
        link = link_el.get('href', '') if link_el is not None else ''
        summary = strip_html(entry.findtext('{http://www.w3.org/2005/Atom}summary', ''))
        pub = entry.findtext('{http://www.w3.org/2005/Atom}updated', '')
        if title:
            items.append({'title': title, 'link': link, 'summary': summary[:500], 'published': pub})

    # Also try without namespace (some feeds use atom without ns)
    for entry in root.iter('entry'):
        title = strip_html(entry.findtext('title', ''))
        link_el = entry.find('link')
        link = link_el.get('href', '') if link_el is not None else ''
        summary = strip_html(entry.findtext('summary', ''))
        pub = entry.findtext('updated', '') or entry.findtext('published', '')
        if title and not any(i['title'] == title for i in items):
            items.append({'title': title, 'link': link, 'summary': summary[:500], 'published': pub})

    return items


def fetch_feed(name, url, max_items=50):
    items = []
    try:
        content = curl_fetch(url)
        if not content:
            print(f"[WARN] {name}: empty", file=sys.stderr)
            return items
        parsed = parse_rss(content)
        for entry in parsed[:max_items]:
            items.append({
                "title": entry['title'],
                "link": entry['link'],
                "summary": entry['summary'],
                "source": name,
                "published": entry.get('published', ''),
                "hash": content_hash(entry['title'], entry['link'])
            })
        print(f"[INFO] {name}: {len(items)} items", file=sys.stderr)
    except Exception as e:
        print(f"[ERROR] {name}: {e}", file=sys.stderr)
    return items


def is_noisy(title, summary):
    text = f"{title} {summary}".lower()
    noise = [
        "体育", "sports", "NBA", "世界杯", "足球", "篮球",
        "电影", "movie", "电视剧", "综艺", "娱乐八卦",
        "游戏攻略", "gaming", "旅游", "travel", "美食", "food",
        "时尚", "fashion", "护肤", "美容", "化妆品",
        "房产", "real estate", "二手房", "租房", "中介",
        "招聘", "求职", "职场", "猎头",
        "健康", "养生", "医疗", "hospital", "疫苗",
        "广告", "优惠券", "促销", "打折",
        "拼多多", "美团外卖", "饿了么",
    ]
    return any(n in text for n in noise)


def classify(title, summary, keywords):
    text = f"{title} {summary}".lower()
    cats = []
    xiaomi_kw = ["小米", "xiaomi", "redmi", "mi ", "hyperos", "米家", "su7", "su8"]
    if any(k in text for k in xiaomi_kw):
        cats.append("小米直接相关")
    industry_kw = keywords.get("topics", [])
    if any(k.lower() in text for k in industry_kw):
        cats.append("行业动态")
    if not cats:
        cats.append("泛科技")
    return cats


def main():
    config = {}
    if CONFIG_PATH.exists():
        config = json.loads(CONFIG_PATH.read_text())

    feeds = config.get("feeds", FEEDS)
    keywords = config.get("keywords", KEYWORDS)
    max_items = config.get("max_items_per_feed", 50)

    all_items = []
    for name, url in feeds.items():
        all_items.extend(fetch_feed(name, url, max_items))
    print(f"[INFO] RSS total: {len(all_items)}", file=sys.stderr)

    # dedup
    seen = set()
    deduped = []
    for item in all_items:
        if item["hash"] not in seen:
            seen.add(item["hash"])
            deduped.append(item)
    print(f"[INFO] After dedup: {len(deduped)}", file=sys.stderr)

    # filter noise
    filtered = [i for i in deduped if not is_noisy(i["title"], i["summary"])]
    print(f"[INFO] After filter: {len(filtered)}", file=sys.stderr)

    for idx, item in enumerate(filtered):
        item["categories"] = classify(item["title"], item["summary"], keywords)
        item["id"] = idx

    print(json.dumps(filtered, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
