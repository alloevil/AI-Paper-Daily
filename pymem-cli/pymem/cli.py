"""pymem CLI - Document chunking, embedding, and hybrid search."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np

from . import storage
from .chunking import CHUNKERS


def _get_db():
    return storage.init_db()


def cmd_init(args):
    conn = _get_db()
    conn.close()
    print(f"✅ Database initialized at {storage.DB_PATH}")


def cmd_load(args):
    conn = _get_db()
    path = Path(args.file)
    buf_name = args.name or path.stem

    existing = storage.get_buffer(conn, buf_name)
    if existing:
        storage.delete_buffer(conn, buf_name)

    text = path.read_text(encoding="utf-8", errors="replace")
    chunker_cls = CHUNKERS[args.chunker]
    chunks = chunker_cls().chunk(text, args.chunk_size)

    buf_id = storage.create_buffer(conn, buf_name, str(path.resolve()), args.chunker, args.chunk_size)
    chunk_dicts = [
        {"chunk_index": i, "content": c.content, "start_byte": c.start_byte,
         "end_byte": c.end_byte, "metadata": c.metadata}
        for i, c in enumerate(chunks)
    ]
    storage.insert_chunks(conn, buf_id, chunk_dicts)
    print(f"✅ Loaded '{buf_name}' with {len(chunks)} chunks (chunker={args.chunker}, size={args.chunk_size})")
    conn.close()


def cmd_search(args):
    conn = _get_db()
    from .search.bm25 import BM25
    from .search.semantic import SemanticSearch
    from .search.hybrid import HybridSearch

    bm25 = BM25()
    semantic = SemanticSearch()

    if args.buffer:
        buf = storage.get_buffer(conn, args.buffer)
        if not buf:
            print(f"❌ Buffer '{args.buffer}' not found"); conn.close(); return
        chunks = storage.get_chunks(conn, buf["id"])
    else:
        all_bufs = storage.list_buffers(conn)
        chunks = []
        for b in all_bufs:
            chunks.extend(storage.get_chunks(conn, b["id"]))

    if not chunks:
        print("❌ No chunks found"); conn.close(); return

    for c in chunks:
        bm25.add_document(c["id"], c["content"])
        if c["embedding"]:
            emb = np.frombuffer(c["embedding"], dtype=np.float32)
            semantic.add(c["id"], emb)

    hybrid = HybridSearch()
    hybrid.bm25 = bm25
    hybrid.semantic = semantic

    query_emb = None
    try:
        from .embedding import MifyEmbedder
        query_emb = MifyEmbedder().embed_query(args.query)
    except Exception:
        pass

    results = hybrid.search(args.query, query_emb, args.top_k)
    if not results:
        print("No results found."); conn.close(); return

    print(f"🔍 Found {len(results)} results for: {args.query}\n")
    for rank, (chunk_id, score) in enumerate(results, 1):
        c = storage.get_chunk_by_id(conn, chunk_id)
        if c:
            preview = c["content"][:120].replace("\n", " ")
            print(f"  {rank}. [{score:.4f}] buffer={c['buffer_id']} chunk={c['chunk_index']}")
            print(f"     {preview}...")
    conn.close()


def cmd_list(args):
    conn = _get_db()
    buffers = storage.list_buffers(conn)
    if not buffers:
        print("No buffers loaded."); conn.close(); return
    print(f"📦 {len(buffers)} buffer(s):\n")
    for b in buffers:
        chunks = storage.get_chunks(conn, b["id"])
        print(f"  • {b['name']}  chunks={len(chunks)}  chunker={b['chunker']}  size={b['chunk_size']}")
    conn.close()


def cmd_show(args):
    conn = _get_db()
    buf = storage.get_buffer(conn, args.name)
    if not buf:
        print(f"❌ Buffer '{args.name}' not found"); conn.close(); return
    chunks = storage.get_chunks(conn, buf["id"])
    embedded = sum(1 for c in chunks if c["embedding"])
    print(f"📦 Buffer: {buf['name']}")
    print(f"   Source: {buf['source_path']}")
    print(f"   Chunker: {buf['chunker']}, size={buf['chunk_size']}")
    print(f"   Chunks: {len(chunks)} ({embedded} with embeddings)")
    print(f"   Created: {buf['created_at']}")
    conn.close()


def cmd_delete(args):
    conn = _get_db()
    if storage.delete_buffer(conn, args.name):
        print(f"🗑️  Deleted buffer '{args.name}'")
    else:
        print(f"❌ Buffer '{args.name}' not found")
    conn.close()


def cmd_grep(args):
    conn = _get_db()
    buf = storage.get_buffer(conn, args.name)
    if not buf:
        print(f"❌ Buffer '{args.name}' not found"); conn.close(); return
    chunks = storage.get_chunks(conn, buf["id"])
    regex = re.compile(args.pattern, re.IGNORECASE)
    matches = 0
    for c in chunks:
        if regex.search(c["content"]):
            matches += 1
            preview = c["content"][:150].replace("\n", " ")
            print(f"  chunk[{c['chunk_index']}]: {preview}")
    if matches == 0:
        print(f"No matches for '{args.pattern}' in buffer '{args.name}'")
    else:
        print(f"\n{matches} chunk(s) matched")
    conn.close()


def cmd_peek(args):
    conn = _get_db()
    buf = storage.get_buffer(conn, args.name)
    if not buf:
        print(f"❌ Buffer '{args.name}' not found"); conn.close(); return
    chunks = storage.get_chunks(conn, buf["id"])
    sliced = chunks[args.start:args.end]
    if not sliced:
        print("No chunks in range"); conn.close(); return
    for c in sliced:
        print(f"─── chunk[{c['chunk_index']}] (bytes {c['start_byte']}-{c['end_byte']}) ───")
        print(c["content"])
        print()
    conn.close()


def cmd_chunk_list(args):
    conn = _get_db()
    buf = storage.get_buffer(conn, args.name)
    if not buf:
        print(f"❌ Buffer '{args.name}' not found"); conn.close(); return
    chunks = storage.get_chunks(conn, buf["id"])
    print(f"📋 {len(chunks)} chunks in '{args.name}':\n")
    for c in chunks:
        emb = "✅" if c["embedding"] else "❌"
        preview = c["content"][:60].replace("\n", " ")
        print(f"  [{c['id']}] idx={c['chunk_index']} emb={emb} bytes={c['start_byte']}-{c['end_byte']}")
        print(f"       {preview}")
    conn.close()


def cmd_chunk_get(args):
    conn = _get_db()
    c = storage.get_chunk_by_id(conn, args.id)
    if not c:
        print(f"❌ Chunk {args.id} not found"); conn.close(); return
    print(f"Chunk {c['id']} (buffer={c['buffer_id']}, index={c['chunk_index']})")
    print(f"Bytes: {c['start_byte']}-{c['end_byte']}")
    print(f"Has embedding: {'Yes' if c['embedding'] else 'No'}")
    if c["metadata"]:
        print(f"Metadata: {c['metadata']}")
    print("─" * 40)
    print(c["content"])
    conn.close()


def cmd_status(args):
    conn = _get_db()
    s = storage.stats(conn)
    print(f"📊 pymem status:")
    print(f"   DB: {storage.DB_PATH}")
    print(f"   Buffers: {s['buffers']}")
    print(f"   Chunks: {s['chunks']} ({s['embedded_chunks']} embedded)")
    print(f"   Dispatch results: {s['dispatch_results']}")
    conn.close()


def cmd_dispatch(args):
    from .dispatch import dispatch as do_dispatch
    conn = _get_db()
    try:
        results = do_dispatch(conn, args.name, args.query, args.parallel)
        print(f"✅ Dispatched {len(results)} batches for '{args.name}'")
        for i, r in enumerate(results):
            preview = r["result"][:200].replace("\n", " ")
            print(f"  Batch {i+1}: {preview}...")
    except Exception as e:
        print(f"❌ {e}")
    finally:
        conn.close()


def cmd_aggregate(args):
    from .dispatch import aggregate as do_aggregate
    conn = _get_db()
    try:
        result = do_aggregate(conn, args.name)
        print(f"📝 Aggregated result for '{args.name}':\n")
        print(result)
    except Exception as e:
        print(f"❌ {e}")
    finally:
        conn.close()


def cmd_reset(args):
    conn = _get_db()
    storage.reset(conn)
    print("🗑️  All data cleared.")
    conn.close()


def main():
    parser = argparse.ArgumentParser(prog="pymem", description="pymem - Document chunking, embedding, and hybrid search")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("init", help="Initialize the SQLite database")

    p = sub.add_parser("load", help="Load a file into a buffer")
    p.add_argument("file")
    p.add_argument("--name", "-n", default=None)
    p.add_argument("--chunker", "-c", choices=["fixed", "semantic", "code"], default="fixed")
    p.add_argument("--chunk-size", "-s", type=int, default=512)

    p = sub.add_parser("search", help="Hybrid search (BM25 + semantic)")
    p.add_argument("query")
    p.add_argument("--buffer", "-b", default=None)
    p.add_argument("--top-k", "-k", type=int, default=10)

    sub.add_parser("list", help="List all buffers")

    p = sub.add_parser("show", help="Show buffer details")
    p.add_argument("name")

    p = sub.add_parser("delete", help="Delete a buffer")
    p.add_argument("name")

    p = sub.add_parser("grep", help="Regex search in buffer")
    p.add_argument("name")
    p.add_argument("pattern")

    p = sub.add_parser("peek", help="View buffer chunk slice")
    p.add_argument("name")
    p.add_argument("--start", "-s", type=int, default=0)
    p.add_argument("--end", "-e", type=int, default=None)

    p = sub.add_parser("chunk", help="Chunk inspection")
    sp = p.add_subparsers(dest="chunk_cmd")
    pl = sp.add_parser("list", help="List chunks")
    pl.add_argument("name")
    pg = sp.add_parser("get", help="Get chunk by ID")
    pg.add_argument("id", type=int)

    sub.add_parser("status", help="Show status overview")

    p = sub.add_parser("dispatch", help="Dispatch chunks to LLM")
    p.add_argument("name")
    p.add_argument("--query", "-q", required=True)
    p.add_argument("--parallel", "-p", type=int, default=3)

    p = sub.add_parser("aggregate", help="Aggregate dispatch results")
    p.add_argument("name")

    sub.add_parser("reset", help="Clear all data")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    cmd_map = {
        "init": cmd_init, "load": cmd_load, "search": cmd_search,
        "list": cmd_list, "show": cmd_show, "delete": cmd_delete,
        "grep": cmd_grep, "peek": cmd_peek, "status": cmd_status,
        "dispatch": cmd_dispatch, "aggregate": cmd_aggregate, "reset": cmd_reset,
    }

    if args.command == "chunk":
        chunk_map = {"list": cmd_chunk_list, "get": cmd_chunk_get}
        fn = chunk_map.get(args.chunk_cmd)
        if fn:
            fn(args)
        else:
            parser.parse_args(["chunk", "--help"])
    elif args.command in cmd_map:
        cmd_map[args.command](args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
