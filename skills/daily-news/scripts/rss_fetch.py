#!/usr/bin/env python3
"""
RSS 新闻抓取 + 粗筛 + 去重
输出：筛选后的候选新闻 JSON，供 Agent 多轮精筛

v2 改进：
- 并发抓取（ThreadPoolExecutor）
- 抓取结果缓存（同一天多次触发不重复抓）
- 移除失效源（letschuhai/caixin/cnmo 已失效）
- 配置对齐
"""

import json
import sys
import hashlib
import subprocess
import time
import re
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from html import unescape
from urllib.parse import urlparse, quote
from concurrent.futures import ThreadPoolExecutor, as_completed

import feedparser

SCRIPTS_DIR = Path(__file__).parent
SKILL_DIR = SCRIPTS_DIR.parent

_SKILL_CONFIG = SKILL_DIR / "references" / "rss_config.json"
_WORKSPACE_CONFIG = SCRIPTS_DIR.parent.parent / "knowledge" / "rss_config.json"
CONFIG_PATH = _SKILL_CONFIG if _SKILL_CONFIG.exists() else _WORKSPACE_CONFIG

# 缓存目录
CACHE_DIR = Path("/tmp/daily_news_cache")
CACHE_DIR.mkdir(exist_ok=True)

CST = timezone(timedelta(hours=8))

DEFAULT_FEEDS = {
    # 泛科技
    "ithome": "https://www.ithome.com/rss/",
    "36kr": "https://36kr.com/feed",
    "wallstreetcn": "https://plink.anyfeeder.com/weixin/wallstreetcn",
    "readhub": "https://readhub.cn/rss",
    "tmtpost": "https://www.tmtpost.com/rss.xml",
    "zaobao": "https://plink.anyfeeder.com/zaobao/realtime/china",
    "laoyaoba": "https://www.laoyaoba.com/api/rss/hbb",
    # 手机行业
    "cnbeta": "https://rss.cnbeta.com/rss",
    # 国际财经/政策
    "reuters_world": "https://feeds.reuters.com/Reuters/worldNews",
    "reuters_tech": "https://feeds.reuters.com/reuters/technologyNews",
    "bloomberg-wsj": "https://plink.anyfeeder.com/barrons/international-markets",
    "scmp_tech": "https://www.scmp.com/rss/5/feed",
}

# 无 RSS 源：通过 Playwright 百度搜索补充
NO_RSS_SOURCES = {
    "yicai": {"name": "第一财经", "query": "第一财经 今日 财经新闻"},
    "cls": {"name": "财联社", "query": "财联社 最新 快讯"},
    "sina_finance": {"name": "新浪财经", "query": "新浪财经 今日 宏观"},
    "itbear": {"name": "ITBEAR", "query": "ITBEAR 人工智能 最新"},
    "latepost": {"name": "晚点LatePost", "query": "晚点LatePost 最新 独家"},
    "techweb": {"name": "TechWeb", "query": "TechWeb 最新 科技新闻"},
    "phone_trend": {"name": "手机行业趋势", "query": "智能手机 行业 2025 2026 趋势 出货量"},
    "geopolitics_xiaomi": {"name": "小米地缘政治影响", "query": "小米 关税 制裁 海外 市场 印度 欧洲"},
}

