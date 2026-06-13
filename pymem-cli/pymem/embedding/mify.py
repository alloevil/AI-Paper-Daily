"""Mify embedding API client (qwen3-embedding-8B)."""

from __future__ import annotations

import json
import os
import urllib.request
import numpy as np
from .base import Embedder

API_URL = os.environ.get("MIFY_EMBEDDING_URL", "http://model.mify.ai.srv/v1/embeddings")
MODEL = os.environ.get("MIFY_EMBEDDING_MODEL", "qwen3-embedding-8B-dms-2025-07-17")


class MifyEmbedder(Embedder):
    def __init__(self, api_key: str | None = None, model: str | None = None, batch_size: int = 32):
        self.api_key = api_key or os.environ.get("MODEL_API_KEY", "")
        self.model = model or MODEL
        self.batch_size = batch_size

    def embed(self, texts: list[str]) -> np.ndarray:
        all_embeddings: list[list[float]] = []
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i : i + self.batch_size]
            all_embeddings.extend(self._call_api(batch))
        return np.array(all_embeddings, dtype=np.float32)

    def _call_api(self, texts: list[str]) -> list[list[float]]:
        payload = json.dumps({
            "model": self.model,
            "input": texts,
        }).encode("utf-8")

        req = urllib.request.Request(
            API_URL,
            data=payload,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())

        # Sort by index to ensure order
        sorted_data = sorted(data["data"], key=lambda x: x["index"])
        return [item["embedding"] for item in sorted_data]
