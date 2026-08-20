"""推送到飞书和邮件"""

import json
import os
import smtplib
import urllib.request
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta
from typing import List, Dict


def send_feishu(papers: List[Dict], webhook: str = "", title: str = "") -> bool:
    """通过飞书 Webhook 推送论文；title 为空时使用日报默认标题"""
    webhook = webhook or os.environ.get("FEISHU_WEBHOOK", "")
    if not webhook:
        print("[Feishu] No webhook configured, skipping")
        return False

    today = datetime.now(timezone(timedelta(hours=8))).strftime("%Y.%m.%d")
    weekday = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][
        datetime.now(timezone(timedelta(hours=8))).weekday()
    ]

    body_title = title or f"论文日报 | {today}（{weekday}）"
    card_title = title or f"论文日报 | {today}"

    # 构建消息内容
    lines = [f"📄 **{body_title}**\n"]

    for i, p in enumerate(papers, 1):
        # 标题行
        source_emoji = {"arxiv": "📑", "huggingface": "🤗", "paperswithcode": "💻"}.get(
            p.get("source", ""), "📄"
        )
        code_tag = " 📦代码" if p.get("has_code") else ""
        votes_tag = f" 👍{p['votes']}" if p.get("votes", 0) > 0 else ""

        lines.append(f"**{i}. {p['title']}**{code_tag}{votes_tag}")
        lines.append(f"   {p.get('reason', '')}")

        # 链接
        links = []
        if p.get("url"):
            links.append(f"[论文]({p['url']})")
        if p.get("pdf_url"):
            links.append(f"[PDF]({p['pdf_url']})")
        if p.get("code_url"):
            links.append(f"[代码]({p['code_url']})")
        lines.append(f"   {' | '.join(links)}")
        lines.append("")

    lines.append(f"_共 {len(papers)} 篇 | 由 AI Paper Daily 自动推送_")

    content = "\n".join(lines)

    # 飞书 Webhook 格式
    payload = json.dumps({
        "msg_type": "interactive",
        "card": {
            "header": {
                "title": {
                    "tag": "plain_text",
                    "content": f"📄 {card_title}"
                },
                "template": "blue"
            },
            "elements": [
                {
                    "tag": "markdown",
                    "content": content
                }
            ]
        }
    }).encode()

    try:
        req = urllib.request.Request(webhook, data=payload, headers={
            "Content-Type": "application/json",
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode())
            if result.get("code") == 0 or result.get("StatusCode") == 0:
                print(f"[Feishu] Sent {len(papers)} papers")
                return True
            else:
                print(f"[Feishu] Error: {result}")
                return False
    except Exception as e:
        print(f"[Feishu] Error: {e}")
        return False


def send_feishu_alert(text: str, webhook: str = "") -> bool:
    """通过飞书 Webhook 推送纯文本告警（供流水线失败告警使用）；无 webhook 时静默跳过"""
    webhook = webhook or os.environ.get("FEISHU_WEBHOOK", "")
    if not webhook:
        print("[Feishu] No webhook configured, skipping alert")
        return False

    payload = json.dumps({
        "msg_type": "text",
        "content": {"text": text},
    }).encode()

    try:
        req = urllib.request.Request(webhook, data=payload, headers={
            "Content-Type": "application/json",
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode())
            if result.get("code") == 0 or result.get("StatusCode") == 0:
                print("[Feishu] Alert sent")
                return True
            print(f"[Feishu] Alert error: {result}")
            return False
    except Exception as e:
        print(f"[Feishu] Alert error: {e}")
        return False


def send_email(papers: List[Dict], subscribers: List[str] = None, title: str = "") -> bool:
    """通过邮件推送论文；title 为空时使用日报默认标题"""
    host = os.environ.get("SMTP_HOST", "")
    user = os.environ.get("SMTP_USER", "")
    passwd = os.environ.get("SMTP_PASS", "")
    port = int(os.environ.get("SMTP_PORT", "465"))

    if not all([host, user, passwd]):
        print("[Email] SMTP not configured, skipping")
        return False

    subscribers = subscribers or []
    if not subscribers:
        print("[Email] No subscribers, skipping")
        return False

    today = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d")
    weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
        datetime.now(timezone(timedelta(hours=8))).weekday()
    ]

    header_title = title or "AI Paper Daily"
    section_label = "本周精选论文：" if title else "今日精选论文："

    # 构建 HTML 邮件（含暗模式适配）
    html_parts = [
        "<!DOCTYPE html>",
        "<html>",
        "<head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head>",
        "<body style=\"margin:0;padding:0;background:#f5f5f5;\">",
        "<div class=\"wrapper\" style=\"font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;padding:24px;background:#ffffff;\">",
        # Header
        "<div class=\"header\" style=\"background:#1a73e8;color:#ffffff;padding:20px 24px;border-radius:8px 8px 0 0;\">",
        f"<h2 style=\"margin:0;font-size:20px;color:#ffffff;\">📄 {header_title}</h2>",
        f"<p style=\"margin:4px 0 0;font-size:14px;color:rgba(255,255,255,0.85);\">{today}（{weekday}）</p>",
        "</div>",
        # Body
        "<div class=\"content\" style=\"padding:20px 24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;\">",
        f"<p class=\"section-title\" style=\"margin:0 0 16px;font-size:15px;font-weight:bold;color:#1a1a1a;\">{section_label}</p>",
    ]

    for i, p in enumerate(papers, 1):
        code_html = ' <span style=\"background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;\">📦 Code</span>' if p.get("has_code") else ""

        html_parts.append("<div class=\"card\" style=\"margin:0 0 12px;padding:14px 16px;background:#fafafa;border:1px solid #e8e8e8;border-radius:8px;\">")
        html_parts.append(f"<h3 class=\"card-title\" style=\"margin:0 0 6px;font-size:15px;line-height:1.4;color:#1a1a1a;\">{i}. {p['title']}{code_html}</h3>")
        html_parts.append(f"<p class=\"card-reason\" style=\"margin:0 0 8px;font-size:13px;color:#666666;line-height:1.5;\">{p.get('reason', '')}</p>")

        links = []
        if p.get("url"):
            links.append(f'<a href=\"{p["url"]}\" style=\"color:#1a73e8;text-decoration:none;font-size:13px;\">📄 论文</a>')
        if p.get("pdf_url"):
            links.append(f'<a href=\"{p["pdf_url"]}\" style=\"color:#1a73e8;text-decoration:none;font-size:13px;\">📥 PDF</a>')
        if p.get("code_url"):
            links.append(f'<a href=\"{p["code_url"]}\" style=\"color:#1a73e8;text-decoration:none;font-size:13px;\">💻 代码</a>')
        html_parts.append(f"<p style=\"margin:0;\">{' | '.join(links)}</p>")
        html_parts.append("</div>")

    # Footer
    html_parts.append("<div class=\"footer\" style=\"margin-top:20px;padding-top:16px;border-top:1px solid #e0e0e0;\">")
    html_parts.append(f"<p class=\"footer-text\" style=\"color:#999999;font-size:12px;margin:0;\">共 {len(papers)} 篇 | AI Paper Daily 自动推送</p>")
    html_parts.append("</div>")

    # Dark mode styles
    html_parts.append(
        "<style>"
        "@media (prefers-color-scheme: dark) {"
        ".wrapper { background:#1a1a1a !important; }"
        ".header { background:#1565c0 !important; }"
        ".content { background:#1a1a1a !important; border-color:#333333 !important; }"
        ".section-title { color:#e0e0e0 !important; }"
        ".card { background:#222222 !important; border-color:#333333 !important; }"
        ".card-title { color:#e0e0e0 !important; }"
        ".card-reason { color:#aaaaaa !important; }"
        ".footer { border-color:#333333 !important; }"
        ".footer-text { color:#888888 !important; }"
        ".link { color:#64b5f6 !important; }"
        "}"
        "</style>"
    )

    html_parts.append("</div>")
    html_parts.append("</body></html>")

    html_content = "\n".join(html_parts)

    # 发送邮件（单次发送，收件人用 BCC 保护隐私）
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"📄 {header_title} - {today}"
    msg["From"] = user
    msg["To"] = user
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        with smtplib.SMTP_SSL(host, port) as server:
            server.login(user, passwd)
            server.sendmail(user, subscribers, msg.as_string())
        print(f"[Email] Sent to {len(subscribers)} subscribers")
        return True
    except Exception as e:
        print(f"[Email] Error: {e}")
        return False
