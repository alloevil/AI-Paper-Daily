#!/usr/bin/env bash
# status.sh -- 查询问答任务状态
# 用法: status.sh <task_id>
# 输出: JSON { "task_id": "...", "status": "running|completed|failed", "final_response": "...", ... }
# 环境变量: ATLAS_BASE_URL (默认 http://xmmionegw.b2c.srv/mtop/mrp)

set -euo pipefail

BASE_URL="${ATLAS_BASE_URL:-http://xmmionegw.b2c.srv/mtop/mrp}"
TASK_ID="${1:?用法: status.sh <task_id>}"

curl -sS -X POST "${BASE_URL}/host/tasks/status" \
  -H "Content-Type: application/json" \
  -d "{\"task_id\": \"${TASK_ID}\"}"
