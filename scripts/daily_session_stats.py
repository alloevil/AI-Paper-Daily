#!/usr/bin/env python3
"""
daily_session_stats.py — 精确的每日会话统计
解析 OpenClaw session jsonl 文件，按日期统计各项指标。

用法：
  python3 scripts/daily_session_stats.py              # 统计昨天（北京时间）
  python3 scripts/daily_session_stats.py 2026-04-18    # 统计指定日期
  python3 scripts/daily_session_stats.py today          # 统计今天

输出格式与 cron 报告一致，可直接用于消息推送。
"""

import json
import sys
import os
import glob
import re
from collections import Counter
from datetime import datetime, date, timezone, timedelta

SESSION_DIR = os.path.expanduser("~/.openclaw/agents/main/sessions")
CST = timezone(timedelta(hours=8))


def _mtime_filter(filepath: str, target: str) -> bool:
    """快速检查文件修改时间，跳过不可能包含目标日期数据的文件。
    文件最后修改时间早于目标日期开始的，直接跳过。
    """
    try:
        # target 格式 YYYY-MM-DD, 计算其开始时间的 unix timestamp
        target_dt = datetime.strptime(target, "%Y-%m-%d").replace(tzinfo=CST)
        target_start_ts = target_dt.timestamp()
        # 文件修改时间晚于目标日期开始才有意义
        # 加 1 天 buffer 处理时区边界
        mtime = os.path.getmtime(filepath)
        return mtime >= target_start_ts - 86400  # -1 day buffer
    except (OSError, ValueError):
        return True  # 保守处理，不排除


def get_target_date() -> str:
    """获取目标日期（默认昨天北京时间）"""
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        # 支持 --date YYYY-MM-DD 格式
        if arg == "--date" and len(sys.argv) > 2:
            arg = sys.argv[2]
        if arg == "today":
            return datetime.now(CST).strftime("%Y-%m-%d")
        return arg
    # 默认昨天
    yesterday = datetime.now(CST) - timedelta(days=1)
    return yesterday.strftime("%Y-%m-%d")


def is_target_date(ts: str, target: str) -> bool:
    """检查时间戳是否属于目标日期（北京时间）"""
    if not ts:
        return False
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(CST)
        return dt.strftime("%Y-%m-%d") == target
    except (ValueError, TypeError):
        return False


def get_content_text(msg: dict) -> str:
    """提取消息文本内容"""
    content = msg.get("content", "")
    if isinstance(content, list):
        return " ".join(
            c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text"
        )
    elif isinstance(content, str):
        return content
    return ""


def classify_user_message(text: str) -> str:
    """分类 role=user 的消息，返回类别名"""
    text_lower = text.lower()

    # Heartbeat events
    if "[heartbeat" in text_lower or "heartbeat.md" in text_lower[:300]:
        return "heartbeat"

    # Memory dreaming
    if "write a dream diary entry" in text_lower[:200]:
        return "memory_dream"

    # Async command completions
    if "async command" in text_lower[:100] or "completed earlier" in text_lower[:100]:
        return "async_completion"

    # Cron-triggered non-heartbeat events
    if "[cron:" in text_lower[:50] and "heartbeat" not in text_lower[:100]:
        return "cron_other"

    # Subagent context
    if "[subagent context]" in text_lower[:80]:
        return "subagent_context"

    # Actual user messages from Feishu (check FIRST, before exec/heartbeat/etc)
    # feishu[ might appear at any position when exec output is prepended
    feishu_match = re.search(r'feishu\[', text, re.IGNORECASE)
    if feishu_match:
        # Check if dm/group appears near the feishu prefix
        feishu_pos = feishu_match.start()
        context_after = text_lower[feishu_pos:feishu_pos + 30]
        if "dm" in context_after or "group" in context_after:
            return "user_message"
    if "msg:om_" in text[:400]:
        # Catch messages with om_x IDs (might not have feishu prefix)
        return "user_message"
    # JSON format: "message_id": "om_x..." inside conversation metadata blocks
    if re.search(r'"message_id"\s*:\s*"om_x', text[:1500]):
        return "user_message"
    # Fallback: feishu DM context with chat_id/sender_id (without feishu[ prefix)
    if 'chat_id' in text[:500] and 'sender_id' in text[:500] and re.search(r'om_x[a-f0-9]+', text[:800]):
        return "user_message"

    # Exec completion/failure notifications
    if "system (untrusted):" in text_lower[:30] and ("exec completed" in text_lower or "exec failed" in text_lower):
        return "exec_completion"

    # OpenClaw internal context
    if "<<<begin_openclaw_internal_context>>>" in text_lower[:100]:
        return "internal_context"

    # Pre-compaction memory flush
    if "pre-compaction memory flush" in text_lower[:80]:
        return "compaction_flush"

    # Card conversion tasks (internal tool formatting)
    if "\u8bf7\u5c06\u4e0b\u9762\u8fd9\u6bb5\u539f\u59cb\u56de\u590d\u6587\u672c\u8f6c\u6362\u4e3a\u98de\u4e66\u6d88\u606f\u5361\u7247" in text[:100]:
        return "card_conversion"

    return "other"


