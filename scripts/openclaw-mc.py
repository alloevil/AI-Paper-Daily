#!/usr/bin/env python3
"""
openclaw-mc.py — OpenClaw Mission Control CLI
通过命令行管理 Gateway：cron、session、plugin、usage 等。
用法: python3 scripts/openclaw-mc.py <command> [args]

命令:
  status          Gateway 状态
  cron            Cron 任务列表
  cron-run <id>   手动触发 cron
  plugins         插件列表
  sessions        活跃会话
  stats [date]    会话统计
  usage           用量统计
  doctor          健康检查
  help            帮助
"""

import sys
import json
import subprocess
import os
from collections import Counter
from datetime import datetime, timezone, timedelta

WORKSPACE = os.path.expanduser("~/.openclaw/workspace")
SESSIONS_DIR = os.path.expanduser("~/.openclaw/agents/main/sessions")


def run_cmd(cmd, timeout=30):
    """运行命令并返回输出"""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout
        )
        return result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return "❌ 命令超时"
    except Exception as e:
        return f"❌ 错误: {e}"


def cmd_status():
    """Gateway 状态"""
    print(run_cmd("openclaw gateway status 2>&1"))


def cmd_cron():
    """Cron 任务列表"""
    output = run_cmd("openclaw cron list 2>&1")
    print(output)


def cmd_cron_run(job_id):
    """手动触发 cron"""
    if not job_id:
        print("用法: cron-run <job-id>")
        return
    print(run_cmd(f"openclaw cron run {job_id} 2>&1"))


def cmd_plugins():
    """插件列表"""
    print(run_cmd("openclaw plugins list 2>&1"))


def cmd_sessions():
    """活跃会话"""
    cutoff = datetime.now(timezone(timedelta(hours=8))) - timedelta(hours=24)
    sessions = []

    for fname in sorted(os.listdir(SESSIONS_DIR)):
        if not fname.endswith(".jsonl") or ".deleted." in fname or ".reset." in fname:
            continue
        fpath = os.path.join(SESSIONS_DIR, fname)
        sid = fname.replace(".jsonl", "")
        user_msgs = 0
        last_activity = None

        with open(fpath, "r", errors="replace") as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                except:
                    continue
                if entry.get("type") == "message":
                    msg = entry.get("message", {})
                    if msg.get("role") == "user":
                        user_msgs += 1
                        ts_str = entry.get("timestamp", "")
                        if ts_str:
                            last_activity = ts_str[:19]
                if entry.get("type") == "session":
                    pass

        if user_msgs > 0:
            sessions.append({
                "id": sid[:12],
                "msgs": user_msgs,
                "last": last_activity or "unknown"
            })

    print(f"📊 活跃会话（最近 24h）\n{'='*40}")
    if not sessions:
        print("  无活跃会话")
    for s in sessions:
        print(f"  {s['id']}...  {s['msgs']} 条消息  最后: {s['last']}")
    print(f"{'='*40}")
    print(f"  共 {len(sessions)} 个会话，{sum(s['msgs'] for s in sessions)} 条消息")


