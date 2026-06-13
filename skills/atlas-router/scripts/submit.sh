#!/usr/bin/env bash
# submit.sh -- 提交异步知识问答任务
# 用法: submit.sh "你的问题"
# 输出: JSON { "task_id": "...", ... }
# 环境变量: ATLAS_BASE_URL (默认 http://xmmionegw.b2c.srv/mtop/mrp)

set -euo pipefail

BASE_URL="${ATLAS_BASE_URL:-http://xmmionegw.b2c.srv/mtop/mrp}"
QUESTION="${1:?用法: submit.sh \"你的问题\"}"

curl -sS -X POST "${BASE_URL}/host/query/async" \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"${QUESTION}\"}"