DEFAULT_KEYWORDS = {
    "companies": [
        "小米", "Xiaomi", "Redmi", "Samsung", "三星", "Apple", "苹果",
        "Huawei", "华为", "Oppo", "Vivo", "Transsion", "传音", "Honor", "荣耀",
        "BYD", "比亚迪", "Nio", "蔚来", "Xpeng", "小鹏", "Li Auto", "理想",
        "Tesla", "特斯拉", "OpenAI", "Google", "谷歌", "Meta", "TikTok",
        "TSMC", "台积电", "Qualcomm", "高通", "MediaTek", "联发科",
        "小米集团", "小米汽车", "SU7", "SU8", "小米15", "HyperOS", "米家",
    ],
    "topics": [
        "芯片", "chip", "半导体", "semiconductor",
        "关税", "tariff", "制裁", "sanction",
        "汇率", "exchange rate", "市场份额", "market share",
        "出海", "overseas", "全球化", "global",
        "AI", "人工智能", "大模型", "LLM",
        "自动驾驶", "autonomous driving", "EV", "电动车",
        "专利", "patent", "诉讼", "lawsuit",
    ],
    "industry_impact": [
        "手机行业", "smartphone industry", "手机市场", "smartphone market",
        "智能手机出货量", "smartphone shipments", "手机供应链", "smartphone supply chain",
        "折叠屏", "foldable", "卫星通信", "satellite communication",
        "端侧大模型", "on-device AI", "NPU", "AI芯片",
        "自研芯片", "in-house chip",
    ],
    "policy_trade_impact": [
        "关税上调", "tariff increase", "加征关税", "impose tariff",
        "贸易战", "trade war", "出口管制", "export control",
        "实体清单", "entity list", "印度", "India",
        "东南亚", "Southeast Asia", "欧洲市场", "European market",
    ],
}


def load_config() -> dict:
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            return json.load(f)
    return {"feeds": DEFAULT_FEEDS, "keywords": DEFAULT_KEYWORDS, "max_hours": 24, "max_items_per_feed": 50}


def strip_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", "", text)
    text = unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def content_hash(title: str, link: str) -> str:
    raw = f"{title.strip().lower()}|{urlparse(link).path if link else ''}"
    return hashlib.md5(raw.encode()).hexdigest()


def curl_fetch(url: str, timeout: int = 10) -> str:
    """用 curl 抓取，自带超时"""
    try:
        result = subprocess.run(
            ["curl", "-sL", "--connect-timeout", "5", "--max-time", str(timeout), url],
            capture_output=True, text=True, timeout=timeout + 5,
        )
        return result.stdout if result.returncode == 0 else ""
    except Exception:
        return ""


def fetch_feed(name: str, url: str, max_items: int) -> list:
    """抓取单个 RSS feed（线程安全）"""
    items = []
    try:
        content = curl_fetch(url)
        if not content:
            print(f"[WARN] {name}: 抓取为空", file=sys.stderr)
            return items

        feed = feedparser.parse(content)
        if feed.bozo and not feed.entries:
            print(f"[WARN] {name}: 解析失败", file=sys.stderr)
            return items

        for entry in feed.entries[:max_items]:
            title = strip_html(entry.get("title", ""))
            link = entry.get("link", "")
            summary = strip_html(entry.get("summary", "") or entry.get("description", ""))
            published = entry.get("published_parsed") or entry.get("updated_parsed")

            items.append({
                "title": title,
                "link": link,
                "summary": summary[:500],
                "source": name,
                "published": time.strftime("%Y-%m-%d %H:%M", published) if published else "",
                "hash": content_hash(title, link),
            })
        print(f"[INFO] {name}: {len(items)} 条", file=sys.stderr)
    except Exception as e:
        print(f"[ERROR] {name}: {e}", file=sys.stderr)
    return items


def fetch_all_feeds(feeds: dict, max_items: int) -> list:
    """并发抓取所有 RSS feeds"""
    all_items = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {
            executor.submit(fetch_feed, name, url, max_items): name
            for name, url in feeds.items()
        }
        for future in as_completed(futures):
            name = futures[future]
            try:
                items = future.result(timeout=30)
                all_items.extend(items)
            except Exception as e:
                print(f"[ERROR] {name}: 并发异常 {e}", file=sys.stderr)
    return all_items


