"""Base embedder interface."""

from __future__ import annotations

import numpy as np


class Embedder:
    """Base class for embedding providers."""

    def embed(self, texts: list[str]) -> np.ndarray:
        """Return shape (len(texts), dim)."""
        raise NotImplementedError

    def embed_query(self, query: str) -> np.ndarray:
        """Embed a single query, shape (dim,)."""
        return self.embed([query])[0]
