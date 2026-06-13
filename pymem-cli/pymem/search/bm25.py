"""Okapi BM25 implementation with jieba for Chinese tokenization."""

from __future__ import annotations

import math
import re
from collections import Counter

try:
    import jieba
    _HAS_JIEBA = True
except ImportError:
    _HAS_JIEBA = False


def _tokenize(text: str) -> list[str]:
    """Tokenize: jieba for Chinese, whitespace for English."""
    # Separate CJK and non-CJK
    tokens: list[str] = []
    # Simple approach: use jieba if available, else split by non-word chars
    if _HAS_JIEBA:
        tokens = list(jieba.cut(text))
    else:
        # Fallback: split by whitespace and punctuation, keep CJK chars individually
        tokens = re.findall(r"[\u4e00-\u9fff]|[a-zA-Z0-9_]+", text)
    return [t.strip().lower() for t in tokens if t.strip()]


class BM25:
    """Okapi BM25 scorer."""

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self._docs: list[list[str]] = []
        self._doc_ids: list[int] = []
        self._df: Counter[str] = Counter()
        self._doc_len: list[int] = []
        self._avgdl: float = 0.0
        self._n: int = 0

    def add_document(self, doc_id: int, text: str) -> None:
        tokens = _tokenize(text)
        self._docs.append(tokens)
        self._doc_ids.append(doc_id)
        self._doc_len.append(len(tokens))
        seen = set(tokens)
        for t in seen:
            self._df[t] += 1
        self._n += 1
        self._avgdl = sum(self._doc_len) / self._n

    def score(self, query: str, top_k: int = 10) -> list[tuple[int, float]]:
        """Return top-k (doc_id, score) pairs."""
        if self._n == 0:
            return []

        query_tokens = _tokenize(query)
        scores = [0.0] * self._n

        for qt in query_tokens:
            df = self._df.get(qt, 0)
            if df == 0:
                continue
            idf = math.log((self._n - df + 0.5) / (df + 0.5) + 1.0)
            for i, doc_tokens in enumerate(self._docs):
                tf = doc_tokens.count(qt)
                if tf == 0:
                    continue
                dl = self._doc_len[i]
                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (1 - self.b + self.b * dl / self._avgdl)
                scores[i] += idf * numerator / denominator

        ranked = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)[:top_k]
        return [(self._doc_ids[i], s) for i, s in ranked if s > 0]
