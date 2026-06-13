"""Code-aware chunker: splits by function/class definitions using regex."""

from __future__ import annotations

import re
from .base import Chunk, Chunker

# Patterns for function/class definitions per language
_PATTERNS: dict[str, re.Pattern[str]] = {
    "python": re.compile(r"^(class\s+\w+|def\s+\w+|async\s+def\s+\w+)", re.MULTILINE),
    "javascript": re.compile(r"^(export\s+)?(async\s+)?(function\s+\w+|class\s+\w+|const\s+\w+\s*=\s*(async\s+)?\(|let\s+\w+\s*=\s*(async\s+)?\()", re.MULTILINE),
    "typescript": re.compile(r"^(export\s+)?(async\s+)?(function\s+\w+|class\s+\w+|interface\s+\w+|type\s+\w+|const\s+\w+\s*[:=])", re.MULTILINE),
    "go": re.compile(r"^func\s+", re.MULTILINE),
    "rust": re.compile(r"^(pub\s+)?(fn\s+|struct\s+|impl\s+|trait\s+|enum\s+|mod\s+)", re.MULTILINE),
    "java": re.compile(r"^(public|private|protected|static|\s)*\s*(class|interface|enum|void|int|String|boolean|long|double|float|char|byte|short)\s+\w+", re.MULTILINE),
}

_EXT_MAP = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
}


class CodeChunker(Chunker):
    def chunk(self, text: str, chunk_size: int = 512) -> list[Chunk]:
        lang = _detect_language(text)
        pattern = _PATTERNS.get(lang)
        if not pattern:
            # Fallback to fixed chunking
            from .fixed import FixedChunker
            return FixedChunker().chunk(text, chunk_size)

        lines = text.split("\n")
        boundaries: list[int] = []  # line indices where definitions start
        for i, line in enumerate(lines):
            if pattern.match(line):
                boundaries.append(i)

        if not boundaries:
            from .fixed import FixedChunker
            return FixedChunker().chunk(text, chunk_size)

        # Build chunks from boundaries
        chunks: list[Chunk] = []
        encoded = text.encode("utf-8")

        for idx, start_line in enumerate(boundaries):
            end_line = boundaries[idx + 1] if idx + 1 < len(boundaries) else len(lines)
            chunk_text = "\n".join(lines[start_line:end_line])
            start_byte = len("\n".join(lines[:start_line]).encode("utf-8")) + (1 if start_line > 0 else 0)
            end_byte = start_byte + len(chunk_text.encode("utf-8"))
            chunks.append(Chunk(
                content=chunk_text,
                start_byte=start_byte,
                end_byte=end_byte,
                metadata={"type": "code", "language": lang, "start_line": start_line + 1},
            ))

        # Merge small chunks
        return _merge_small_chunks(chunks, chunk_size)


def _detect_language(text: str) -> str:
    """Simple heuristic language detection."""
    if re.search(r"^func\s+", text, re.MULTILINE):
        return "go"
    if re.search(r"^(pub\s+)?(fn|struct|impl|trait)\s+", text, re.MULTILINE):
        return "rust"
    if re.search(r"\bpackage\s+\w+;", text):
        return "java"
    if re.search(r"^class\s+\w+", text, re.MULTILINE) and ":" in text:
        return "python"
    if re.search(r":\s*(string|number|boolean)", text):
        return "typescript"
    return "python"  # default


def _merge_small_chunks(chunks: list[Chunk], min_size: int) -> list[Chunk]:
    if not chunks:
        return []

    merged: list[Chunk] = []
    buf = chunks[0]

    for c in chunks[1:]:
        if len(buf.content.encode("utf-8")) < min_size:
            buf = Chunk(
                content=buf.content + "\n" + c.content,
                start_byte=buf.start_byte,
                end_byte=c.end_byte,
                metadata=buf.metadata,
            )
        else:
            merged.append(buf)
            buf = c

    merged.append(buf)
    return merged
