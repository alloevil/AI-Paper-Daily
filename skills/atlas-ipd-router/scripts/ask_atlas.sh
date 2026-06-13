#!/usr/bin/env bash
# ask_atlas.sh -- 提交异步问题，不轮询结果
# 用法: ask_atlas.sh "问题" [session_id] [complexity=complex]
# 输出: 精简 JSON
#   成功: {"task_id":"...","session_id":"...","status":"pending","accepted_at":"...","request_id":null}
#   失败: {"status":"failed","error":"..."}
# 环境变量: ATLAS_BASE_URL (覆盖默认网关地址)

set -euo pipefail

BASE_URL="${ATLAS_BASE_URL:-http://xmmionegw.b2c.srv/mtop/mrp/pre/ipd}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAW_CALL_JS="${SCRIPT_DIR}/claw_call.js"

QUESTION="${1:?用法: ask_atlas.sh \"问题\" [session_id] [complexity=complex]}"
ARG2="${2:-}"
ARG3="${3:-}"
SESSION_ID="$ARG2"
COMPLEXITY_ARG="$ARG3"
COMPLEXITY=""

_emit_failure() {
  local message="$1"
  MESSAGE="$message" python3 - <<'PY'
import json
import os

print(json.dumps({"status": "failed", "error": os.environ["MESSAGE"]}, ensure_ascii=False))
PY
}

_normalize_complexity() {
  local raw key value
  if [ -z "$COMPLEXITY_ARG" ] && [ -n "$SESSION_ID" ]; then
    raw="$(printf '%s' "$SESSION_ID" | tr '[:upper:]' '[:lower:]')"
    raw="${raw//[[:space:]]/}"
    case "$raw" in
      low|medium|complex|*=*)
        COMPLEXITY_ARG="$SESSION_ID"
        SESSION_ID=""
        ;;
    esac
  fi

  raw="$(printf '%s' "$COMPLEXITY_ARG" | tr '[:upper:]' '[:lower:]')"
  raw="${raw//[[:space:]]/}"
  if [ -z "$raw" ]; then
    COMPLEXITY=""
    return 0
  fi

  if [[ "$raw" == *=* ]]; then
    key="${raw%%=*}"
    value="${raw#*=}"
    if [ "$key" != "complexity" ]; then
      _emit_failure "复杂度参数仅支持 complexity=complex"
      exit 1
    fi
    raw="$value"
  else
    _emit_failure "复杂度参数仅支持 complexity=complex"
    exit 1
  fi

  case "$raw" in
    complex)
      COMPLEXITY="$raw"
      ;;
    *)
      _emit_failure "complexity 仅支持 complex"
      exit 1
      ;;
  esac
}

_normalize_complexity

_build_submit_body() {
  QUESTION="$QUESTION" SESSION_ID="$SESSION_ID" COMPLEXITY="$COMPLEXITY" python3 - <<'PY'
import json
import os

body = {"question": os.environ["QUESTION"]}
session_id = os.environ.get("SESSION_ID", "")
if session_id:
    body["session_id"] = session_id

complexity = os.environ.get("COMPLEXITY", "")
if complexity:
    body["complexity"] = complexity

env = {}
sid = os.environ.get("X-ClawSid", "")
if sid:
    env["X-ClawSid"] = sid
token = os.environ.get("X-ClawToken", "")
if token:
    env["X-ClawToken"] = token
if env:
    body["env"] = env

print(json.dumps(body, ensure_ascii=False))
PY
}

