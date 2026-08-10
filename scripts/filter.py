"""AI 论文筛选和摘要"""

import json
import os
import re
import urllib.request
from typing import List, Dict, Optional


def call_llm(prompt: str, model: str = "gpt-4o-mini") -> str:
    """调用 LLM API"""
    api_key = os.environ.get("LLM_API_KEY", "")
    base_url = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1")

    if not api_key:
        print("[Filter] No LLM_API_KEY, skipping AI filter")
        return ""

    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
        "max_tokens": 4000,
    }).encode()

    req = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode())
            return result["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"[Filter] LLM error: {e}")
        return ""


def filter_papers(papers: List[Dict], keywords: List[str],
                  max_papers: int = 10, language: str = "zh") -> List[Dict]:
    """用 AI 筛选论文并生成摘要"""
    if not papers:
        return []

    # 构建论文列表给 LLM
    paper_list = []
    for i, p in enumerate(papers):
        stars_info = f" ⭐{p.get('stars', 0)}" if p.get('stars') else ""
        code_info = " 📦有代码" if p.get('has_code') else ""
        votes_info = f" 👍{p.get('votes', 0)}" if p.get('votes') else ""

        paper_list.append(
            f"[{i}] {p['title']}{votes_info}{stars_info}{code_info}\n"
            f"    {p['abstract'][:200]}..."
        )

    lang_hint = "用中文" if language == "zh" else "in English"

    prompt = f"""你是一位 AI 研究助手。从以下论文中筛选出最有价值的 {max_papers} 篇。

筛选标准：
1. 与关键词相关性高：{', '.join(keywords)}
2. 有创新性或实用价值
3. 有开源代码的优先
4. 社区投票/星标多的优先

对每篇选中的论文，{lang_hint}写一句话摘要（30字以内），说明为什么值得读。

论文列表：
{chr(10).join(paper_list)}

请返回 JSON 数组，格式如下：
[{{"index": 0, "reason": "一句话推荐理由"}}, ...]

只返回 JSON，不要其他内容。"""

    result = call_llm(prompt)
    if not result:
        # LLM 不可用时，按投票/星标排序取前 N
        sorted_papers = sorted(papers, key=lambda x: (
            x.get("votes", 0) + x.get("stars", 0) + (10 if x.get("has_code") else 0)
        ), reverse=True)
        selected = sorted_papers[:max_papers]
        for p in selected:
            p["reason"] = "高票/有代码" if p.get("has_code") or p.get("votes", 0) > 0 else "最新论文"
        return selected

    # 解析 LLM 返回
    try:
        # 提取 JSON 数组（容忍 markdown 代码块或前后杂文）
        m = re.search(r"\[.*\]", result, re.DOTALL)
        if not m:
            raise json.JSONDecodeError("no JSON array found", result, 0)
        selections = json.loads(m.group(0))
    except json.JSONDecodeError:
        print(f"[Filter] Failed to parse LLM response: {result[:200]}")
        sorted_papers = sorted(papers, key=lambda x: x.get("votes", 0) + x.get("stars", 0), reverse=True)
        selected = sorted_papers[:max_papers]
        for p in selected:
            p["reason"] = "AI 筛选失败，按热度排序"
        return selected

    # 应用筛选结果（去重索引，截断到 max_papers）
    selected = []
    used = set()
    for sel in selections:
        if len(selected) >= max_papers:
            break
        idx = sel.get("index", -1)
        if isinstance(idx, int) and 0 <= idx < len(papers) and idx not in used:
            used.add(idx)
            paper = papers[idx]
            paper["reason"] = sel.get("reason", "")
            selected.append(paper)

    print(f"[Filter] Selected {len(selected)} papers from {len(papers)} candidates")
    return selected
