"""Telegram Bot push for GitHub Discovery."""

import os
import json
import urllib.request
import urllib.error


def send_telegram(token: str, chat_id: str, message: str) -> bool:
    """Send a message via Telegram Bot API.

    Args:
        token: Telegram Bot token
        chat_id: Target chat ID
        message: Message text (supports Markdown)

    Returns:
        True if sent successfully, False otherwise
    """
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps({
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown",
        "disable_web_page_preview": True,
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            if result.get("ok"):
                print("[Telegram] Message sent successfully")
                return True
            else:
                print(f"[Telegram] API error: {result}")
                return False
    except Exception as e:
        print(f"[Telegram] Failed to send: {e}")
        return False


def format_top5_message(top_repos: list[tuple[dict, dict]]) -> str:
    """Format top 5 repos as a Telegram message."""
    lines = ["🔥 *GitHub Discovery — Today's Top Picks*\n"]
    for i, (repo, scores) in enumerate(top_repos[:5], 1):
        name = repo["full_name"]
        url = repo["url"]
        stars = repo.get("stars", 0)
        score = scores["total"]
        lang = repo.get("language", "N/A")
        lines.append(f"{i}. [{name}]({url})")
        lines.append(f"   ⭐ {stars:,} | 📊 {score}/100 | 🔤 {lang}")
        lines.append("")
    lines.append("_Powered by GitHub Discovery_")
    return "\n".join(lines)


def push_if_configured(top_repos: list[tuple[dict, dict]]) -> bool:
    """Push top repos to Telegram if environment variables are set.

    Returns True if pushed, False if skipped.
    """
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")

    if not token or not chat_id:
        print("[Telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set, skipping")
        return False

    message = format_top5_message(top_repos)
    return send_telegram(token, chat_id, message)
