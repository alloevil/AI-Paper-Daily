#!/usr/bin/env python3
"""本地知识库关键字检索工具。
用法: python3 scripts/knowledge_search.py "关键词" [--path ~/.openclaw/workspace/knowledge]
"""
import sys
import os
import re
import json
import argparse
from pathlib import Path

def search_knowledge(query: str, base_path: str = None, max_results: int = 5) -> str:
    """在 knowledge/ 目录下搜索包含关键字的文件。"""
    if base_path is None:
        base_path = os.path.expanduser("~/.openclaw/workspace/knowledge")
    
    if not os.path.isdir(base_path):
        return f"知识库目录不存在: {base_path}"
    
    # 拆分关键词
    keywords = [k.strip() for k in query.split() if k.strip()]
    if not keywords:
        return "请提供搜索关键词"
    
    results = []
    
    for md_file in Path(base_path).rglob("*.md"):
        try:
            content = md_file.read_text(encoding='utf-8')
        except Exception:
            continue
        
        # 匹配：标题和内容都搜
        lines = content.split('\n')
        matched_lines = []
        total_score = 0
        
        for i, line in enumerate(lines):
            line_score = 0
            for kw in keywords:
                count = line.lower().count(kw.lower())
                if count > 0:
                    line_score += count
                    # 标题权重更高
                    if line.strip().startswith('#'):
                        line_score += 3 * count
            
            if line_score > 0:
                total_score += line_score
                matched_lines.append({
                    'line_num': i + 1,
                    'text': line.strip(),
                    'score': line_score
                })
        
        if total_score > 0:
            # 按得分排序取 top 3 行作为摘要
            matched_lines.sort(key=lambda x: x['score'], reverse=True)
            snippets = []
            for ml in matched_lines[:3]:
                # 高亮关键词
                highlighted = ml['text']
                for kw in keywords:
                    highlighted = re.sub(
                        f'({re.escape(kw)})',
                        r'**\1**',
                        highlighted,
                        flags=re.IGNORECASE
                    )
                snippets.append(f"  L{ml['line_num']}: {highlighted}")
            
            rel_path = str(md_file.relative_to(base_path))
            results.append({
                'file': rel_path,
                'score': total_score,
                'snippets': snippets
            })
    
    if not results:
        return f"知识库中未找到与 \"{query}\" 相关的内容。"
    
    # 按总分排序
    results.sort(key=lambda x: x['score'], reverse=True)
    results = results[:max_results]
    
    lines_out = [f"知识库搜索结果（\"{query}\"）：\n"]
    for i, r in enumerate(results, 1):
        lines_out.append(f"{i}. 📄 {r['file']}（相关度: {r['score']}）")
        for s in r['snippets']:
            lines_out.append(s)
        lines_out.append("")
    
    return '\n'.join(lines_out)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='本地知识库搜索')
    parser.add_argument('query', help='搜索关键词')
    parser.add_argument('--path', default=None, help='知识库路径')
    parser.add_argument('--max', type=int, default=5, help='最大结果数')
    args = parser.parse_args()
    
    print(search_knowledge(args.query, args.path, args.max))
