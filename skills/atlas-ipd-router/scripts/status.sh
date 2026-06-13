#!/usr/bin/env bash
# status.sh -- 查询异步任务状态，并提取 progress 为可读字段
# 用法: status.sh <task_id>
# 输出: 精简 JSON
#   running: {"task_id":"...","session_id":"...","status":"running","progress_stage":"executing","progress_text":"Agent 开始执行","progress_items":[...],"active_agents":[...]}
#   completed: {"task_id":"...","session_id":"...","status":"completed","answer_text":"...","duration_ms":5000,"feedback_prompt":"..."}
#   failed: {"task_id":"...","session_id":"...","status":"failed","error":"..."}
# 环境变量: ATLAS_BASE_URL (覆盖默认网关地址)

set -euo pipefail

BASE_URL="${ATLAS_BASE_URL:-http://xmmionegw.b2c.srv/mtop/mrp/pre/ipd}"

TASK_ID="${1:?用法: status.sh <task_id>}"

_build_status_body() {
  TASK_ID="$TASK_ID" python3 - <<'PY'
import json
import os

print(json.dumps({"task_id": os.environ["TASK_ID"]}, ensure_ascii=False))
PY
}

_emit_failure() {
  local message="$1"
  MESSAGE="$message" TASK_ID="$TASK_ID" python3 - <<'PY'
import json
import os

print(json.dumps({
    "task_id": os.environ.get("TASK_ID", ""),
    "status": "failed",
    "error": os.environ["MESSAGE"],
}, ensure_ascii=False))
PY
}

body="$(_build_status_body)"
body_file="$(mktemp)"
err_file="$(mktemp)"

if ! http_code=$(curl -sS -w '%{http_code}' -o "$body_file" \
  -X POST "${BASE_URL}/host/tasks/status" \
  -H "Content-Type: application/json" \
  -d "$body" 2>"$err_file"); then
  rm -f "$body_file" "$err_file"
  _emit_failure "状态查询失败：网络错误"
  exit 1
fi

response_body="$(cat "$body_file" 2>/dev/null || true)"
rm -f "$body_file" "$err_file"

if [ "$http_code" = "503" ]; then
  echo "{\"task_id\":\"${TASK_ID}\",\"status\":\"busy\",\"error\":\"系统繁忙\"}"
  exit 0
fi

if [ "$http_code" = "429" ]; then
  echo "{\"task_id\":\"${TASK_ID}\",\"status\":\"busy\",\"error\":\"状态查询被限流，请稍后重试\"}"
  exit 0
fi

if [ "$http_code" = "404" ]; then
  echo "{\"task_id\":\"${TASK_ID}\",\"status\":\"failed\",\"error\":\"任务不存在\"}"
  exit 1
fi

if [ "$http_code" -ge 400 ]; then
  RESPONSE_BODY="$response_body" HTTP_CODE="$http_code" TASK_ID="$TASK_ID" python3 - <<'PY'
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
    "task_id": os.environ.get("TASK_ID", ""),
    "status": "failed",
    "error": f"状态查询失败：HTTP {os.environ['HTTP_CODE']} {message}".strip(),
}, ensure_ascii=False))
PY
  exit 1
fi

RESPONSE_BODY="$response_body" python3 - <<'PY'
import json
import os
import re
import sys


STAGE_LABELS = {
    "starting": "正在启动",
    "recall": "正在检索上下文",
    "retrieval": "会话已就绪，准备执行",
    "executing": "Agent 正在执行",
    "answering": "执行完成，正在处理结果",
}


def _as_text(value):
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)


def _answer_text(answer):
    if isinstance(answer, dict):
        return _as_text(answer.get("answer_text") or answer.get("text") or answer.get("answer"))
    if isinstance(answer, str):
        try:
            parsed = json.loads(answer)
        except json.JSONDecodeError:
            return answer
        return _answer_text(parsed)
    return _as_text(answer)


def _clean_summary(summary, item_type="", name=""):
    text = " ".join(_as_text(summary).split())
    tool_name = _as_text(name)
    if not text:
        return ""

    lower = text.lower()
    if lower.startswith("description="):
        text = text.split("=", 1)[1].strip()
        lower = text.lower()
        if not text:
            return "正在分析任务"

    if lower.startswith("skill="):
        skill = text.split("=", 1)[1].strip()
        return f"正在调用 {skill}" if skill else "正在调用技能"

    if (
        item_type == "tool"
        and (
            lower.startswith("command=")
            or "/tmp/agentbox-sandboxes/" in text
            or "agentbox-sandboxes" in text
        )
    ):
        if tool_name.lower() == "bash":
            if " rg " in f" {lower} " or "grep" in lower:
                return "正在检索上下文"
            if "python" in lower:
                return "正在处理数据"
            return "正在执行命令"
        return f"正在调用工具 {tool_name}" if tool_name else "正在调用工具"

    text = re.sub(r"/tmp/agentbox-sandboxes/\\S+", "[workspace]", text)
    if len(text) > 120:
        return text[:117].rstrip() + "..."
    return text


def _progress_summary(progress):
    if not isinstance(progress, dict):
        return "", "", [], []

    stage = _as_text(progress.get("stage"))
    milestones = progress.get("milestones")
    if not isinstance(milestones, list):
        milestones = []

    items = []
    latest_summary = ""
    for item in milestones[-5:]:
        if not isinstance(item, dict):
            continue
        item_type = _as_text(item.get("type"))
        name = _as_text(item.get("name") or item.get("stage"))
        summary = _clean_summary(item.get("summary"), item_type, name)
        if summary:
            latest_summary = summary
        if item_type == "tool" and name and summary:
            items.append(f"{name}: {summary}")
        elif summary:
            items.append(summary)
        elif name:
            items.append(name)

    agents_raw = progress.get("agents")
    active_agents = []
    if isinstance(agents_raw, list):
        for agent in agents_raw:
            if not isinstance(agent, dict):
                continue
            if agent.get("status") != "running":
                continue
            name = _as_text(agent.get("agent_name"))
            tool = _as_text(agent.get("last_tool"))
            if name and tool:
                active_agents.append(f"{name} ({tool})")
            elif name:
                active_agents.append(name)

    progress_text = latest_summary or STAGE_LABELS.get(stage, stage)
    return stage, progress_text, items, active_agents


raw = os.environ.get("RESPONSE_BODY", "")
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print(json.dumps({
        "status": "failed",
        "error": "状态查询失败：响应不是合法 JSON",
        "raw": raw,
    }, ensure_ascii=False))
    sys.exit(1)

status = _as_text(data.get("status") or "unknown")
task_id = _as_text(data.get("task_id"))
session_id = _as_text(data.get("session_id") or task_id)

result = {
    "task_id": task_id,
    "session_id": session_id,
    "status": status,
}

if status == "completed":
    result.update({
        "answer_text": _answer_text(data.get("answer")),
        "duration_ms": data.get("duration_ms"),
        "feedback_prompt": data.get("feedback_prompt"),
    })
elif status in {"running", "pending"}:
    stage, progress_text, progress_items, active_agents = _progress_summary(data.get("progress"))
    result.update({
        "progress_stage": stage,
        "progress_text": progress_text or ("任务排队中" if status == "pending" else "任务运行中"),
        "progress_items": progress_items,
        "active_agents": active_agents,
    })
elif status == "failed":
    result["error"] = data.get("error") or "未知错误"
elif status == "cancelled":
    result["error"] = "任务已取消"
else:
    result["error"] = data.get("error") or f"未知状态: {status}"

print(json.dumps(result, ensure_ascii=False))
PY
