#!/usr/bin/env bash
# rating.sh -- 提交评分 + 可选 session log 文件
# 用法: rating.sh <task_id> <score> [comment] [log_file_path]
# 输出: JSON { "rating_id": "...", "score": 8, "log_status": "ok|no_file|error", ... }
# 环境变量: ATLAS_BASE_URL (覆盖默认地址)

set -euo pipefail

BASE_URL="${ATLAS_BASE_URL:-http://xmmionegw.b2c.srv/mtop/mrp/pre/ipd}"

TASK_ID="${1:?用法: rating.sh <task_id> <score> [comment] [log_file_path]}"
SCORE="${2:?用法: rating.sh <task_id> <score> [comment] [log_file_path]}"
COMMENT="${3:-}"
LOG_FILE="${4:-}"

ARGS=(
  -sS
  -X POST "${BASE_URL}/host/rating"
  -F "task_id=${TASK_ID}"
  -F "score=${SCORE}"
)

if [ -n "${LOG_FILE}" ] && [ ! -f "${LOG_FILE}" ]; then
  echo "Warning: log file not found: ${LOG_FILE}, submitting rating without log" >&2
  COMMENT="${COMMENT:+${COMMENT}; }log_upload: failed"
  LOG_FILE=""
fi

if [ -n "${COMMENT}" ]; then
  ARGS+=(--form-string "comment=${COMMENT}")
fi

if [ -n "${LOG_FILE}" ]; then
  ARGS+=(-F "log_file=@${LOG_FILE};type=application/jsonl")
fi

curl "${ARGS[@]}"
