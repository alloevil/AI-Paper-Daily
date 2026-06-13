#!/usr/bin/env python3
"""
每日科技情报主脚本
流程：读知识库精筛标准 → 跑 rss_fetch → 读飞书表格参考 → AI 精筛 → 输出结果
"""

import json
import sys
import subprocess
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta

WORKSPACE = Path(__file__).parent.parent
SKILL_DOC = WORKSPACE / "knowledge" / "技术方案" / "RSS新闻筛选项目.md"
RECENT_NEWS_FILE = WORKSPACE / "memory" / "recent_news.json"

# ─────────────────────────────────────────────
# 1. 从知识库提取关键段落
# ─────────────────────────────────────────────

def extract_section(text: str, heading: str) -> str:
    """提取指定标题到下一个标题之间的内容"""
    parts = re.split(r"(?m)^#{1,3} ", text)
    for part in parts:
        if part.startswith(heading):
            # 去掉标题行本身，返回正文
            body = part[len(heading):].strip()
            return body
    return ""


def load_skill_context() -> dict:
    if not SKILL_DOC.exists():
        print(f"[ERROR] 知识库文件不存在: {SKILL_DOC}", file=sys.stderr)
        sys.exit(1)

    text = SKILL_DOC.read_text(encoding="utf-8")

    return {
        "filter_criteria": extract_section(text, "筛选逻辑（核心）"),
        "output_format":   extract_section(text, "输出格式（必须严格遵守）"),
    }


# ─────────────────────────────────────────────
# 2. 运行 rss_fetch.py 获取候选新闻
# ─────────────────────────────────────────────

def fetch_candidates() -> list:
    script = WORKSPACE / "scripts" / "rss_fetch.py"
    print("[INFO] 运行 rss_fetch.py ...", file=sys.stderr)
    result = subprocess.run(
        [sys.executable, str(script)],
        capture_output=True, text=True, timeout=120,
        cwd=str(WORKSPACE)
    )
    # 打印 stderr（进度日志）
    if result.stderr:
        print(result.stderr, file=sys.stderr, end="")

    if result.returncode != 0:
        print(f"[ERROR] rss_fetch.py 退出码 {result.returncode}", file=sys.stderr)
        return []

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as e:
        print(f"[ERROR] 解析候选新闻失败: {e}", file=sys.stderr)
        return []


# ─────────────────────────────────────────────
# 3. 去重：读取最近两天已发新闻
# ─────────────────────────────────────────────

def load_recent_titles(days: int = 2) -> list[str]:
    """读取最近 N 天已发送的新闻标题"""
    if not RECENT_NEWS_FILE.exists():
        return []
    try:
        data = json.loads(RECENT_NEWS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []

    cutoff = datetime.now(tz=timezone(timedelta(hours=8))) - timedelta(days=days)
    cutoff_str = cutoff.strftime("%Y-%m-%d")
    titles = []
    for entry in data:
        if entry.get("date", "") >= cutoff_str:
            titles.extend(entry.get("titles", []))
    return titles


def save_today_titles(titles: list[str]):
    """保存今日已发新闻标题"""
    today_str = datetime.now(tz=timezone(timedelta(hours=8))).strftime("%Y-%m-%d")
    data = []
    if RECENT_NEWS_FILE.exists():
        try:
            data = json.loads(RECENT_NEWS_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            data = []

    # 移除今天的旧记录
    data = [e for e in data if e.get("date") != today_str]
    data.append({"date": today_str, "titles": titles})

    # 只保留最近 7 天
    cutoff = datetime.now(tz=timezone(timedelta(hours=8))) - timedelta(days=7)
    cutoff_str = cutoff.strftime("%Y-%m-%d")
    data = [e for e in data if e.get("date", "") >= cutoff_str]

    RECENT_NEWS_FILE.parent.mkdir(parents=True, exist_ok=True)
    RECENT_NEWS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# ─────────────────────────────────────────────
# 4. 构建发给 AI 的 prompt
# ─────────────────────────────────────────────

def build_prompt(candidates: list, skill: dict, reference_news: str = "", recent_titles: list[str] | None = None) -> str:
    today = datetime.now(tz=timezone(timedelta(hours=8))).strftime("%Y%m%d")

    candidates_text = ""
    for item in candidates:
        candidates_text += (
            f"[{item['id']}] [{item['source']}] {item['title']}\n"
            f"  链接: {item.get('link', '')}\n"
            f"  摘要: {item.get('summary', '')[:200]}\n"
            f"  标签: {', '.join(item.get('categories', []))}\n\n"
        )

    ref_section = ""
    if reference_news:
        ref_section = f"""
---
【参考源：飞书表格（风格参考，仅作质量标准参考，勿去重）】
{reference_news[:2000]}
---
"""

    dedup_section = ""
    if recent_titles:
        titles_text = "\n".join(f"  - {t}" for t in recent_titles[:60])
        dedup_section = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【去重：最近两天已发送的新闻标题，以下新闻不得重复入选】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{titles_text}

如果候选新闻与上述已发新闻主题高度相似（如同一事件的不同报道），直接跳过，不要重复选取。
"""

    prompt = f"""今天是 {today}，执行每日科技情报精筛任务。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【精筛标准】（来自知识库，必须严格遵守）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{skill['filter_criteria']}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【输出格式】（来自知识库，必须严格遵守）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{skill['output_format']}
{ref_section}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【候选新闻】（共 {len(candidates)} 条，从中精选 8-12 条）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{candidates_text}

请按上述精筛标准和输出格式，输出今日科技情报（中英双语）。"""

    return prompt


# ─────────────────────────────────────────────
# 5. 主流程
# ─────────────────────────────────────────────

def main():
    # 步骤 1：读知识库
    print("[INFO] 读取知识库精筛标准 ...", file=sys.stderr)
    skill = load_skill_context()
    print(f"[INFO] 精筛标准: {len(skill['filter_criteria'])} 字符", file=sys.stderr)
    print(f"[INFO] 输出格式: {len(skill['output_format'])} 字符", file=sys.stderr)

    # 步骤 2：抓候选新闻
    candidates = fetch_candidates()
    if not candidates:
        print("[WARN] 候选新闻为空，跳过精筛", file=sys.stderr)
        sys.exit(0)
    print(f"[INFO] 候选新闻: {len(candidates)} 条", file=sys.stderr)

    # 步骤 3：读取最近已发标题（去重用）
    recent_titles = load_recent_titles(days=2)
    print(f"[INFO] 最近 2 天已发标题: {len(recent_titles)} 条", file=sys.stderr)

    # 步骤 4：构建 prompt 并输出（供 cron Agent 调用 AI 精筛）
    # 注意：此脚本不直接调 AI，而是把 prompt 输出给 cron Agent 执行
    # cron Agent 读取此 prompt 后用 AI 精筛，再推送结果
    prompt = build_prompt(candidates, skill, recent_titles=recent_titles)

    print("\n" + "="*60, file=sys.stderr)
    print("[INFO] Prompt 已构建，输出供 Agent 使用", file=sys.stderr)
    print("="*60 + "\n", file=sys.stderr)

    # stdout 输出 prompt，供 cron 调用
    print(prompt)


if __name__ == "__main__":
    main()
