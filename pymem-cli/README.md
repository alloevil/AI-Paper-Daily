# pymem-cli

Python CLI for document chunking, embedding, and hybrid search. Inspired by [rlm-cli](https://github.com/zircote/rlm-rs).

## Features

- **Multiple chunkers**: fixed-size, semantic (markdown-aware), code-aware (function/class boundaries)
- **Hybrid search**: BM25 + vector semantic search with RRF fusion
- **Embedding**: via Mify API (qwen3-embedding-8B)
- **Dispatch/Aggregate**: parallel LLM processing of chunks
- **SQLite storage**: persistent, zero-config

## Install

```bash
pip install -e .
```

## Usage

```bash
pymem init                          # Initialize SQLite DB
pymem load <file> [--chunker fixed|semantic|code] [--chunk-size N]
pymem search <query> [--buffer N] [--top-k N]
pymem list                          # List all buffers
pymem show <name>                   # Buffer details
pymem delete <name>                 # Delete buffer
pymem grep <name> <pattern>         # Regex search
pymem peek <name> [--start N] [--end N]
pymem chunk list <name>             # List chunks
pymem chunk get <id>                # Get single chunk
pymem status                        # Status overview
pymem dispatch <name> --query Q     # Parallel LLM processing
pymem aggregate <name>              # Merge dispatch results
pymem reset                         # Clear all data
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PYMEM_DB` | `./pymem.db` | SQLite database path |
| `MODEL_API_KEY` | - | API key for Mify LLM/embedding |
| `MIFY_EMBEDDING_URL` | `http://model.mify.ai.srv/v1/embeddings` | Embedding API endpoint |
| `MIFY_EMBEDDING_MODEL` | `qwen3-embedding-8B-dms-2025-07-17` | Embedding model |
| `MIFY_LLM_URL` | `http://model.mify.ai.srv/v1/chat/completions` | LLM API endpoint |
| `MIFY_LLM_MODEL` | `xiaomi/mimo-v2.5` | LLM model |

## Dependencies

- click
- numpy
- Optional: jieba (for better Chinese BM25 tokenization)