def cmd_stats(target_date=None):
    """会话统计（含 token 消耗 + 工具调用）"""
    if not target_date:
        target_date = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d")

    daily_user_msgs = 0
    daily_assistant_msgs = 0
    daily_sessions = set()
    total_input = 0
    total_output = 0
    total_cache_read = 0
    tool_calls = Counter()
    per_session = {}

    for fname in sorted(os.listdir(SESSIONS_DIR)):
        if not fname.endswith(".jsonl"):
            continue
        fpath = os.path.join(SESSIONS_DIR, fname)
        sid = fname.replace(".jsonl", "")[:12]

        s_user = 0
        s_assistant = 0
        s_input = 0
        s_output = 0
        s_cache = 0
        s_tools = Counter()

        with open(fpath, "r", errors="replace") as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                except:
                    continue
                if entry.get("type") != "message":
                    continue

                ts_str = entry.get("timestamp", "")
                try:
                    ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                    if ts.strftime("%Y-%m-%d") != target_date:
                        continue
                except:
                    continue

                msg = entry.get("message", {})
                role = msg.get("role", "")

                if role == "user":
                    s_user += 1
                elif role == "assistant":
                    s_assistant += 1

                    # Count tool calls
                    content = msg.get("content", [])
                    if isinstance(content, list):
                        for c in content:
                            if isinstance(c, dict) and c.get("type") == "toolCall":
                                tname = c.get("name", "unknown")
                                s_tools[tname] += 1
                                tool_calls[tname] += 1

                    # Token usage
                    usage = msg.get("usage")
                    if usage and isinstance(usage, dict):
                        s_input += usage.get("input", 0)
                        s_output += usage.get("output", 0)
                        s_cache += usage.get("cacheRead", 0)

        if s_user > 0 or s_assistant > 0:
            daily_user_msgs += s_user
            daily_assistant_msgs += s_assistant
            daily_sessions.add(sid)
            total_input += s_input
            total_output += s_output
            total_cache_read += s_cache
            per_session[sid] = {
                "user": s_user,
                "assistant": s_assistant,
                "input": s_input,
                "output": s_output,
                "cache": s_cache,
                "tools": s_tools,
            }

    total_billed_input = total_input + total_cache_read
    cache_ratio = (total_cache_read / total_billed_input * 100) if total_billed_input > 0 else 0
    avg_output = total_output // daily_assistant_msgs if daily_assistant_msgs > 0 else 0

    print(f"📊 会话统计 — {target_date}")
    print("=" * 55)
    print(f"  💬 用户消息: {daily_user_msgs} 条")
    print(f"  🤖 助手回复: {daily_assistant_msgs} 条")
    print(f"  🔄 交互轮数: {daily_user_msgs + daily_assistant_msgs} 轮")
    print(f"  📁 活跃会话: {len(daily_sessions)} 个")
    print(f"  🪙 Token 消耗:")
    print(f"     Output (生成):    {total_output:>12,}  (均 {avg_output:,}/轮)")
    print(f"     Input (含context): {total_input:>12,}")
    print(f"     Cache Read:       {total_cache_read:>12,}")
    print(f"     缓存命中率:       {cache_ratio:>11.1f}%")

    if tool_calls:
        print(f"\n  🔧 工具调用 TOP 10 (共 {sum(tool_calls.values())} 次):")
        for tool, count in tool_calls.most_common(10):
            print(f"     {count:>4}  {tool}")

    if per_session:
        print(f"\n  按会话明细:")
        for sid, s in sorted(per_session.items(), key=lambda x: -x[1]["output"]):
            top_tool = s["tools"].most_common(1)
            tool_str = f"  top: {top_tool[0][0]}({top_tool[0][1]})" if top_tool else ""
            print(f"    {sid}...  {s['user']}u/{s['assistant']}a  out={s['output']:>8,}{tool_str}")


def cmd_usage():
    """用量统计"""
    print(run_cmd("session_status 2>&1"))


def cmd_doctor():
    """健康检查"""
    print(run_cmd("openclaw doctor 2>&1"))


def cmd_help():
    """帮助"""
    print(__doc__)


COMMANDS = {
    "status": cmd_status,
    "cron": cmd_cron,
    "cron-run": cmd_cron_run,
    "plugins": cmd_plugins,
    "sessions": cmd_sessions,
    "stats": cmd_stats,
    "usage": cmd_usage,
    "doctor": cmd_doctor,
    "help": cmd_help,
}


def main():
    if len(sys.argv) < 2:
        cmd_help()
        return

    cmd = sys.argv[1].lower()
    args = sys.argv[2:]

    if cmd in COMMANDS:
        if args:
            COMMANDS[cmd](*args)
        else:
            COMMANDS[cmd]()
    else:
        print(f"❌ 未知命令: {cmd}")
        cmd_help()


if __name__ == "__main__":
    main()
