# 方向 F：Agent + KG（智能体与知识图谱结合）调研笔记

> 调研时间：2026-04-16 | 聚焦 2024-2026 最新技术与工程实践

---

## 一、技术全景

### 1.1 为什么 Agent 需要 KG？

| 传统 RAG 的局限 | KG 带来的能力 |
|---|---|
| 向量检索语义模糊（"template" ≠ "format"） | 实体关系精确匹配 |
| 无时间维度（不知道事实何时变化） | 时序知识图谱追踪事实有效期 |
| 碎片化检索，无法多跳推理 | 图遍历支持多跳推理 |
| 重复注入上下文，token 成本高 | 结构化知识压缩存储 |
| 无实体消歧和合并能力 | 自动实体消歧、关系合并 |

### 1.2 四大融合模式

```
┌──────────────────────────────────────────────────────┐
│                 Agent + KG 技术全景                    │
├──────────────┬──────────────┬───────────────┬─────────┤
│ ① Agent 记忆  │ ② Agentic RAG │ ③ Agent 知识管理 │ ④ 多Agent│
│  图结构记忆层  │  KG增强检索    │  个人知识图谱构建  │ 共享KG  │
├──────────────┼──────────────┼───────────────┼─────────┤
│ Mem0 (Hybrid) │ GraphRAG     │ Cognee        │ Neo4j   │
│ Zep/Graphiti  │ LightRAG     │ LlamaIndex KG │ 共享图谱 │
│ Letta/MemGPT  │ KA-RAG       │ MemPalace     │ KARMA   │
│ MemVerse      │ G-Retriever  │               │         │
└──────────────┴──────────────┴───────────────┴─────────┘
```

### 1.3 图结构类型演进

| 图类型 | 特点 | 代表项目 |
|---|---|---|
| **知识图谱 (KG)** | 实体-关系-实体三元组 | Microsoft GraphRAG, Neo4j |
| **时序知识图谱 (TKG)** | 三元组 + 时间窗口（valid_from / valid_to） | Zep/Graphiti |
| **超图 (Hypergraph)** | 一条边连接多个节点 | MemVerse |
| **属性图 (Property Graph)** | 节点和边可携带属性 | Neo4j, Cognee |

---

## 二、重点项目/框架列表

### 2.1 Agent 记忆层（图结构记忆）

