#!/bin/bash
# 多源搜索脚本 - 聚合 Tavily + HackerNews + GitHub
# 用法: ./search.sh "关键词" [max_results]

QUERY="$1"
MAX="${2:-5}"
TAVILY_KEY="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"

if [ -z "$QUERY" ]; then
  echo "用法: $0 \"搜索关键词\" [max_results]"
  exit 1
fi

echo "🔍 搜索: $QUERY"
echo "================================"

# 1. Tavily (全网搜索)
echo ""
echo "📡 Tavily 全网搜索:"
curl -s -X POST "https://api.tavily.com/search" \
  -H "Content-Type: application/json" \
  -d "{\"api_key\":\"$TAVILY_KEY\",\"query\":\"$QUERY\",\"max_results\":$MAX}" 2>/dev/null | \
  python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  for r in d.get('results',[]):
    print(f\"  [{r.get('score',0):.2f}] {r['title']}\")
    print(f\"  └─ {r['url']}\")
    content = r.get('content','')[:150]
    if content:
      print(f\"     {content}...\")
    print()
except: print('  (解析失败)')
"

# 2. HackerNews (技术社区)
echo "🔶 HackerNews 搜索:"
curl -s "https://hn.algolia.com/api/v1/search?query=$(python3 -c "import urllib.parse;print(urllib.parse.quote('$QUERY'))")&hitsPerPage=$MAX" 2>/dev/null | \
  python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  for h in d.get('hits',[]):
    print(f\"  [{h.get('points',0)}pts] {h.get('title','?')}\")
    print(f\"  └─ https://news.ycombinator.com/item?id={h['objectID']}\")
    print()
except: print('  (解析失败)')
"

# 3. GitHub (代码/项目)
echo "🐙 GitHub 搜索:"
curl -s "https://api.github.com/search/repositories?q=$(python3 -c "import urllib.parse;print(urllib.parse.quote('$QUERY'))")&sort=stars&per_page=$MAX" 2>/dev/null | \
  python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  for r in d.get('items',[]):
    print(f\"  [⭐{r['stargazers_count']}] {r['full_name']}\")
    print(f\"  └─ {r.get('description','')[:100]}\")
    print()
except: print('  (解析失败)')
"

echo "================================"
echo "✅ 搜索完成"