def fetch_no_rss_sources(config: dict) -> list:
    """通过 Playwright 百度搜索无 RSS 源的新闻"""
    no_rss = config.get("no_rss_sources", NO_RSS_SOURCES)
    if not no_rss:
        return []

    # Find Chrome
    chrome_path = None
    search_root = "/root/.cache/ms-playwright"
    if os.path.isdir(search_root):
        for dirpath, dirnames, filenames in os.walk(search_root):
            if "chrome" in filenames:
                chrome_path = os.path.join(dirpath, "chrome")
                break
    if not chrome_path:
        print("[WARN] 无 RSS 源：Chromium 未安装，跳过", file=sys.stderr)
        return []

    items = []

    def _fetch_one_source(source_id: str, source_info: dict) -> list:
        if not isinstance(source_info, dict):
            return []
        name = source_info.get("name", source_id)
        query = source_info.get("query", "")
        encoded_query = quote(query, safe="").replace("%20", "+")

        js_code = (
            "const { chromium } = require('/app/node_modules/playwright');\n"
            "(async () => {\n"
            "    const browser = await chromium.launch({ headless: true, executablePath: '"
            + chrome_path
            + "' });\n"
            "    const page = await browser.newPage();\n"
            "    try {\n"
            "        await page.goto('https://www.baidu.com/s?wd="
            + encoded_query
            + "&rn=10', { waitUntil: 'domcontentloaded', timeout: 12000 });\n"
            "        const results = await page.evaluate(() => {\n"
            "            const items = [];\n"
            "            document.querySelectorAll('h3 a').forEach(a => {\n"
            "                const text = a.innerText.trim();\n"
            "                if (!text || text.length < 5) return;\n"
            "                let url = a.href;\n"
            "                try { const u = new URL(url); if (u.pathname === '/link' && u.searchParams.has('url')) url = u.searchParams.get('url'); } catch(e) {}\n"
            "                if (!url || url.includes('javascript:')) return;\n"
            "                items.push({ title: text, url: url, snippet: '' });\n"
            "            });\n"
            "            return items.slice(0, 5);\n"
            "        });\n"
            "        console.log(JSON.stringify(results));\n"
            "    } catch(e) {\n"
            "        console.error('[WARN] "
            + name
            + ": ' + e.message);\n"
            "        console.log('[]');\n"
            "    }\n"
            "    await browser.close();\n"
            "})();\n"
        )

        results = []
        try:
            result = subprocess.run(
                ["node", "-e", js_code],
                capture_output=True,
                text=True,
                timeout=20,
                env={**os.environ, "PLAYWRIGHT_BROWSERS_PATH": "/root/.cache/ms-playwright"},
            )
            if result.returncode == 0 and result.stdout.strip():
                data = json.loads(result.stdout.strip())
                for r in data:
                    results.append({
                        "title": r["title"],
                        "link": r["url"],
                        "summary": r.get("snippet", "")[:500],
                        "source": name,
                        "published": "",
                        "hash": content_hash(r["title"], r["url"]),
                    })
                print(f"[INFO] {name}: {len(data)} 条", file=sys.stderr)
            else:
                print(f"[WARN] {name}: 无结果", file=sys.stderr)
        except Exception as e:
            print(f"[ERROR] {name}: {e}", file=sys.stderr)
        return results

    # 并发抓取百度搜索
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(_fetch_one_source, sid, sinfo): sid
            for sid, sinfo in no_rss.items()
        }
        for future in as_completed(futures):
            try:
                items.extend(future.result(timeout=30))
            except Exception as e:
                print(f"[ERROR] 百度搜索并发异常: {e}", file=sys.stderr)

    print(f"[INFO] 无 RSS 源抓取: {len(items)} 条", file=sys.stderr)
    return items


def classify_item(title: str, summary: str, keywords: dict) -> list:
    """给新闻打分类标签"""
    text = f"{title} {summary}".lower()
    categories = []
    xiaomi_kw = [kw.lower() for kw in keywords.get("companies", [])[:12]] + [
        "小米集团", "小米汽车", "su7", "su8", "小米15", "hyperos", "米家"
    ]
    if any(kw in text for kw in xiaomi_kw):
        categories.append("小米直接相关")
    if any(kw.lower() in text for kw in keywords.get("industry_impact", [])):
        categories.append("手机行业动态")
    if any(kw.lower() in text for kw in keywords.get("policy_trade_impact", [])):
        categories.append("贸易政策变化")
    if not categories:
        categories.append("泛科技")
    return categories