def analyze(target_date: str) -> dict:
    """分析所有 session 文件，返回目标日期的统计"""
    stats = {
        "date": target_date,
        "user_messages": 0,       # 去重后的真实用户消息数
        "total_user_role": 0,     # 所有 role=user 条目
        "active_sessions": set(), # 有真实用户消息的会话
        "all_active_sessions": set(), # 有任意活动的会话
        "seen_msg_ids": set(),   # 已见的消息 ID（去重用）
        "tool_calls": 0,
        "subagent_spawns": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read_tokens": 0,
        "categories": Counter(),  # 消息分类明细
    }

    # Scan all session files: current, reset (compacted), and deleted
    jsonl_files = (
        glob.glob(os.path.join(SESSION_DIR, "*.jsonl"))
        + glob.glob(os.path.join(SESSION_DIR, "*.jsonl.reset.*"))
        + glob.glob(os.path.join(SESSION_DIR, "*.jsonl.deleted.*"))
    )
    if not jsonl_files:
        return {"error": f"No session files found in {SESSION_DIR}"}

    for filepath in jsonl_files:
        # 快速跳过不可能包含目标日期数据的文件
        if not _mtime_filter(filepath, target_date):
            continue

        session_id = os.path.basename(filepath).replace(".jsonl", "")

        try:
            f = open(filepath, "r", encoding="utf-8", errors="replace")
        except PermissionError:
            continue
        with f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue

                ts = entry.get("timestamp", "")
                if not is_target_date(ts, target_date):
                    continue

                msg = entry.get("message", {})
                role = msg.get("role", "")
                entry_type = entry.get("type", "")

                # Track all active sessions
                stats["all_active_sessions"].add(session_id)

                # --- Dedup key: use entry ID to avoid counting compacted duplicates ---
                entry_id = entry.get("id", "")
                entry_dedup_key = f"{session_id}:{entry_id}" if entry_id else f"{session_id}:{ts}"

                # Count role=user messages with classification
                if role == "user":
                    stats["total_user_role"] += 1
                    text = get_content_text(msg)
                    category = classify_user_message(text)
                    stats["categories"][category] += 1

                    if category == "user_message":
                        # Deduplicate by feishu message ID (om_x...), not by entry
                        # Use findall to catch ALL msg IDs in the text (compaction merges entries)
                        # Support both "msg:om_x..." and JSON "message_id": "om_x..." formats
                        msg_ids = re.findall(r'msg:(om_x[a-f0-9]+)', text)
                        if not msg_ids:
                            msg_ids = re.findall(r'"message_id"\s*:\s*"(om_x[a-f0-9]+)"', text)
                        is_new = False
                        if msg_ids:
                            new_count = sum(1 for mid in msg_ids if mid not in stats["seen_msg_ids"])
                            for mid in msg_ids:
                                stats["seen_msg_ids"].add(mid)
                            stats["user_messages"] += new_count
                            if new_count > 0:
                                stats["active_sessions"].add(session_id)
                                is_new = True
                        else:
                            # No msg ID found, count once per dedup key
                            if entry_dedup_key not in stats["seen_msg_ids"]:
                                stats["seen_msg_ids"].add(entry_dedup_key)
                                stats["user_messages"] += 1
                                stats["active_sessions"].add(session_id)
                                is_new = True
                        # Only sync new (non-duplicate) messages to interaction_log
                        if is_new:
                            if "_interaction_entries" not in stats:
                                stats["_interaction_entries"] = []
                            dt = datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(CST)
                            source = "dm"
                            chat_id = ""
                            sender = "瑞林"
                            chat_match = re.search(r'chat_id["\s:]+([^"\n,}]+)', text[:500])
                            if chat_match:
                                chat_id = chat_match.group(1).strip('"')
                                if chat_id.startswith("oc_") or "group" in text[:500].lower() or "chat:oc_" in chat_id:
                                    source = "group"
                                else:
                                    source = "dm"
                            sender_match = re.search(r'"sender"\s*:\s*"([^"]+)"', text[:800])
                            if sender_match:
                                sender = sender_match.group(1)
                            summary = text[:80].replace("\n", " ").strip()
                            stats["_interaction_entries"].append({
                                "date": dt.strftime("%Y-%m-%d"),
                                "time": dt.strftime("%H:%M"),
                                "source": source,
                                "chat_id": chat_id,
                                "summary": f"{sender}: {summary}"
                            })

                # Count tool calls from assistant messages (deduplicated by entry)
                # Tool calls are in content[] array as {type: "toolCall", name: "..."}
                if role == "assistant":
                    # Deduplicate assistant entries by entry ID
                    assistant_dedup = f"a:{session_id}:{entry_id}" if entry_id else f"a:{session_id}:{ts}"
                    is_new_entry = assistant_dedup not in stats["seen_msg_ids"]
                    if is_new_entry:
                        stats["seen_msg_ids"].add(assistant_dedup)

                    content = msg.get("content", [])
                    if isinstance(content, list) and is_new_entry:
                        for item in content:
                            if isinstance(item, dict) and item.get("type") == "toolCall":
                                stats["tool_calls"] += 1
                                fn_name = item.get("name", "")
                                if fn_name == "sessions_spawn":
                                    stats["subagent_spawns"] += 1

                    # Count tokens from usage (deduplicated)
                    if is_new_entry:
                        usage = msg.get("usage", {})
                        if usage:
                            stats["input_tokens"] += usage.get("input", 0) or usage.get("input_tokens", 0) or 0
                            stats["output_tokens"] += usage.get("output", 0) or usage.get("output_tokens", 0) or 0
                            stats["cache_read_tokens"] += (
                                usage.get("cacheRead", 0)
                                or usage.get("cache_read_input_tokens", 0)
                                or usage.get("cache_read", 0)
                                or 0
                            )

    stats["active_sessions"] = len(stats["active_sessions"])
    stats["all_active_sessions"] = len(stats["all_active_sessions"])
    # Sync user messages to interaction_log.jsonl
    _sync_interaction_log(stats)
    return stats


