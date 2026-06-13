"""SQLite persistence for buffers, chunks, and dispatch results."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DB_PATH = os.environ.get("PYMEM_DB", str(Path.cwd() / "pymem.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS buffers (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE,
    source_path TEXT,
    chunker TEXT,
    chunk_size INTEGER,
    created_at TIMESTAMP,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY,
    buffer_id INTEGER REFERENCES buffers(id),
    chunk_index INTEGER,
    content TEXT,
    start_byte INTEGER,
    end_byte INTEGER,
    embedding BLOB,
    metadata TEXT,
    FOREIGN KEY (buffer_id) REFERENCES buffers(id)
);

CREATE TABLE IF NOT EXISTS dispatch_results (
    id INTEGER PRIMARY KEY,
    buffer_id INTEGER REFERENCES buffers(id),
    chunk_ids TEXT,
    query TEXT,
    result TEXT,
    model TEXT,
    created_at TIMESTAMP,
    FOREIGN KEY (buffer_id) REFERENCES buffers(id)
);
"""


def get_db(db_path: str | None = None) -> sqlite3.Connection:
    path = db_path or DB_PATH
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(db_path: str | None = None) -> sqlite3.Connection:
    conn = get_db(db_path)
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Buffer operations ──


def create_buffer(
    conn: sqlite3.Connection,
    name: str,
    source_path: str,
    chunker: str,
    chunk_size: int,
    metadata: dict[str, Any] | None = None,
) -> int:
    cur = conn.execute(
        "INSERT INTO buffers (name, source_path, chunker, chunk_size, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)",
        (name, source_path, chunker, chunk_size, _now(), json.dumps(metadata or {})),
    )
    conn.commit()
    return cur.lastrowid  # type: ignore[return-value]


def get_buffer(conn: sqlite3.Connection, name: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM buffers WHERE name = ?", (name,)).fetchone()


def list_buffers(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM buffers ORDER BY id").fetchall()


def delete_buffer(conn: sqlite3.Connection, name: str) -> bool:
    buf = get_buffer(conn, name)
    if not buf:
        return False
    conn.execute("DELETE FROM chunks WHERE buffer_id = ?", (buf["id"],))
    conn.execute("DELETE FROM dispatch_results WHERE buffer_id = ?", (buf["id"],))
    conn.execute("DELETE FROM buffers WHERE id = ?", (buf["id"],))
    conn.commit()
    return True


# ── Chunk operations ──


def insert_chunks(
    conn: sqlite3.Connection,
    buffer_id: int,
    chunks: list[dict[str, Any]],
) -> None:
    conn.executemany(
        "INSERT INTO chunks (buffer_id, chunk_index, content, start_byte, end_byte, embedding, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            (
                buffer_id,
                c["chunk_index"],
                c["content"],
                c["start_byte"],
                c["end_byte"],
                c.get("embedding"),
                json.dumps(c.get("metadata", {})),
            )
            for c in chunks
        ],
    )
    conn.commit()


def get_chunks(conn: sqlite3.Connection, buffer_id: int) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM chunks WHERE buffer_id = ? ORDER BY chunk_index", (buffer_id,)
    ).fetchall()


def get_chunk_by_id(conn: sqlite3.Connection, chunk_id: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM chunks WHERE id = ?", (chunk_id,)).fetchone()


def get_all_chunks_with_embeddings(conn: sqlite3.Connection, buffer_id: int | None = None) -> list[sqlite3.Row]:
    if buffer_id is not None:
        return conn.execute(
            "SELECT * FROM chunks WHERE buffer_id = ? AND embedding IS NOT NULL ORDER BY chunk_index",
            (buffer_id,),
        ).fetchall()
    return conn.execute(
        "SELECT * FROM chunks WHERE embedding IS NOT NULL ORDER BY buffer_id, chunk_index"
    ).fetchall()


# ── Dispatch operations ──


def insert_dispatch_result(
    conn: sqlite3.Connection,
    buffer_id: int,
    chunk_ids: list[int],
    query: str,
    result: str,
    model: str,
) -> int:
    cur = conn.execute(
        "INSERT INTO dispatch_results (buffer_id, chunk_ids, query, result, model, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (buffer_id, json.dumps(chunk_ids), query, result, model, _now()),
    )
    conn.commit()
    return cur.lastrowid  # type: ignore[return-value]


def get_dispatch_results(conn: sqlite3.Connection, buffer_id: int) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM dispatch_results WHERE buffer_id = ? ORDER BY id", (buffer_id,)
    ).fetchall()


def clear_dispatch_results(conn: sqlite3.Connection, buffer_id: int) -> None:
    conn.execute("DELETE FROM dispatch_results WHERE buffer_id = ?", (buffer_id,))
    conn.commit()


# ── Stats ──


def stats(conn: sqlite3.Connection) -> dict[str, Any]:
    buf_count = conn.execute("SELECT COUNT(*) FROM buffers").fetchone()[0]
    chunk_count = conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
    embed_count = conn.execute("SELECT COUNT(*) FROM chunks WHERE embedding IS NOT NULL").fetchone()[0]
    dispatch_count = conn.execute("SELECT COUNT(*) FROM dispatch_results").fetchone()[0]
    return {
        "buffers": buf_count,
        "chunks": chunk_count,
        "embedded_chunks": embed_count,
        "dispatch_results": dispatch_count,
    }


def reset(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        DELETE FROM dispatch_results;
        DELETE FROM chunks;
        DELETE FROM buffers;
    """)
    conn.commit()