_submit_once() {
  local body http_code body_file err_file
  body="$(_build_submit_body)"
  body_file="$(mktemp)"
  err_file="$(mktemp)"

  if [ -f "$CLAW_CALL_JS" ]; then
    if ! node "$CLAW_CALL_JS" POST "${BASE_URL}/host/query/async" "$body" > "$body_file" 2>"$err_file"; then
      # claw_call.js failed (missing deps etc), fallback to curl
      if ! http_code=$(curl -sS -w '%{http_code}' -o "$body_file" \
        -X POST "${BASE_URL}/host/query/async" \
        -H "Content-Type: application/json" \
        -d "$body" 2>"$err_file"); then
        rm -f "$body_file" "$err_file"
        return 1
      fi
    else
      http_code="200"
    fi
  else
    if ! http_code=$(curl -sS -w '%{http_code}' -o "$body_file" \
      -X POST "${BASE_URL}/host/query/async" \
      -H "Content-Type: application/json" \
      -d "$body" 2>"$err_file"); then
      rm -f "$body_file" "$err_file"
      return 1
    fi
  fi

  if [ "$http_code" = "503" ]; then
    rm -f "$body_file" "$err_file"
    echo '{"status":"busy","error":"系统繁忙，请稍后重试"}'
    exit 0
  fi

  if [ "$http_code" = "409" ]; then
    RESPONSE_BODY="$(cat "$body_file" 2>/dev/null || true)" python3 - <<'PY'
import json
import os

raw = os.environ.get("RESPONSE_BODY", "")
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    data = {}
detail = data.get("detail") if isinstance(data, dict) else {}
if not isinstance(detail, dict):
    detail = {}
result = {
    "task_id": detail.get("task_id", ""),
    "session_id": detail.get("session_id") or detail.get("task_id", ""),
    "status": detail.get("status", "running"),
    "error": detail.get("message", "Session already has an active async query"),
}
print(json.dumps(result, ensure_ascii=False))
PY
    rm -f "$body_file" "$err_file"
    exit 0
  fi

  if [ "$http_code" = "429" ]; then
    rm -f "$body_file" "$err_file"
    return 1
  fi

  if [ "$http_code" -ge 500 ]; then
    rm -f "$body_file" "$err_file"
    return 1
  fi

  if [ "$http_code" -ge 400 ]; then
    local response_body
    response_body="$(cat "$body_file" 2>/dev/null || true)"
    rm -f "$body_file" "$err_file"
    RESPONSE_BODY="$response_body" HTTP_CODE="$http_code" python3 - <<'PY'
import json
import os

raw = os.environ.get("RESPONSE_BODY", "")
message = raw
try:
    data = json.loads(raw)
    detail = data.get("detail") if isinstance(data, dict) else None
    if isinstance(detail, str):
        message = detail
    elif detail is not None:
        message = json.dumps(detail, ensure_ascii=False)
except json.JSONDecodeError:
    pass
print(json.dumps({
    "status": "failed",
    "error": f"提交失败：HTTP {os.environ['HTTP_CODE']} {message}".strip(),
}, ensure_ascii=False))
PY
    exit 1
  fi

  cat "$body_file"
  rm -f "$body_file" "$err_file"
}

MAX_RETRIES=5
RETRY_COUNT=0
SUBMIT_RESULT=""

while [ "$RETRY_COUNT" -lt "$MAX_RETRIES" ]; do
  if SUBMIT_RESULT="$(_submit_once)"; then
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ "$RETRY_COUNT" -lt "$MAX_RETRIES" ]; then
    sleep 2
  fi
done

if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
  _emit_failure "提交失败：连续 ${MAX_RETRIES} 次网络错误或服务限流"
  exit 1
fi

SUBMIT_RESULT="$SUBMIT_RESULT" python3 - <<'PY'
import json
import os
import sys

raw = os.environ.get("SUBMIT_RESULT", "")
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print(json.dumps({"status": "failed", "error": "提交失败：响应不是合法 JSON", "raw": raw}, ensure_ascii=False))
    sys.exit(1)

task_id = data.get("task_id") or ""
if not task_id:
    if data.get("status") in {"busy", "failed"}:
        print(json.dumps(data, ensure_ascii=False))
        sys.exit(0 if data.get("status") == "busy" else 1)
    print(json.dumps({"status": "failed", "error": "提交失败：响应中无 task_id", "raw": data}, ensure_ascii=False))
    sys.exit(1)

result = {
    "task_id": task_id,
    "session_id": data.get("session_id") or task_id,
    "status": data.get("status", "pending"),
    "accepted_at": data.get("accepted_at"),
    "request_id": data.get("request_id"),
}
if data.get("error"):
    result["error"] = data.get("error")
print(json.dumps(result, ensure_ascii=False))
PY
