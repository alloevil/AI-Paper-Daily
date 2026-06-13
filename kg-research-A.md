# 调研方向 A：KG + LLM（知识图谱 + 大语言模型）

> 调研时间：2026-04-16 | 覆盖范围：2024–2026 | 偏工程视角

---

## 一、技术全景

### 1. GraphRAG：基于知识图谱的 RAG

GraphRAG 是 2024 年最热的 KG+LLM 方向，核心思路是：**用 LLM 从非结构化文本中抽取实体和关系，构建知识图谱，再基于图谱做检索增强生成**。

**技术栈分层：**

| 层级 | 技术选项 |
|------|----------|
| 图谱构建 | LLM 抽取（GPT-4/Claude/Qwen）→ 实体/关系 → Neo4j / NetworkX / NanoVectorDB |
| 社区检测 | Leiden 算法 → 层级社区 → 社区摘要 |
| 检索策略 | Local Search（实体相关子图）/ Global Search（社区摘要聚合）/ Path-based（关系路径） |
| 向量存储 | NanoVectorDB / Qdrant / ChromaDB / FAISS |
| 图数据库 | Neo4j / NebulaGraph / MemGraph / AGE (PostgreSQL) |

**关键变体对比（2024–2025）：**

| 方法 | 核心特点 | 优势 | 劣势 |
|------|----------|------|------|
| **Microsoft GraphRAG** | Leiden 社区检测 + 层级摘要 | 全局综合能力强，适合 sensemaking | 索引成本高（大量 LLM 调用） |
| **LightRAG** | 双级检索（低级实体+高级主题）+ 增量更新 | 轻量、支持增量、成本低 | 社区层级不如 MS GraphRAG |
| **HippoRAG / HippoRAG 2** | 仿海马体记忆机制，KG + 密集段落关联图 | 单次检索、跨文档推理强 | 需要预构建 KG |
| **PathRAG** | 关系路径检索 + 剪枝 | 降低噪声，6 个 benchmark 上 SOTA | 较新，工程化程度待验证 |
| **KAG**（蚂蚁） | 逻辑形式引导推理 + OpenSPG 引擎 | 专业领域 QA 强，schema 驱动 | 生态主要在中文社区 |

### 2. KG-augmented QA：基于知识图谱的问答

**技术路线：**

```
用户问题 → 意图识别 → KG 子图检索 → LLM 推理 → 答案
               ↓
        (可选) Cypher/SPARQL 生成 → 图数据库查询
```

**主流方案：**

- **Text-to-Cypher**：LangChain GraphCypherQAChain + Neo4j，LLM 将自然语言翻译为 Cypher 查询
- **子图检索 + CoT**：先从 KG 中检索相关子图，再用 Chain-of-Thought 引导 LLM 推理
- **KG-extended RAG**：KG 提供结构化事实 + 向量检索提供非结构化上下文，双路融合
- **Multi-Agent KG QA**：如 MAKES-QA 框架，多个 Agent 协作完成 KG 查询和推理

### 3. LLM for KG Construction：用 LLM 自动构建知识图谱

**三阶段流程：**

```
原始文本 → [实体抽取] → [关系抽取] → [三元组规范化/去重] → KG
             ↑              ↑
         NER/EL         RE / OpenIE
```

**关键技术：**

| 技术 | 说明 | 代表工具 |
|------|------|----------|
| **Schema-guided Extraction** | 预定义实体类型和关系类型，LLM 按 schema 抽取 | OneKE (WWWW 2025), KAG |
| **Open IE** | 不预设 schema，自由抽取三元组 | GPT-4 function calling, LlamaIndex KG Extractor |
| **Incremental KG Construction** | 增量构建，支持文档追加时更新图谱 | LightRAG, GraphRAG |
| **Ontology-guided Extraction** | 用本体指导 LLM 抽取，保证一致性 | Text2KGBench |

**工程实践要点：**
- **Chunk size 很关键**：太小丢上下文，太大 LLM 抽取不准，经验值 500–1500 tokens
- **Entity Resolution 难**：同实体多名称（"Google" vs "Alphabet" vs "谷歌"），需要后处理归一化
- **关系标准化**：LLM 抽出的关系标签多样，需要映射到标准 schema
- **质量控制**：需要人工抽检 + 自动校验（三元组完整性、一致性）

