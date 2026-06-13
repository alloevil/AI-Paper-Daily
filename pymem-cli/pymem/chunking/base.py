"""Base chunker interface."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Chunk:
    content: str
    start_byte: int
    end_byte: int
    metadata: dict[str, Any] = field(default_factory=dict)


class Chunker:
    """Base class for all chunkers."""

    def chunk(self, text: str, chunk_size: int = 512) -> list[Chunk]:
        raise NotImplementedError
