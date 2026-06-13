#!/usr/bin/env python3
"""
session_stats.py — OpenClaw 会话统计工具
解析日志文件，统计每日对话轮数、工具调用、子代理使用等。

用法：
  python3 scripts/session_stats.py              # 统计今天
  python3 scripts/session_stats.py 2026-03-22   # 统计指定日期
  python3 scripts/session_stats.py --all         # 统计所有可用日志
"""

import json
import sys
import os
import re
from collections import Counter, defaultdict
from datetime import datetime, date


LOG_DIR = "/tmp/openclaw"


def get_log_path(target_date: str) -> str:
    """获取指定日期的日志文件路径"""
    return os.path.join(LOG_DIR, f"openclaw-{target_date}.log")


def parse_log_line(line: str) -> dict | None:
    """解析一行日志（支持 JSON 和纯文本两种格式）"""
    line = line.strip()
    if not line:
        return None
    # Try JSON format (v2026.3.9 and earlier)
    if line.startswith('{'):
        try:
            return json.loads(line)
        except (json.JSONDecodeError, ValueError):
            return None
    # Plain text format (v2026.3.22+) - wrap in dict
    return {"_text": line, "time": line[:35] if len(line) > 35 else ""}


def analyze_log(log_path: str, target_date: str) -> dict:
    """分析日志文件，返回统计数据"""
    if not os.path.exists(log_path):
        return {"error": f"日志文件不存在: {log_path}"}

    stats = {
        "date": target_date,
        "total_lines": 0,
        "tool_calls": Counter(),
        "tool_success": 0,
        "tool_fail": 0,
        "subagent_spawns": [],
        "sessions": set(),
        "errors": 0,
        "hourly_distribution": Counter(),
        "inbound_messages": 0,
        "outbound_messages": 0,
        "feishu_tools": Counter(),
    }

    # 对话轮数（按唯一 msg ID 去重）
    unique_msg_ids = set()
    with open(log_path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            entry = parse_log_line(line)
            if not entry:
                continue
            # JSON format: check "0" and "1" fields
            msg = entry.get("1", "") or entry.get("0", "") or entry.get("_text", "")
            if not isinstance(msg, str):
                continue
            # Match msg IDs: [msg:om_x...], msg:om_x..., messageId=om_x..., standalone om_x...
            for match in re.finditer(r'(?:msg:|messageId=|message_id:)(om_x[a-f0-9]+)', msg):
                unique_msg_ids.add(match.group(1))
    stats["conversation_turns"] = len(unique_msg_ids)

    with open(log_path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            stats["total_lines"] += 1
            entry = parse_log_line(line)
            if not entry:
                continue

            # 提取时间
            time_str = entry.get("time", "")
            if time_str:
                try:
                    dt = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
                    stats["hourly_distribution"][dt.hour] += 1
                except (ValueError, TypeError):
                    pass

            # 提取消息体 (JSON: "0"/"1" fields; Plain text: "_text" field)
            msg = entry.get("1", "") or entry.get("0", "") or entry.get("_text", "")
            if not isinstance(msg, str):
                continue

            # 工具调用统计
            if "tool call:" in msg:
                tool_name = msg.split("tool call: ")[1].split(" ")[0].strip()
                stats["tool_calls"][tool_name] += 1

            # 工具完成统计
            if "tool done:" in msg:
                if "ok (" in msg:
                    stats["tool_success"] += 1
                else:
                    stats["tool_fail"] += 1

            # 子代理统计
            if "tool call: sessions_spawn" in msg:
                label_match = msg.find('"label":"')
                if label_match > -1:
                    label_start = label_match + 9
                    label_end = msg.find('"', label_start)
                    label = msg[label_start:label_end] if label_end > label_start else "unknown"
                    stats["subagent_spawns"].append(label)

            # 会话标识
            if "sessionKey" in msg or "session_key" in msg:
                stats["sessions"].add(msg[:80])

            # 错误统计
            log_level = entry.get("_meta", {}).get("logLevelName", "")
            if log_level == "ERROR":
                stats["errors"] += 1

            # 入站/出站消息
            if "handleFeishuMessage" in msg or "inbound" in msg.lower():
                stats["inbound_messages"] += 1
            if "tool call: message" in msg or "tool call: feishu_im" in msg:
                stats["outbound_messages"] += 1

    return stats


def format_report(stats: dict) -> str:
    """格式化统计报告"""
    if "error" in stats:
        return f"❌ {stats['error']}"

    lines = []
    lines.append(f"📊 OpenClaw 会话统计 — {stats['date']}")
    lines.append("=" * 45)

    # 基本数据
    lines.append(f"\n📝 日志行数: {stats['total_lines']:,}")
    lines.append(f"💬 对话轮数: {stats.get('conversation_turns', '?')} 轮（不同用户消息数）")
    lines.append(f"❌ 错误数: {stats['errors']}")

    # 工具调用 TOP 10
    lines.append(f"\n🔧 工具调用 TOP 10 (共 {sum(stats['tool_calls'].values())} 次):")
    for tool, count in stats["tool_calls"].most_common(10):
        lines.append(f"   {count:>4}  {tool}")
    lines.append(f"   ✅ 成功: {stats['tool_success']}  ❌ 失败: {stats['tool_fail']}")

    # 子代理
    if stats["subagent_spawns"]:
        lines.append(f"\n🤖 子代理调用 ({len(stats['subagent_spawns'])} 次):")
        subagent_counts = Counter(stats["subagent_spawns"])
        for label, count in subagent_counts.most_common():
            lines.append(f"   {count:>2}x  {label}")

    # 每小时分布
    if stats["hourly_distribution"]:
        lines.append(f"\n⏰ 活跃时段分布:")
        max_count = max(stats["hourly_distribution"].values()) if stats["hourly_distribution"] else 1
        for hour in range(24):
            count = stats["hourly_distribution"].get(hour, 0)
            bar = "█" * int(count / max_count * 20) if max_count > 0 else ""
            lines.append(f"   {hour:02d}:00  {bar} {count}")

    lines.append("\n" + "=" * 45)
    return "\n".join(lines)


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--all":
        # 统计所有日志文件
        dates = []
        for f in sorted(os.listdir(LOG_DIR)):
            if f.startswith("openclaw-") and f.endswith(".log"):
                d = f.replace("openclaw-", "").replace(".log", "")
                dates.append(d)
        for d in dates:
            log_path = get_log_path(d)
            stats = analyze_log(log_path, d)
            print(format_report(stats))
            print()
    else:
        target_date = sys.argv[1] if len(sys.argv) > 1 else date.today().isoformat()
        log_path = get_log_path(target_date)
        stats = analyze_log(log_path, target_date)
        print(format_report(stats))


if __name__ == "__main__":
    main()
