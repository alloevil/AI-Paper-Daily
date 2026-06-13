"""Fixed-size chunker (by byte length)."""

from __future__ import annotations

from .base import Chunk, Chunker


class FixedChunker(Chunker):
    def chunk(self, text: str, chunk_size: int = 512) -> list[Chunk]:
        data = text.encode("utf-8")
        chunks: list[Chunk] = []
        for i in range(0, len(data), chunk_size):
            raw = data[i : i + chunk_size]
            content = raw.decode("utf-8", errors="replace")
            chunks.append(Chunk(content=content, start_byte=i, end_byte=i + len(raw)))
        return chunks
