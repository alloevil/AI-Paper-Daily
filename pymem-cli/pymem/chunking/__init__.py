from __future__ import annotations

from .base import Chunk, Chunker
from .fixed import FixedChunker
from .semantic import SemanticChunker
from .code import CodeChunker

CHUNKERS: dict[str, type[Chunker]] = {
    "fixed": FixedChunker,
    "semantic": SemanticChunker,
    "code": CodeChunker,
}

__all__ = ["Chunk", "Chunker", "FixedChunker", "SemanticChunker", "CodeChunker", "CHUNKERS"]
