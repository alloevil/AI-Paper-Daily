#!/bin/bash
# wiki-sync.sh — 扫描 workspace 变更，自动 ingest 新增/修改的 .md 文件
# 用法: bash scripts/wiki-sync.sh [--dry-run]

set -uo pipefail

WORKSPACE="/root/.openclaw/workspace"
WIKI_SOURCES="/root/.openclaw/wiki/main/sources"
STATE_FILE="/root/.openclaw/workspace/.wiki-sync-state"
DRY_RUN="${1:-}"

# 1. 收集 workspace 中所有 .md 文件（排除指定目录）
mapfile -t WORKSPACE_FILES < <(find "$WORKSPACE" -maxdepth 4 -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/.openclaw/wiki/*" \
  -not -path "*/tmp/*" \
  -not -path "*/.oh-my-zsh/*" \
  -not -path "*/.mempalace-install/*" \
  -not -path "*/.jdk/*" \
  -not -path "*/.persist/*" \
  -not -path "*/.pre-dedup-backup/*" \
  -not -path "*/browser-harness/domain-skills/*" \
  -not -path "*/evolver/.github/*" \
  -not -path "*/evolver/examples/*" \
  -not -path "*/llm-eval/*" \
  -not -path "*/kg-research-v3-auto/*" \
  -type f | sort)

# 2. 收集 wiki sources 中所有 .md 文件名（用于快速查重）
declare -A WIKI_INDEX
for f in "$WIKI_SOURCES"/*.md; do
  [ -f "$f" ] || continue
  WIKI_INDEX["$(basename "${f,,}" .md)"]="$f"
done

# 3. 加载上次状态（文件路径 -> md5）
declare -A PREV_STATE
if [ -f "$STATE_FILE" ]; then
  while IFS='|' read -r path hash; do
    [ -n "$path" ] && PREV_STATE["$path"]="$hash"
  done < "$STATE_FILE"
fi

# 4. 对比，找出新增/变更
NEW_FILES=()
CHANGED_FILES=()
CURRENT_STATE=""

for f in "${WORKSPACE_FILES[@]}"; do
  REL="${f#$WORKSPACE/}"
  MD5=$(md5sum "$f" 2>/dev/null | cut -d' ' -f1)
  CURRENT_STATE+="$REL|$MD5"$'\n'

  BASENAME=$(basename "${f,,}" .md)
  if [ -n "${WIKI_INDEX[$BASENAME]+x}" ]; then
    PREV_MD5="${PREV_STATE[$REL]:-}"
    if [ -n "$PREV_MD5" ] && [ "$PREV_MD5" != "$MD5" ]; then
      CHANGED_FILES+=("$REL")
    fi
  else
    NEW_FILES+=("$REL")
  fi
done

# 5. 输出结果
echo "=== Wiki Sync Report ==="
echo "Workspace files scanned: ${#WORKSPACE_FILES[@]}"
echo "Wiki sources: ${#WIKI_INDEX[@]}"
echo "New files: ${#NEW_FILES[@]}"
echo "Changed files: ${#CHANGED_FILES[@]}"

if [ ${#NEW_FILES[@]} -gt 0 ]; then
  echo ""
  echo "--- New files ---"
  for f in "${NEW_FILES[@]}"; do
    echo "  + $f"
  done
fi

if [ ${#CHANGED_FILES[@]} -gt 0 ]; then
  echo ""
  echo "--- Changed files ---"
  for f in "${CHANGED_FILES[@]}"; do
    echo "  ~ $f"
  done
fi

# 6. 执行 ingest（非 dry-run 时）
if [ "$DRY_RUN" != "--dry-run" ]; then
  ALL_FILES=("${NEW_FILES[@]}" "${CHANGED_FILES[@]}")
  if [ ${#ALL_FILES[@]} -gt 0 ]; then
    echo ""
    echo "Ingesting ${#ALL_FILES[@]} files..."
    SUCCESS=0
    FAIL=0
    for f in "${ALL_FILES[@]}"; do
      FULL="$WORKSPACE/$f"
      echo "  ingesting: $f"
      if openclaw wiki ingest "$FULL" 2>&1 | tail -1; then
        SUCCESS=$((SUCCESS+1))
      else
        FAIL=$((FAIL+1))
      fi
    done
    echo -n "$CURRENT_STATE" > "$STATE_FILE"
    echo "Done: $SUCCESS ok, $FAIL failed. State saved."
  else
    echo ""
    echo "No changes. Nothing to ingest."
    echo -n "$CURRENT_STATE" > "$STATE_FILE"
  fi
else
  echo ""
  echo "[DRY RUN] No files ingested."
fi
