#!/bin/bash
cd /root/.openclaw/workspace
python3 scripts/research.py full "社交媒体数据构建知识图谱" \
  -q "社交媒体 知识图谱 Twitter 微博 开源项目,GraphRAG 社交媒体,知识图谱构建 LLM 最佳实践,Neo4j 社交媒体数据建模,知识抽取 社交媒体文本 OneKE" \
  -n 5 -t 12000
