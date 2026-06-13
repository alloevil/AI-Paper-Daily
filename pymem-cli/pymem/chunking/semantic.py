"""Semantic chunker: splits by markdown headings and blank lines, merges short paragraphs."""

from __future__ import annotations

import re
from .base import Chunk, Chunker

_HEADING_RE = re.compile(r"^#{1,6}\s+.+", re.MULTILINE)


class SemanticChunker(Chunker):
    def chunk(self, text: str, chunk_size: int = 512) -> list[Chunk]:
        # Split by markdown headings first
        sections = _split_by_headings(text)
        # Then split each section by blank lines
        paragraphs: list[tuple[str, int, int]] = []
        for sec_text, sec_start in sections:
            for para_text, para_start, para_end in _split_by_blanks(sec_text, sec_start):
                paragraphs.append((para_text, para_start, para_end))

        # Merge short paragraphs
        return _merge_short(paragraphs, chunk_size)


def _split_by_headings(text: str) -> list[tuple[str, int]]:
    """Split text by markdown headings, returning (section_text, start_byte)."""
    lines = text.split("\n")
    sections: list[tuple[str, int]] = []
    current_lines: list[str] = []
    current_start = 0
    byte_offset = 0

    for line in lines:
        line_bytes = len(line.encode("utf-8")) + 1  # +1 for \n
        if _HEADING_RE.match(line) and current_lines:
            joined = "\n".join(current_lines)
            sections.append((joined, current_start))
            current_lines = [line]
            current_start = byte_offset
        else:
            if not current_lines:
                current_start = byte_offset
            current_lines.append(line)
        byte_offset += line_bytes

    if current_lines:
        sections.append(("\n".join(current_lines), current_start))

    return sections


def _split_by_blanks(text: str, base_offset: int) -> list[tuple[str, int, int]]:
    """Split by blank lines, returning (text, start_byte, end_byte)."""
    paragraphs: list[tuple[str, int, int]] = []
    current_lines: list[str] = []
    current_start = 0
    byte_offset = 0

    for line in text.split("\n"):
        line_bytes = len(line.encode("utf-8")) + 1
        if line.strip() == "" and current_lines:
            joined = "\n".join(current_lines)
            paragraphs.append((joined, base_offset + current_start, base_offset + current_start + len(joined.encode("utf-8"))))
            current_lines = []
            current_start = byte_offset + line_bytes
        else:
            if not current_lines:
                current_start = byte_offset
            current_lines.append(line)
        byte_offset += line_bytes

    if current_lines:
        joined = "\n".join(current_lines)
        paragraphs.append((joined, base_offset + current_start, base_offset + current_start + len(joined.encode("utf-8"))))

    return paragraphs


def _merge_short(paragraphs: list[tuple[str, int, int]], min_size: int) -> list[Chunk]:
    """Merge paragraphs shorter than min_size."""
    if not paragraphs:
        return []

    chunks: list[Chunk] = []
    buf_text = ""
    buf_start = paragraphs[0][1]

    for para_text, start, end in paragraphs:
        if len(buf_text.encode("utf-8")) + len(para_text.encode("utf-8")) <= min_size * 2:
            if buf_text:
                buf_text += "\n" + para_text
            else:
                buf_text = para_text
                buf_start = start
        else:
            if buf_text:
                chunks.append(Chunk(
                    content=buf_text,
                    start_byte=buf_start,
                    end_byte=buf_start + len(buf_text.encode("utf-8")),
                    metadata={"type": "semantic"},
                ))
            buf_text = para_text
            buf_start = start

    if buf_text:
        chunks.append(Chunk(
            content=buf_text,
            start_byte=buf_start,
            end_byte=buf_start + len(buf_text.encode("utf-8")),
            metadata={"type": "semantic"},
        ))

    return chunks
