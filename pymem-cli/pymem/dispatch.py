"""Dispatch chunks to LLM for parallel processing, and aggregate results."""

from __future__ import annotations

import json
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

from . import storage

LLM_URL = os.environ.get("MIFY_LLM_URL", "http://model.mify.ai.srv/v1/chat/completions")
LLM_MODEL = os.environ.get("MIFY_LLM_MODEL", "xiaomi/mimo-v2.5")


def _call_llm(prompt: str, api_key: str, model: str | None = None, timeout: int = 120) -> str:
    """Call LLM API and return response text."""
    payload = json.dumps({
        "model": model or LLM_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 4096,
    }).encode("utf-8")

    req = urllib.request.Request(
        LLM_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read())

    return data["choices"][0]["message"]["content"]


def dispatch(
    conn,
    buffer_name: str,
    query: str,
    parallel: int = 3,
    api_key: str | None = None,
    model: str | None = None,
) -> list[dict]:
    """Split chunks into batches and process each with LLM in parallel."""
    api_key = api_key or os.environ.get("MODEL_API_KEY", "")
    buf = storage.get_buffer(conn, buffer_name)
    if not buf:
        raise ValueError(f"Buffer '{buffer_name}' not found")

    chunks = storage.get_chunks(conn, buf["id"])
    if not chunks:
        raise ValueError(f"Buffer '{buffer_name}' has no chunks")

    # Split into batches
    chunk_list = list(chunks)
    batch_size = max(1, len(chunk_list) // parallel)
    batches: list[list] = []
    for i in range(0, len(chunk_list), batch_size):
        batches.append(chunk_list[i : i + batch_size])

    def process_batch(batch):
        batch_ids = [c["id"] for c in batch]
        context = "\n\n---\n\n".join(c["content"] for c in batch)
        prompt = f"""请根据以下文档片段回答问题。

文档内容：
{context}

问题：{query}

请基于文档内容给出准确、详细的回答。"""
        result = _call_llm(prompt, api_key, model)
        storage.insert_dispatch_result(conn, buf["id"], batch_ids, query, result, model or LLM_MODEL)
        return {"chunk_ids": batch_ids, "result": result}

    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=parallel) as executor:
        futures = {executor.submit(process_batch, batch): i for i, batch in enumerate(batches)}
        for future in as_completed(futures):
            results.append(future.result())

    return results


def aggregate(
    conn,
    buffer_name: str,
    api_key: str | None = None,
    model: str | None = None,
) -> str:
    """Aggregate all dispatch results into a final answer."""
    api_key = api_key or os.environ.get("MODEL_API_KEY", "")
    buf = storage.get_buffer(conn, buffer_name)
    if not buf:
        raise ValueError(f"Buffer '{buffer_name}' not found")

    results = storage.get_dispatch_results(conn, buf["id"])
    if not results:
        raise ValueError(f"No dispatch results for buffer '{buffer_name}'")

    query = results[0]["query"]
    parts = [f"## 分析 {i+1}\n{r['result']}" for i, r in enumerate(results)]
    combined = "\n\n".join(parts)

    prompt = f"""请将以下多个分析结果合并为一个完整、连贯的回答。

原始问题：{query}

各分析结果：
{combined}

请合并为一个完整的最终回答。"""
    return _call_llm(prompt, api_key, model)
