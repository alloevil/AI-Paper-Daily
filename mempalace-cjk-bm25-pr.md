# PR: Add CJK (Chinese/Japanese/Korean) tokenization for BM25 search

## Problem

BM25 keyword search returns 0 scores for Chinese queries. The `_tokenize` function uses `\w{2,}` regex which splits Chinese text into individual characters rather than meaningful words, making BM25 matching essentially useless for CJK content.

**Example:** Query "每日复盘 cron 备份" against a document containing exactly those words returns `bm25_score: 0.0` because the regex produces `['每', '日', '复', '盘', 'cron', '备', '份']` — single characters that don't match the multi-character query terms.

## Solution

Use [jieba](https://github.com/fxsjy/jieba) for CJK tokenization, following the same approach as [aivectormemory](https://github.com/Edlineas/aivectormemory). jieba is the de-facto standard Chinese word segmentation library (~5M monthly PyPI downloads).

**Key design decisions:**
- **Optional dependency**: jieba is imported with a fallback to the existing regex tokenizer. If jieba is not installed, behavior is unchanged.
- **CJK detection**: Only applies jieba to text containing CJK characters. Pure ASCII text (code, English) uses the existing fast regex path.
- **No FTS5 changes**: Unlike aivectormemory which pre-tokenizes before storing in FTS5, this approach only modifies the in-memory BM25 re-ranking. No database migration needed.

## Changes

### `mempalace/searcher.py`

```python
# Add import (line ~19)
try:
    import jieba
    _HAS_JIEBA = True
except ImportError:
    _HAS_JIEBA = False

# Add CJK detection constant
_CJK_RE = re.compile(r'[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]')

# Replace _tokenize function
def _tokenize(text: str) -> list:
    """Tokenize text for BM25 scoring.

    For CJK text (Chinese/Japanese/Korean), uses jieba word segmentation
    when available. Falls back to the original regex tokenizer for ASCII
    text or when jieba is not installed.
    """
    if not text:
        return []
    text_lower = text.lower()
    # Use jieba for CJK text if available
    if _HAS_JIEBA and _CJK_RE.search(text_lower):
        return [t for t in jieba.cut(text_lower) if len(t) >= 2 and not t.isspace()]
    return _TOKEN_RE.findall(text_lower)
```

### `setup.py` / `pyproject.toml` (optional)

Add jieba as an optional dependency:

```toml
[project.optional-dependencies]
cjk = ["jieba>=0.42"]
```

## Testing

Before (BM25 for Chinese query):
```
Query: "每日复盘 cron 备份"
Result bm25_score: 0.0 (all results)
```

After:
```
Query: "每日复盘 cron 备份"
Result bm25_score: 0.599 (matching document with "每日复盘" and "备份")
```

## References

- [aivectormemory jieba + FTS5 implementation](https://github.com/Edlineas/aivectormemory/blob/main/aivectormemory/db/base.py)
- [SQLite FTS5 CJK discussion](https://github.com/nicoretti/fts5-unicodetokenizer/issues/5)
