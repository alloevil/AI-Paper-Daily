"""数据存储 - SQLite + JSON"""

import json
import sqlite3
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional


DATA_DIR = Path(__file__).parent.parent / "data"
DB_PATH = DATA_DIR / "papers.db"


def init_db():
    """初始化数据库"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS papers (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            abstract TEXT,
            authors TEXT,  -- JSON array
            url TEXT,
            pdf_url TEXT,
            published TEXT,
            source TEXT,
            categories TEXT,  -- JSON array
            has_code INTEGER DEFAULT 0,
            code_url TEXT,
            votes INTEGER DEFAULT 0,
            stars INTEGER DEFAULT 0,
            reason TEXT,
            pushed INTEGER DEFAULT 0,
            created_at TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS push_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            paper_count INTEGER,
            channel TEXT,
            status TEXT,
            created_at TEXT
        )
    """)
    conn.commit()
    return conn


def save_papers(papers: List[Dict]) -> int:
    """保存论文到数据库，返回新增数量"""
    conn = init_db()
    new_count = 0

    for p in papers:
        try:
            conn.execute("""
                INSERT OR IGNORE INTO papers
                (id, title, abstract, authors, url, pdf_url, published,
                 source, categories, has_code, code_url, votes, stars,
                 reason, pushed, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
            """, (
                p["id"],
                p["title"],
                p.get("abstract", ""),
                json.dumps(p.get("authors", []), ensure_ascii=False),
                p.get("url", ""),
                p.get("pdf_url", ""),
                p.get("published", ""),
                p.get("source", ""),
                json.dumps(p.get("categories", []), ensure_ascii=False),
                1 if p.get("has_code") else 0,
                p.get("code_url", ""),
                p.get("votes", 0),
                p.get("stars", 0),
                p.get("reason", ""),
                datetime.now(timezone.utc).isoformat(),
            ))
            if conn.total_changes:
                new_count += 1
        except sqlite3.IntegrityError:
            pass  # 已存在，跳过

    conn.commit()
    conn.close()
    return new_count


def mark_pushed(paper_ids: List[str]):
    """标记论文已推送"""
    conn = init_db()
    for pid in paper_ids:
        conn.execute("UPDATE papers SET pushed = 1 WHERE id = ?", (pid,))
    conn.commit()
    conn.close()


def log_push(date: str, paper_count: int, channel: str, status: str):
    """记录推送日志"""
    conn = init_db()
    conn.execute("""
        INSERT INTO push_log (date, paper_count, channel, status, created_at)
        VALUES (?, ?, ?, ?, ?)
    """, (date, paper_count, channel, status, datetime.now(timezone.utc).isoformat()))
    conn.commit()
    conn.close()


def get_unpushed_papers() -> List[Dict]:
    """获取未推送的论文"""
    conn = init_db()
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM papers WHERE pushed = 0").fetchall()
    conn.close()

    papers = []
    for row in rows:
        p = dict(row)
        p["authors"] = json.loads(p.get("authors", "[]"))
        p["categories"] = json.loads(p.get("categories", "[]"))
        p["has_code"] = bool(p.get("has_code"))
        papers.append(p)
    return papers


def get_subscribers() -> List[str]:
    """获取邮件订阅者列表"""
    sub_file = DATA_DIR / "subscribers.txt"
    if not sub_file.exists():
        return []
    return [
        line.strip() for line in sub_file.read_text().splitlines()
        if line.strip() and not line.startswith("#")
        and "@" in line
    ]
