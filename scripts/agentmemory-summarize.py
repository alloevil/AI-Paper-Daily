#!/usr/bin/env python3
"""Batch summarize agentmemory sessions with progress tracking."""
import json, urllib.request, os, sys, time

BASE = "http://localhost:3111/agentmemory"
PROGRESS_FILE = "/tmp/am-summarize-progress.json"

def post(path, data):
    req = urllib.request.Request(f"{BASE}{path}",
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"},
        method="POST")
    try:
        return json.loads(urllib.request.urlopen(req, timeout=120).read())
    except Exception as e:
        return {"error": str(e)}

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        return json.loads(open(PROGRESS_FILE).read())
    return {"done": [], "failed": []}

def save_progress(progress):
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f)

# Get sessions
sessions = json.loads(urllib.request.urlopen(f"{BASE}/sessions", timeout=10).read()).get("sessions", [])
todo = [s for s in sessions if s.get("observationCount", 0) > 0]
progress = load_progress()
done_set = set(progress["done"])

remaining = [s for s in todo if s["id"] not in done_set]
print(f"Total: {len(todo)}, Already done: {len(done_set)}, Remaining: {len(remaining)}")

BATCH = 8
batch = remaining[:BATCH]
ok = 0
for s in batch:
    sid = s["id"]
    result = post("/summarize", {"sessionId": sid})
    if result.get("success"):
        progress["done"].append(sid)
        ok += 1
    else:
        progress["failed"].append(sid)
    save_progress(progress)

print(f"Batch: {ok}/{len(batch)} ok")
print(f"Total done: {len(progress['done'])}/{len(todo)}")