def _sync_interaction_log(stats: dict):
    """将人工消息同步写入 interaction_log.jsonl（去重）"""
    log_path = os.path.expanduser("~/.openclaw/workspace/memory/interaction_log.jsonl")
    existing_lines = set()
    if os.path.exists(log_path):
        with open(log_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("{"):
                    try:
                        rec = json.loads(line)
                        # Use date+time+summary as dedup key
                        existing_lines.add((rec.get("date", ""), rec.get("time", ""), rec.get("summary", "")[:30]))
                    except json.JSONDecodeError:
                        pass

    new_entries = []
    for msg_info in stats.get("_interaction_entries", []):
        key = (msg_info["date"], msg_info["time"], msg_info["summary"][:30])
        if key not in existing_lines:
            new_entries.append(msg_info)
            existing_lines.add(key)

    if new_entries:
        with open(log_path, "a", encoding="utf-8") as f:
            for entry in new_entries:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def format_report(stats: dict) -> str:
    """格式化为 cron 报告格式"""
    if "error" in stats:
        return f"❌ {stats['error']}"

    lines = [
        f"📊 每日会话统计 | {stats['date']}",
        f"- 用户消息: {stats['user_messages']} 条",
        f"- 活跃会话: {stats['all_active_sessions']} 个",
        f"- 工具调用: {stats['tool_calls']} 次",
        f"- 子代理: {stats['subagent_spawns']} 次",
        f"- input tokens: {stats['input_tokens']:,}",
        f"- output tokens: {stats['output_tokens']:,}",
        f"- cache read: {stats['cache_read_tokens']:,}",
    ]

    # Debug: show all role=user categories if any non-user_message exists
    non_user = {k: v for k, v in stats["categories"].items() if k != "user_message"}
    if non_user:
        lines.append(f"- (role=user 明细: {dict(non_user)})")

    return "\n".join(lines)


def save_stats(stats: dict):
    """追加写入 session_stats.jsonl"""
    output_path = os.path.expanduser("~/.openclaw/workspace/memory/session_stats.jsonl")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    record = {
        "date": stats["date"],
        "user_messages": stats["user_messages"],
        "active_sessions": stats["all_active_sessions"],
        "tool_calls": stats["tool_calls"],
        "subagent_spawns": stats["subagent_spawns"],
        "input_tokens": stats["input_tokens"],
        "output_tokens": stats["output_tokens"],
        "cache_read_tokens": stats["cache_read_tokens"],
    }

    with open(output_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def main():
    target_date = get_target_date()
    stats = analyze(target_date)
    print(format_report(stats))

    # 写入记录
    if "error" not in stats:
        save_stats(stats)


if __name__ == "__main__":
    main()