def is_noisy(title: str, summary: str) -> bool:
    """反向过滤：排除明显无关的内容"""
    text = f"{title} {summary}".lower()
    noise_patterns = [
        "体育", "sports", "nba", "世界杯", "足球", "篮球",
        "电影", "movie", "电视剧", "综艺", "娱乐八卦",
        "游戏攻略", "gaming", "旅游", "travel", "美食", "food",
        "时尚", "fashion", "护肤", "美容", "化妆品",
        "房产", "real estate", "二手房", "租房", "中介",
        "招聘", "求职", "职场", "猎头",
        "健康", "养生", "医疗", "hospital", "疫苗",
        "广告", "优惠券", "促销", "打折",
        "拼多多", "美团外卖", "饿了么",
    ]
    return any(noise in text for noise in noise_patterns)


def get_cache_path() -> Path:
    """获取今天的缓存文件路径"""
    today = datetime.now(tz=CST).strftime("%Y%m%d")
    return CACHE_DIR / f"rss_candidates_{today}.json"


def load_cache() -> list | None:
    """加载今天的缓存，返回 None 表示无缓存"""
    cache_path = get_cache_path()
    if cache_path.exists():
        try:
            data = json.loads(cache_path.read_text(encoding="utf-8"))
            age_min = (time.time() - cache_path.stat().st_mtime) / 60
            print(f"[INFO] 使用缓存: {len(data)} 条 (缓存龄: {age_min:.0f}分钟)", file=sys.stderr)
            return data
        except Exception as e:
            print(f"[WARN] 缓存损坏，重新抓取: {e}", file=sys.stderr)
    return None


def save_cache(items: list):
    """保存抓取结果到缓存"""
    cache_path = get_cache_path()
    cache_path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[INFO] 缓存已保存: {len(items)} 条 → {cache_path}", file=sys.stderr)
    # 清理旧缓存（保留最近 3 天）
    cutoff = datetime.now(tz=CST) - timedelta(days=3)
    for f in CACHE_DIR.glob("rss_candidates_*.json"):
        try:
            date_str = f.stem.split("_")[-1]
            file_date = datetime.strptime(date_str, "%Y%m%d").replace(tzinfo=CST)
            if file_date < cutoff:
                f.unlink()
                print(f"[INFO] 清理旧缓存: {f.name}", file=sys.stderr)
        except (ValueError, OSError):
            pass


def main():
    # 检查是否强制刷新
    force_refresh = "--refresh" in sys.argv or "--force" in sys.argv

    # 尝试加载缓存
    if not force_refresh:
        cached = load_cache()
        if cached is not None:
            print(json.dumps(cached, ensure_ascii=False, indent=2))
            return

    config = load_config()
    feeds = config.get("feeds", DEFAULT_FEEDS)
    keywords = config.get("keywords", DEFAULT_KEYWORDS)
    max_items = config.get("max_items_per_feed", 50)

    t0 = time.time()

    # 1. 并发抓取 RSS
    all_items = fetch_all_feeds(feeds, max_items)
    print(f"[INFO] RSS 抓取: {len(all_items)} 条 ({time.time()-t0:.1f}s)", file=sys.stderr)

    # 2. 抓取无 RSS 源
    all_items.extend(fetch_no_rss_sources(config))
    print(f"[INFO] 总抓取: {len(all_items)} 条 ({time.time()-t0:.1f}s)", file=sys.stderr)

    # 3. 去重
    seen = set()
    deduped = []
    for item in all_items:
        if item["hash"] not in seen:
            seen.add(item["hash"])
            deduped.append(item)
    print(f"[INFO] 去重后: {len(deduped)} 条", file=sys.stderr)

    # 4. 反向过滤
    filtered = [i for i in deduped if not is_noisy(i["title"], i["summary"])]
    print(f"[INFO] 过滤后: {len(filtered)} 条", file=sys.stderr)

    # 5. 添加 ID + 分类标签
    for idx, item in enumerate(filtered):
        item["categories"] = classify_item(item["title"], item["summary"], keywords)
        item["id"] = idx

    print(f"[INFO] 总耗时: {time.time()-t0:.1f}s", file=sys.stderr)

    # 6. 保存缓存
    save_cache(filtered)

    # 7. 输出
    print(json.dumps(filtered, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
