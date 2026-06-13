"""Vector semantic search using cosine similarity."""

from __future__ import annotations

import numpy as np


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Compute cosine similarity between a (n, d) and b (m, d) → (n, m)."""
    a_norm = a / (np.linalg.norm(a, axis=1, keepdims=True) + 1e-10)
    b_norm = b / (np.linalg.norm(b, axis=1, keepdims=True) + 1e-10)
    return a_norm @ b_norm.T


class SemanticSearch:
    def __init__(self) -> None:
        self._ids: list[int] = []
        self._embeddings: list[np.ndarray] = []

    def add(self, doc_id: int, embedding: np.ndarray) -> None:
        self._ids.append(doc_id)
        self._embeddings.append(embedding)

    def search(self, query_embedding: np.ndarray, top_k: int = 10) -> list[tuple[int, float]]:
        """Return top-k (doc_id, similarity_score)."""
        if not self._embeddings:
            return []

        doc_matrix = np.stack(self._embeddings)  # (n, d)
        q = query_embedding.reshape(1, -1)  # (1, d)
        sims = cosine_similarity(q, doc_matrix)[0]  # (n,)
        ranked = np.argsort(sims)[::-1][:top_k]
        return [(self._ids[i], float(sims[i])) for i in ranked if sims[i] > -1]
