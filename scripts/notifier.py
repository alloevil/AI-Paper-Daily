"""推送到飞书和邮件"""

import json
import os
import smtplib
import urllib.request
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta
from typing import List, Dict


def send_feishu(papers: List[Dict], webhook: str = "") -> bool:
    """通过飞书 Webhook 推送论文"""
    webhook = webhook or os.environ.get("FEISHU_WEBHOOK", "")
    if not webhook:
        print("[Feishu] No webhook configured, skipping")
        return False

    today = datetime.now(timezone(timedelta(hours=8))).strftime("%Y.%m.%d")
    weekday = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][
        datetime.now(timezone(timedelta(hours=8))).weekday()
    ]

    # 构建消息内容
    lines = [f"📄 **论文日报** | {today}（{weekday}）\n"]

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

    lines.append(f"_共 {len(papers)} 篇 | 由 Paper Discovery 自动推送_")

    content = "\n".join(lines)

    # 飞书 Webhook 格式
    payload = json.dumps({
        "msg_type": "interactive",
        "card": {
            "header": {
                "title": {
                    "tag": "plain_text",
                    "content": f"📄 论文日报 | {today}"
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


def send_email(papers: List[Dict], subscribers: List[str] = None) -> bool:
    """通过邮件推送论文"""
    host = os.environ.get("SMTP_HOST", "")
    user = os.environ.get("SMTP_USER", "")
    passwd = os.environ.get("SMTP_PASS", "")

    if not all([host, user, passwd]):
        print("[Email] SMTP not configured, skipping")
        return False

    subscribers = subscribers or []
    if not subscribers:
        print("[Email] No subscribers, skipping")
        return False

    today = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d")

    # 构建 HTML 邮件
    html_parts = [
        "<div style='font-family:sans-serif;max-width:700px;margin:0 auto;'>",
        f"<h2 style='color:#1a73e8;'>📄 Paper Discovery - {today}</h2>",
        "<p>今日精选论文：</p>",
    ]

    for i, p in enumerate(papers, 1):
        code_html = ' <span style="background:#e8f5e9;padding:2px 6px;border-radius:3px;font-size:12px;">📦有代码</span>' if p.get("has_code") else ""

        html_parts.append(f"<div style='margin:16px 0;padding:12px;border:1px solid #eee;border-radius:8px;'>")
        html_parts.append(f"<h3 style='margin:0 0 8px;'>{i}. {p['title']}{code_html}</h3>")
        html_parts.append(f"<p style='color:#666;margin:0 0 8px;'>{p.get('reason', '')}</p>")

        links = []
        if p.get("url"):
            links.append(f'<a href="{p["url"]}">论文</a>')
        if p.get("pdf_url"):
            links.append(f'<a href="{p["pdf_url"]}">PDF</a>')
        if p.get("code_url"):
            links.append(f'<a href="{p["code_url"]}">代码</a>')
        html_parts.append(f"<p style='margin:0;'>{' | '.join(links)}</p>")
        html_parts.append("</div>")

    html_parts.append("<hr style='border:none;border-top:1px solid #eee;'>")
    html_parts.append(f"<p style='color:#999;font-size:12px;'>共 {len(papers)} 篇 | Paper Discovery 自动推送</p>")
    html_parts.append("</div>")

    html_content = "\n".join(html_parts)

    # 发送邮件
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"📄 Paper Discovery - {today}"
    msg["From"] = user
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        with smtplib.SMTP_SSL(host, 465) as server:
            server.login(user, passwd)
            for subscriber in subscribers:
                msg["To"] = subscriber
                server.sendmail(user, subscriber, msg.as_string())
                del msg["To"]
        print(f"[Email] Sent to {len(subscribers)} subscribers")
        return True
    except Exception as e:
        print(f"[Email] Error: {e}")
        return False
