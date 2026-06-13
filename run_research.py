#!/usr/bin/env python3
"""Wrapper to run research.py full flow."""
import subprocess
import sys

result = subprocess.run(
    [sys.executable, "scripts/research.py", "full",
     "社交媒体数据构建知识图谱",
     "-q", "社交媒体 知识图谱 Twitter 微博 开源项目,GraphRAG 社交媒体,知识图谱构建 LLM 最佳实践,Neo4j 社交媒体数据建模,知识抽取 社交媒体文本 OneKE",
     "-n", "5", "-t", "12000"],
    cwd="/root/.openclaw/workspace",
    capture_output=True, text=True, timeout=300
)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr, file=sys.stderr)
sys.exit(result.returncode)
