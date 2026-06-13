"""Hybrid search: BM25 + semantic, fused with Reciprocal Rank Fusion (RRF)."""

from __future__ import annotations

from .bm25 import BM25
from .semantic import SemanticSearch


class HybridSearch:
    """Combines BM25 and semantic search with RRF."""

    def __init__(self, rrf_k: int = 60):
        self.bm25 = BM25()
        self.semantic = SemanticSearch()
        self.rrf_k = rrf_k

    def search(
        self,
        query: str,
        query_embedding: "np.ndarray | None" = None,
        top_k: int = 10,
    ) -> list[tuple[int, float]]:
        """Return top-k (doc_id, rrf_score)."""
        import numpy as np

        bm25_results = self.bm25.score(query, top_k=top_k * 3)
        semantic_results: list[tuple[int, float]] = []
        if query_embedding is not None:
            semantic_results = self.semantic.search(query_embedding, top_k=top_k * 3)

        # Build rank maps
        bm25_rank: dict[int, int] = {doc_id: rank + 1 for rank, (doc_id, _) in enumerate(bm25_results)}
        semantic_rank: dict[int, int] = {doc_id: rank + 1 for rank, (doc_id, _) in enumerate(semantic_results)}

        all_ids = set(bm25_rank.keys()) | set(semantic_rank.keys())

        scores: dict[int, float] = {}
        for doc_id in all_ids:
            score = 0.0
            if doc_id in bm25_rank:
                score += 1.0 / (self.rrf_k + bm25_rank[doc_id])
            if doc_id in semantic_rank:
                score += 1.0 / (self.rrf_k + semantic_rank[doc_id])
            scores[doc_id] = score

        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
        return ranked