### 4. 主流框架生态

| 框架 | 定位 | KG 相关能力 |
|------|------|-------------|
| **LangChain** | LLM 编排框架 | `Neo4jGraph`, `GraphCypherQAChain`, `LLMGraphTransformer`, KG QA Chain |
| **LlamaIndex** | 数据索引框架 | `KnowledgeGraphIndex`, `PropertyGraphIndex`, KG extractors, Neo4j/MemGraph/FalkorDB 集成 |
| **Neo4j** | 图数据库 | `llm-graph-builder`（UI 工具）, GenAI integrations, GraphRAG-SDK, Vector + Graph 混合检索 |
| **MemGraph** | 内存图数据库 | LangChain + LlamaIndex 集成，改进 KG 创建流程 |
| **NebulaGraph** | 分布式图数据库 | 大规模 KG 存储，GraphRAG 后端 |
| **FalkorDB** | Redis 生态图数据库 | LlamaIndex 集成，低延迟 KG 查询 |

---

## 二、重点项目/框架列表

| 项目 | GitHub Stars | 核心能力 | 适用场景 | 链接 |
|------|-------------|----------|----------|------|
| **Microsoft GraphRAG** | ~23k+ | 文本→KG→社区摘要→Local/Global Search | 企业文档理解、sensemaking | [github.com/microsoft/graphrag](https://github.com/microsoft/graphrag) |
| **LightRAG** | ~30k+ | 双级检索、增量更新、多后端存储 | 轻量级 GraphRAG、快速原型 | [github.com/HKUDS/LightRAG](https://github.com/HKUDS/LightRAG) |
| **HippoRAG 2** | ~1.5k+ | 仿海马体记忆、单次检索跨文档推理 | 多跳 QA、知识整合 | [github.com/osu-nlp-group/hipporag](https://github.com/osu-nlp-group/hipporag) |
| **KAG** (蚂蚁/OpenSPG) | ~7k+ | 逻辑形式推理、schema 驱动、OpenSPG 引擎 | 专业领域 QA（法律/医疗/金融） | [github.com/OpenSPG/KAG](https://github.com/OpenSPG/KAG) |
| **OneKE** (浙大) | ~1k+ | Schema-guided 知识抽取、多源适配 | KG 自动构建、信息抽取 | [github.com/zjunlp/OneKE](https://github.com/zjunlp/OneKE) |
| **Neo4j llm-graph-builder** | ~3k+ | UI 可视化、多 LLM 支持、并行抽取 | 快速构建 Neo4j KG | [github.com/neo4j-labs/llm-graph-builder](https://github.com/neo4j-labs/llm-graph-builder) |
| **LangChain Neo4j 集成** | (LangChain 主仓) | `LLMGraphTransformer`, `GraphCypherQAChain` | KG 构建 + QA 一体化 | [docs.langchain.com](https://docs.langchain.com/oss/python/integrations/providers/neo4j) |
| **LlamaIndex KG** | (LlamaIndex 主仓) | `PropertyGraphIndex`, KG extractors, 多图库集成 | 多数据源索引 + KG RAG | [docs.llamaindex.ai](https://docs.llamaindex.ai/) |
| **Awesome-GraphRAG** | 收藏列表 | 汇总 GraphRAG 论文、工具、教程 | 调研入口 | [github.com/DEEP-PolyU/Awesome-GraphRAG](https://github.com/DEEP-PolyU/Awesome-GraphRAG) |
| **LLM-KG-Papers** | 收藏列表 | KG+LLM 论文合集 | 调研入口 | [github.com/zjukg/kg-llm-papers](https://github.com/zjukg/kg-llm-papers) |

---

## 三、核心论文（7 篇）

### 1. From Local to Global: A Graph RAG Approach to Query-Focused Summarization
- **作者**: Darren Edge, Ha Trinh, et al. (Microsoft Research)
- **年份**: 2024
- **核心贡献**: 提出 GraphRAG 范式——用 LLM 从文本中构建 KG，Leiden 社区检测生成层级摘要，支持 Local Search（实体子图）和 Global Search（社区聚合）两种查询模式。在 sensemaking 类问题上显著优于 naive RAG。
- **链接**: [arXiv:2404.16130](https://arxiv.org/abs/2404.16130)

### 2. LightRAG: Simple and Fast Retrieval-Augmented Generation
- **作者**: Zirui Guo, et al. (HKU)
- **年份**: 2024
- **核心贡献**: 提出双级检索系统（低级实体+高级主题关键词），结合 KG 与向量检索。相比 MS GraphRAG 更轻量，支持增量文档更新，索引成本降低数倍。
- **链接**: [arXiv:2410.05779](https://arxiv.org/abs/2410.05779) | GitHub 30k+ stars

### 3. HippoRAG: Neurobiologically Inspired Long-Term Memory for Large Language Models
- **作者**: Bernal Jiménez Gutiérrez, et al. (OSU)
- **年份**: 2024 (NeurIPS'24)
- **核心贡献**: 仿海马体记忆理论，用 KG 作为人工记忆的 "索引骨架"，通过 Personalized PageRank 实现单次检索完成跨文档推理，成本远低于多步 RAG。
- **链接**: [arXiv:2405.14831](https://arxiv.org/abs/2405.14831)

### 4. HippoRAG 2: From RAG to Memory — Non-Parametric Continual Learning for LLMs
- **作者**: OSU NLP Group
- **年份**: 2025 (ICML'25)
- **核心贡献**: HippoRAG 升级版，解决 RAG 知识干扰退化问题，在 factual/sense-making/multi-hop 三类任务上全面超越标准 RAG。
- **链接**: [arXiv:2502.14802](https://arxiv.org/abs/2502.14802)

### 5. PathRAG: Pruning Graph-based RAG with Relational Paths
- **作者**: (多个机构合作)
- **年份**: 2025 (AAAI'25)
- **核心贡献**: 从索引图中检索关键关系路径而非全子图，通过剪枝降低噪声，在 6 个数据集、5 个评估维度上持续优于 SOTA baseline。
- **链接**: [arXiv:2502.14902](https://arxiv.org/abs/2502.14902)

### 6. KAG: Boosting LLMs in Professional Domains via Knowledge Augmented Generation
- **作者**: 蚂蚁集团/OpenSPG 团队
- **年份**: 2024
- **核心贡献**: 提出知识增强生成（KAG）框架，基于 OpenSPG 引擎，通过逻辑形式引导推理，解决 RAG 在专业领域（法律/医疗）的知识准确性和推理深度问题。
- **链接**: [arXiv:2409.13731](https://arxiv.org/abs/2409.13731)

### 7. LLM-empowered Knowledge Graph Construction: A Survey
- **作者**: (综述)
- **年份**: 2025
- **核心贡献**: 全面综述 LLM 在 KG 构建中的应用，涵盖实体抽取、关系抽取、三元组抽取、本体学习等，梳理 progressive triple extraction + semantic grouping 等新范式。
- **链接**: [arXiv:2510.20345](https://arxiv.org/html/2510.20345v1)

---

## 四、Benchmark 和评测

| Benchmark | 类型 | 说明 |
|-----------|------|------|
| **LLM-KG-Bench** | KG 工程能力 | 自动评估 LLM 在 RDF/KG 相关任务上的表现（RDF 生成、SPARQL、ShEx 验证等） |
| **KG-LLM-Bench** | KG 推理 | 5 个任务评估 LLM 的 in-context KG 理解能力 |
| **Text2KGBench** | KG 构建质量 | 评估 ontology 驱动的文本→KG 生成质量 |
| **Mintaka** | KGQA | 多语言多跳 KGQA benchmark |
| **WikiHop** | 多跳推理 | 跨文档多跳推理 QA |
| **HotpotQA** | 多跳 QA | 需要跨段落推理的 QA benchmark |
| **SynthKGQA** | KGQA 评测生成 | LLM 驱动生成高质量 KGQA 评测数据 |
| **BuildingQA** | 领域 KGQA | 建筑领域 KG 上的自然语言 QA benchmark |

---

## 五、工程落地关键点

### 选型建议

```
需求场景                    推荐方案
─────────────────────────────────────────────
企业文档全局理解/sensemaking  → MS GraphRAG（重但全面）
轻量级原型/快速验证           → LightRAG（30k stars，上手快）
专业领域 QA（法律/医疗）      → KAG + OpenSPG（schema 驱动）
已有 Neo4j 基础设施           → Neo4j llm-graph-builder + LangChain
多跳推理/跨文档 QA            → HippoRAG 2（成本最优）
从零构建 KG                   → OneKE 或 LlamaIndex PropertyGraphIndex
大规模分布式 KG                → NebulaGraph + 自研 pipeline
```

### 坑点总结

1. **索引成本爆炸**：MS GraphRAG 的索引阶段需要大量 LLM API 调用，100 万 token 的文档集可能需要数百美元索引成本。**建议**：先用小数据集验证，或用开源模型（Qwen/DeepSeek）做索引。

2. **Entity Resolution 是硬伤**：LLM 抽出的同实体多名称问题严重（如"国务院"="中央政府"="国家行政机关"）。**建议**：后处理阶段做实体链接/合并，或用 schema-guided 方案约束。

3. **KG 质量 > KG 规模**：低质量的 KG（噪声关系、重复实体）会严重拖累 RAG 效果。**建议**：宁可小而精，不要大而糙。定期人工抽检。

4. **图数据库选型**：
   - 数据量 < 100 万节点 → Neo4j Community（免费）或 NetworkX（纯 Python）
   - 数据量 > 1000 万节点 → NebulaGraph（分布式）或 Neo4j Enterprise
   - 需要低延迟 → MemGraph（内存）或 FalkorDB

5. **Chunk size 调优**：LLM 抽取 KG 的效果对 chunk size 敏感。经验值：
   - 英文文本：1000–1500 tokens
   - 中文文本：500–800 tokens
   - 技术文档：可适当增大到 2000 tokens

6. **开源模型 vs 闭源模型**：
   - 索引/抽取阶段（量大、质量要求中等）：用 Qwen2.5/DeepSeek-V3 等开源模型，成本低 10–50x
   - 查询/生成阶段（质量关键）：用 GPT-4o/Claude 等闭源模型

7. **增量更新**：MS GraphRAG 的初始版本不支持增量，需要全量重建。LightRAG 支持增量。**建议**：文档频繁更新的场景优先选 LightRAG 或自研增量 pipeline。

8. **评测不能只看 LLM-as-Judge**：GraphRAG 的评测依赖 LLM 评判，存在偏向性。建议结合人工评测 + 下游任务指标（QA 准确率、召回率）。

### 快速验证路线图

```
Phase 1: 原型（1–2 周）
  ├── 选 LightRAG 或 LlamaIndex PropertyGraphIndex
  ├── 用小数据集（100–500 篇文档）验证 pipeline
  ├── 评估 KG 质量 + QA 效果
  └── 确定 chunk size、抽取 prompt

Phase 2: 生产化（2–4 周）
  ├── 切换到 Neo4j/NebulaGraph 存储
  ├── 索引阶段用开源模型降成本
  ├── 加入 Entity Resolution 后处理
  ├── 实现增量更新机制
  └── 建立自动评测 pipeline

Phase 3: 优化（持续）
  ├── Schema 优化（领域本体设计）
  ├── 多模态扩展（图表、PDF）
  ├── 缓存和预计算
  └── 用户反馈闭环
```

---

## 六、推荐阅读

- [Awesome-GraphRAG](https://github.com/DEEP-PolyU/Awesome-GraphRAG) — GraphRAG 全景资源库
- [KG-LLM-Papers](https://github.com/zjukg/kg-llm-papers) — KG+LLM 论文合集
- [Microsoft GraphRAG 官方文档](https://microsoft.github.io/graphrag/) — 架构和 API 文档
- [LLM-empowered KG Construction Survey](https://arxiv.org/html/2510.20345v1) — KG 构建综述
