---
name: gbrain
version: 1.0.0
description: |
  gBrain 知识库集成 — 让 Agent 先查脑再行动。
  基于 garrytan/gbrain，提供语义搜索、知识图谱、自动富化能力。
triggers:
  - "搜索知识库"
  - "查一下brain"
  - "gbrain"
  - "知识库里"
---

# gBrain 知识库集成

## 核心理念：Brain-First（先查脑再行动）

每次回答问题前，先搜 brain，再用外部 API 填补空白。

## 使用方式

### 搜索知识库
```bash
cd ~/gbrain && gbrain query "搜索内容"
```

### 读取某页
```bash
cd ~/gbrain && gbrain get <slug>
```

### 导入新内容
```bash
cd ~/gbrain && gbrain sync && gbrain embed --stale
```

### 查看统计
```bash
cd ~/gbrain && gbrain stats
```

## 环境变量（已配置在 ~/.bashrc）

```bash
export OPENAI_API_KEY="mit-..."
export OPENAI_BASE_URL="http://model.mify.ai.srv/v1/"
export EMBEDDING_MODEL="tongyi/text-embedding-v3"
export EMBEDDING_DIMENSIONS="1024"
```

## Brain 仓库位置

- Brain 数据：`~/.gbrain/brain.pglite`
- Brain 文件：`~/brain/`
- gBrain 源码：`~/gbrain/`

## 工作流程

1. 收到问题 → `gbrain query` 语义搜索
2. 找到相关页面 → `gbrain get` 读取详情
3. 回答问题，引用 brain 中的知识
4. 新信息 → 写入 `~/brain/` → `gbrain sync && gbrain embed --stale`
