#!/bin/bash
# ???? subagent session
# ??: bash subagent-list.sh [--limit N] [--active-minutes N] [--json] [--no-interrupted]

python3 - "$@" << 'PYEOF'
import json, os, re, time, argparse

SESSIONS_JSON = "/root/.openclaw/agents/main/sessions/sessions.json"
ONE_DAY_MS = 86400 * 1000
TASK_PATTERN = re.compile(r"\[Subagent Task\]:\s*(.+?)(?:\n|$)")
AGENTS_DIR = "/root/.openclaw/agents"
ABORT_FILE = os.path.join(AGENTS_DIR, "main", "sessions", "abort.json")

def load_abort_set():
    try:
        with open(ABORT_FILE, "r") as f:
            data = json.load(f)
            return set(data) if isinstance(data, list) else set()
    except (FileNotFoundError, json.JSONDecodeError):
        return set()

def is_aborted(session_key):
    return session_key in load_abort_set()

def extract_task_from_jsonl(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if obj.get("type") != "message":
                    continue
                msg = obj.get("message", {})
                if msg.get("role") != "user":
                    continue
                for c in msg.get("content", []):
                    if c.get("type") == "text":
                        m = TASK_PATTERN.search(c.get("text", ""))
                        if m:
                            return m.group(1).strip()
    except (OSError, IOError):
        pass
    return None

def parse_subagents(limit=None, active_minutes=None, include_interrupted=True):
    started = time.perf_counter()
    with open(SESSIONS_JSON, "r", encoding="utf-8") as f:
        all_sessions = json.load(f)
    now_ms = time.time() * 1000
    cutoff_ms = now_ms - ONE_DAY_MS
    subagents = []
    for key, session in all_sessions.items():
        if "subagent" not in key:
            continue
        if session.get("status") is None:
            continue
        interrupted = False
        updated_at = session.get("updatedAt")
        ended_at = session.get("endedAt")
        aborted = session.get("abortedLastRun", False)
        if ended_at is None and aborted is False and updated_at is not None and updated_at < cutoff_ms:
            interrupted = True
        if session.get("status") == "running" and ended_at is not None and ended_at < cutoff_ms:
            interrupted = True
        if active_minutes and updated_at:
            if updated_at < now_ms - active_minutes * 60 * 1000:
                continue
        task_text = None
        session_file = session.get("sessionFile")
        if session_file and os.path.exists(session_file):
            task_text = extract_task_from_jsonl(session_file)
            if task_text:
                task_text = task_text[:30]
        status = session.get("status", "unknown")
        if interrupted:
            status = "interrupted"
        if is_aborted(key):
            status = "killed"
        if not include_interrupted and status == "interrupted":
            continue
        subagents.append({
            "sessionKey": key, "sessionId": session.get("sessionId"),
            "status": status, "label": session.get("label", ""),
            "model": session.get("model"), "startedAt": session.get("startedAt"),
            "endedAt": session.get("endedAt"), "updatedAt": session.get("updatedAt"),
            "runtimeMs": session.get("runtimeMs"), "spawnedBy": session.get("spawnedBy"),
            "parentSessionKey": session.get("spawnedBy"), "user": task_text,
        })
    subagents.sort(key=lambda x: (0 if x.get("status") == "running" else 1, -(x.get("startedAt") or 0)))
    if limit:
        subagents = subagents[:limit]
    cost_ms = int((time.perf_counter() - started) * 1000)
    return {"subagents": subagents, "total": len(subagents), "timeCost": cost_ms}

def main():
    parser = argparse.ArgumentParser(description="?? subagent session ??")
    parser.add_argument("--limit", type=int, help="??????")
    parser.add_argument("--active-minutes", type=int, help="???? N ?????")
    parser.add_argument("--json", action="store_true", help="JSON ????")
    parser.add_argument("--no-interrupted", action="store_true", help="?? interrupted ?")
    args = parser.parse_args()
    result = parse_subagents(limit=args.limit, active_minutes=args.active_minutes, include_interrupted=not args.no_interrupted)
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print(f"? {result['total']} ? subagent??? {result['timeCost']}ms\n")
        for sa in result["subagents"]:
            icon = {"running": "*", "done": "?", "interrupted": "*"}.get(sa["status"], "?")
            rt = f"{sa['runtimeMs'] / 1000:.1f}s" if sa.get("runtimeMs") else "N/A"
            print(f"  {icon} [{sa['status']}] {sa['sessionId'][:8]}... label={sa['label'] or 'N/A'} task={sa['user'] or 'N/A'} runtime={rt}")

if __name__ == "__main__":
    main()
PYEOF