| 项目 | GitHub Stars | 架构 | 核心能力 | 适用场景 |
|---|---|---|---|---|
| **[Mem0](https://github.com/mem0ai/mem0)** | ~48K ⭐ | Hybrid (Vector + Graph + KV) | 三层作用域（user/session/agent）、自编辑记忆去重、MCP 集成 | 个人化 Agent、聊天记忆 |
| **[Zep / Graphiti](https://github.com/getzep/graphiti)** | ~24K ⭐ | 时序知识图谱 (Neo4j) | 实时图构建、时序事实追踪、实体自动抽取 | 需要追踪事实变化的 Agent |
| **[Letta (MemGPT)](https://github.com/cpacker/MemGPT)** | ~21K ⭐ | OS 风格分层存储 (core/archival/recall) | 上下文窗口管理、函数调用读写记忆 | 长对话、多会话 Agent |
| **[Cognee](https://github.com/topoteretes/cognee)** | ~12K ⭐ | Poly-store (KG + Vector + Relational) | 本地优先、5 行代码接入、多图数据库后端 | 隐私敏感部署、GraphRAG |
| **[Hindsight](https://github.com/supermemoryai/hindsight)** | ~4K ⭐ (快速增长) | 多策略混合 | 双语义+图+关键词检索、可审计决策链 | 需要完整审计记录的企业 |

### 2.2 GraphRAG 框架

| 项目 | GitHub Stars | 架构 | 核心能力 |
|---|---|---|---|
| **[Microsoft GraphRAG](https://github.com/microsoft/graphrag)** | ~25K ⭐ | LLM 驱动的图构建 + 社区检测 | 自动从非结构化文本构建 KG、全局/局部检索、社区摘要 |
| **[LightRAG](https://github.com/hkuds/lightrag)** | ~15K ⭐ | KG + 双层向量检索 | 低层/高层双级检索、增量更新、Web UI |
| **[nano-graphrag](https://github.com/gusye1234/nano-graphrag)** | ~3K ⭐ | 精简版 GraphRAG | 极简代码、易于定制、保留核心功能 |
| **[Awesome-GraphRAG](https://github.com/DEEP-PolyU/Awesome-GraphRAG)** | - | 综述仓库 | 收集 GraphRAG 相关论文、项目、教程 |

### 2.3 知识图谱数据库

| 数据库 | 类型 | Agent 集成方式 |
|---|---|---|
| **Neo4j** | 属性图 (Cypher) | LangChain/LangGraph 原生集成、MCP Server、Graphiti 后端 |
| **FalkorDB** | 属性图 (Redis 兼容) | Mem0 Graph Memory 后端、低延迟 |
| **Memgraph** | 内存图数据库 | Cognee 后端、LlamaIndex 集成 |
| **NebulaGraph** | 分布式图数据库 | LlamaIndex PropertyGraphIndex 后端 |

---

## 三、核心论文（8 篇）

### 3.1 Graph-based Agent Memory: Taxonomy, Techniques, and Applications
- **作者**: 多位（DEEP-PolyU 团队）
- **年份**: 2026 (arXiv: 2602.05665)
- **核心贡献**: 提出图结构 Agent 记忆的三轴分类法（结构/检索/演化），系统梳理 KG、时序图、超图在 Agent 记忆中的应用。2025-2026 最全面的综述。
- **链接**: https://arxiv.org/abs/2602.05665

### 3.2 Zep: A Temporal Knowledge Graph Architecture for Agent Memory
- **作者**: Zep AI 团队
- **年份**: 2025 (arXiv: 2501.13956)
- **核心贡献**: 提出时序知识图谱架构，LongMemEval 基准上达到 63.8%（vs Mem0 49.0%），证明时序图在事实变化追踪上的优势。
- **链接**: https://arxiv.org/abs/2501.13956

### 3.3 MemGPT: Towards LLMs as Operating Systems
- **作者**: Charles Packer et al. (UC Berkeley)
- **年份**: 2024 (arXiv: 2310.08560)
- **核心贡献**: 借鉴 OS 虚拟内存思想，让 LLM 通过函数调用管理分层存储（core/archival/recall），突破上下文窗口限制。
- **链接**: https://arxiv.org/abs/2310.08560

### 3.4 GraphRAG: Unlocking LLM Discovery on Narrative Private Data
- **作者**: Microsoft Research
- **年份**: 2024
- **核心贡献**: 首个将 LLM 驱动的知识图谱构建与社区检测结合用于 RAG 的系统，支持全局/局部两种检索模式。
- **链接**: https://www.microsoft.com/en-us/research/project/graphrag/

### 3.5 LightRAG: Simple and Fast Retrieval-Augmented Generation
- **作者**: HKU 团队
- **年份**: 2024 (arXiv: 2410.05779, EMNLP 2025 Findings)
- **核心贡献**: 提出双层检索（低层实体 + 高层主题），比 Microsoft GraphRAG 更轻量，支持增量更新。
- **链接**: https://arxiv.org/abs/2410.05779

### 3.6 MemVerse: Multimodal Memory for Lifelong Learning Agents
- **作者**: 多位
- **年份**: 2025 (arXiv: 2512.03627)
- **核心贡献**: 将多模态经验（文本+图像+音频）转化为结构化长期记忆，使用超图结构。
- **链接**: https://arxiv.org/abs/2512.03627

### 3.7 KA-RAG: Integrating Knowledge Graphs and Agentic Retrieval-Augmented Generation
- **作者**: 多位
- **年份**: 2025 (MDPI Applied Sciences)
- **核心贡献**: 统一 Agentic-RAG 架构，将向量检索与 KG 推理在跨模块 Agent 中结合。
- **链接**: https://www.mdpi.com/2076-3417/15/23/12547

### 3.8 KARMA: Leveraging Multi-Agent LLMs for Automated Knowledge Graph Enrichment
- **作者**: 多位
- **年份**: 2025 (NeurIPS 2025)
- **核心贡献**: 多 Agent LLM 协作自动丰富知识图谱，通过结构化推理发现新关系。
- **链接**: https://neurips.cc/virtual/2025/poster/116417

---

## 四、与现有 Agent 框架的集成方式

### 4.1 LangChain / LangGraph

```
LangChain 生态集成点：
├── langchain-neo4j        → Neo4j KG 构建 + Cypher 查询
├── LangMem (LangGraph)    → 扁平 KV + 向量记忆
├── Graphiti (Zep)         → 时序 KG 集成
├── Cognee integration     → langgraph-cognee 包
└── Mem0 integration       → langchain-mem0 包
```

**关键路径**:
- `Neo4jGraph` → `LLMGraphTransformer` → 自动从文档构建 KG
- `GraphCypherQAChain` → 自然语言转 Cypher → 图查询
- LangGraph 节点中调用 Mem0/Cognee 作为记忆层

### 4.2 LlamaIndex

```
LlamaIndex KG 集成：
├── PropertyGraphIndex     → 属性图索引（支持 Neo4j/NebulaGraph）
├── KnowledgeGraphIndex    → 传统三元组 KG 索引
├── KG 提取器              → 从文档自动提取实体和关系
└── Workflows              → 事件驱动的多步 KG Agent 流程
```

**关键路径**: 文档 → `KGExtractor` → `PropertyGraphIndex` → `GraphRAGQueryEngine`

### 4.3 CrewAI

- Cognee 官方提供 CrewAI 集成：Agent 可在任务间共享 KG 记忆
- 适合多 Agent 任务协作中需要持久化知识的场景

### 4.4 MCP (Model Context Protocol)

- **Neo4j MCP Server**: Agent 通过 MCP 工具直接操作 Neo4j
- **Mem0 MCP Server**: Agent 通过 MCP 读写记忆
- 趋势：KG 数据库正通过 MCP 成为 Agent 的标准工具

### 4.5 OpenClaw 集成思路

OpenClaw 当前已使用 MemPalace 作为记忆层，包含：
- **KG 模块**: `mempalace_kg_add/query/invalidate/timeline` — 三元组知识图谱
- **图遍历**: `mempalace_traverse/follow_tunnels` — 跨 wing/room 连接发现
- **语义搜索**: `mempalace_search` — 基于向量的记忆检索

**可借鉴的升级方向**:
1. 引入时序三元组（如 Zep 的 valid_from/valid_to）
2. 增加实体自动抽取（从对话中自动构建 KG，而非手动 `kg_add`）
3. Graphiti 作为 MemPalace 的图数据库后端选项

---

## 五、工程落地关键点

### 5.1 架构选型决策树

```
你的 Agent 需要什么？
│
├── 只是聊天个性化（记住用户偏好）→ Mem0 / Letta
│
├── 追踪事实变化（合同、权限、状态迁移）→ Zep/Graphiti（时序 KG）
│
├── 从大量文档中做知识问答 → Microsoft GraphRAG / LightRAG
│
├── 隐私敏感 / 本地部署 → Cognee (local-first)
│
└── 多 Agent 协作共享知识 → Neo4j + 自定义共享图谱
```

### 5.2 KG 构建流水线（推荐架构）

```
原始数据（文档/对话/API）
    │
    ▼
┌─────────────┐
│ 实体抽取层    │ ← LLM (GPT-4o / Claude) + NER
│ (Entity ETL) │
└──────┬──────┘
       │ 三元组 (head, relation, tail, time)
       ▼
┌─────────────┐
│ 实体消歧层    │ ← 嵌入相似度 + 规则
│ (Dedup)      │
└──────┬──────┘
       │ 合并后的实体/关系
       ▼
┌─────────────┐
│ 图数据库      │ ← Neo4j / FalkorDB / Memgraph
│ (Storage)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 检索层       │ ← Cypher查询 + 向量搜索 + 社区检测
│ (Retrieval)  │
└──────┬──────┘
       │
       ▼
   Agent 上下文
```

### 5.3 工程关键点清单

| 维度 | 关键点 |
|---|---|
| **实体抽取质量** | LLM 抽取三元组的精度直接影响图质量。建议使用强模型（GPT-4o/Claude）做抽取，弱模型做查询 |
| **实体消歧** | "高瑞林" vs "瑞林" vs "Gao Ruilin" — 必须有消歧策略，否则图膨胀无意义 |
| **时序管理** | 每个三元组应有 valid_from/valid_to，事实过期自动标记，而非删除 |
| **图规模控制** | 单个 Agent 的图不宜超过百万节点。定期清理过期三元组 |
| **增量更新** | 避免全量重建图。LightRAG 支持增量更新，Graphiti 实时追加 |
| **检索策略** | 单一 Cypher 查询不够。建议：向量检索 + 图遍历 + 关键词索引三路并行 |
| **成本控制** | KG 构建阶段的 LLM 调用成本很高。批量处理、缓存抽取结果 |
| **监控与可观测** | 跟踪图增长、检索延迟、抽取准确率。Cognee 提供可视化 UI |

### 5.4 与 MemPalace 的对比与借鉴

| 维度 | MemPalace (OpenClaw 现有) | 行业最佳实践 |
|---|---|---|
| 图结构 | Wing→Room→Drawer 三层 + Tunnel 连接 + KG 三元组 | 实体-关系-实体三元组 + 属性图 |
| 时序支持 | KG 有 valid_from，无 valid_to 自动过期 | Zep: valid_from + valid_to + 自动合并 |
| 实体抽取 | 手动 `kg_add` | LLM 自动从对话/文档中抽取 |
| 检索方式 | 语义搜索 + KG 查询 | 向量 + 图遍历 + 关键词三路检索 |
| 多模态 | 支持（AAAK 格式） | MemVerse 支持图像+音频+文本 |
| 可视化 | 无 | Cognee 有 Web UI |

---

## 六、趋势判断

1. **图结构成为 Agent 记忆的标配**: 2026 年，纯向量记忆方案正在被淘汰，时序知识图谱成为 Agent 记忆的主流架构（arXiv: 2602.05665 综述明确指出）。

2. **MCP 协议加速 KG 工具化**: Neo4j、Mem0 等 KG 数据库通过 MCP Server 成为 Agent 的标准工具，降低了集成门槛。

3. **GraphRAG 从论文走向生产**: Microsoft GraphRAG 25K+ stars，LightRAG 15K+ stars，GraphRAG 已从概念验证进入工程化阶段。

4. **多 Agent 共享 KG 是下一个战场**: Neo4j NODES 2025 专门讨论"Multi-Agent Shared Graph Memory"，KARMA (NeurIPS 2025) 探索多 Agent 协作构建 KG。

5. **时序能力成为关键差异化**: Zep 在 LongMemEval 上领先 Mem0 15 个百分点，证明时序图在事实变化追踪上的结构性优势。

---

## 七、参考资源

### GitHub Awesome 列表
- [Awesome-GraphRAG](https://github.com/DEEP-PolyU/Awesome-GraphRAG) — GraphRAG 论文和项目汇总
- [Awesome-GraphMemory](https://github.com/DEEP-PolyU/Awesome-GraphMemory) — 图结构 Agent 记忆论文汇总
- [awesome-agent-memory](https://github.com/cxxz/awesome-agent-memory) — Agent 记忆框架汇总
- [Awesome-RAG-Reasoning](https://github.com/DavidZWZ/Awesome-RAG-Reasoning) — RAG 推理论文汇总

### 对比文章
- [Best AI Agent Memory Frameworks 2026 (Atlan)](https://atlan.com/know/best-ai-agent-memory-frameworks-2026/) — 8 大框架深度对比
- [Best AI Agent Memory Systems 2026 (Vectorize)](https://vectorize.io/articles/best-ai-agent-memory-systems) — 含 LongMemEval 基准数据

---

*调研完毕。写入 `/root/.openclaw/workspace/kg-research-F.md`*
