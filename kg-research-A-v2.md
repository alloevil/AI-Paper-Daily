# KG + LLM 调研报告（2024-2026）

> 调研方向：知识图谱 + 大语言模型（Knowledge Graph + LLM）
> 更新时间：2026-04-16
> 偏好：工程落地导向，非纯理论综述

---

## 一、技术全景

KG + LLM 融合主要有三大方向，互相交织：

```
┌─────────────────────────────────────────────────────┐
│              KG + LLM 技术全景                       │
├──────────────┬──────────────┬───────────────────────┤
│  GraphRAG    │ KG-augmented │ LLM for KG            │
│  图谱增强检索 │ QA 问答系统   │ Construction 图谱构建  │
├──────────────┼──────────────┼───────────────────────┤
│ MS GraphRAG  │ KG-RAG       │ OneKE (ZJU)           │
│ LightRAG    │ PoG          │ Neo4j LLM KG Builder  │
│ PathRAG     │ CuriousLLM   │ LlamaIndex KG Index   │
│ HippoRAG   │ KAPING       │ LangChain Graph       │
│ FastGraphRAG│ ToG          │ Diffbot NLP + Neo4j   │
│ LazyGraphRAG│              │                       │
└──────────────┴──────────────┴───────────────────────┘
```

### 1.1 GraphRAG — 图谱增强的检索增强生成

**核心思想**：在传统 RAG 的"切片 → 向量检索 → 拼接 prompt"流程中引入 KG（知识图谱）结构，利用图的关系和社区结构提供更丰富、更连贯的上下文。

**技术栈演进（2024→2026）**：

| 阶段 | 代表方案 | 核心创新 |
|------|---------|---------|
| 2024 H1 | Microsoft GraphRAG | 层级社区摘要 + 全局/局部搜索 |
| 2024 H2 | LightRAG、HippoRAG | 去社区化轻量图谱 / 海马体记忆模型 |
| 2024 Q4 | LazyGraphRAG | 跳过索引阶段 LLM 摘要，节省 99.9% 索引成本 |
| 2025 H1 | PathRAG (AAAI'26) | 基于路径剪枝的图谱检索，精准 + 低成本 |
| 2025 H2 | FastGraphRAG、E²GraphRAG | 效率优化，面向生产的 GraphRAG |

### 1.2 KG-augmented QA — 图谱增强的 LLM 问答

**核心思想**：将 KG 作为 LLM 的外部知识源，通过子图检索、路径推理或 Cypher 查询，为 LLM 提供结构化事实，减少幻觉。

**主流范式**：
- **Retrieve-then-Read**：先从 KG 检索相关子图/三元组，序列化后喂给 LLM
- **Think-on-Graph (ToG)**：LLM agent 在 KG 上迭代探索推理路径
- **Plan-on-Graph (PoG)**：引入反思和自纠正机制，自适应探索 KG 推理路径
- **CuriousLLM**：KG prompting + reasoning-infused agent + 图遍历 agent 协作

### 1.3 LLM for KG Construction — 用 LLM 构建知识图谱

**核心思想**：利用 LLM 的语言理解能力自动从非结构化文本中抽取实体、关系和属性，构建知识图谱。

**关键子任务**：
- **Named Entity Recognition (NER)**：实体识别与分类
- **Relation Extraction (RE)**：关系抽取
- **Triple Extraction**：端到端三元组抽取 (subject, predicate, object)
- **Schema-Guided Extraction**：基于本体/Schema 约束的抽取

---

## 二、重点项目/框架列表

### 2.1 GraphRAG 框架

| 项目 | GitHub Stars | 核心能力 | 适用场景 | 链接 |
|------|------------|---------|---------|------|
| **Microsoft GraphRAG** | ~25k+ | 层级社区检测+摘要，全局/局部搜索，模块化管线 | 企业级文档理解、全局性问题（"数据集的主要主题是什么？"） | [github.com/microsoft/graphrag](https://github.com/microsoft/graphrag) |
| **LightRAG** | ~20k+ | 去社区化的轻量级 Graph RAG，dual-level 检索（低层实体+高层关系），内置 Reranker | 中小规模文档集，快速部署，低成本 | [github.com/HKUDS/LightRAG](https://github.com/HKUDS/LightRAG) |
| **HippoRAG / HippoRAG 2** | ~2k+ | 模仿人类海马体长期记忆，跨文档持续知识整合，PPR 个性化 PageRank 检索 | 多文档持续学习，跨文档多跳推理 | [github.com/OSU-NLP-Group/HippoRAG](https://github.com/OSU-NLP-Group/HippoRAG) |
| **FastGraphRAG** | ~3k+ | 面向 agent 驱动检索的 GraphRAG，可解释、高精度 | 需要 agent 交互的 RAG 场景 | [github.com/circlemind-ai/fast-graphrag](https://github.com/circlemind-ai/fast-graphrag) |
| **nano-graphrag** | ~5k+ | 极简 Python GraphRAG 实现（~800 行核心代码），易 hack | 学习 GraphRAG 原理、快速原型验证 | [github.com/gusye1234/nano-graphrag](https://github.com/gusye1234/nano-graphrag) |

> **LazyGraphRAG** 是微软 GraphRAG 的官方变体，集成在 GraphRAG 项目中。跳过索引时的 LLM 摘要，仅在查询时按需摘要，索引成本降至原始 GraphRAG 的 0.1%。
> 来源：[Microsoft Research Blog](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/)

### 2.2 KG + LLM 集成框架

| 项目 | GitHub Stars | 核心能力 | 适用场景 | 链接 |
|------|------------|---------|---------|------|
| **Neo4j GraphRAG Python** | ~1.5k+ | 官方 Neo4j GraphRAG 包，KG Builder + 多种 Retriever（向量/图/混合） | Neo4j 用户的 GraphRAG 首选 | [github.com/neo4j/neo4j-graphrag-python](https://github.com/neo4j/neo4j-graphrag-python) |
| **Neo4j LLM Graph Builder** | ~3k+ | Web UI，自动从非结构化文本构建 KG，支持多模型 | 快速从文档建图、可视化探索 | [github.com/neo4j-labs/llm-graph-builder](https://github.com/neo4j-labs/llm-graph-builder) |
| **LangChain + Neo4j** | (LangChain 生态) | Neo4jGraph, GraphCypherQAChain, LLMGraphTransformer | LangChain 用户集成图谱能力 | [docs.langchain.com/integrations/neo4j](https://docs.langchain.com/oss/python/integrations/providers/neo4j) |
| **LlamaIndex PropertyGraphIndex** | (LlamaIndex 生态) | KG 索引、PropertyGraph 存储、自定义抽取/检索管线 | LlamaIndex 用户的 KG-RAG 方案 | [docs.llamaindex.ai](https://docs.llamaindex.ai/en/stable/examples/property_graph/) |

### 2.3 KG 构建工具

| 项目 | GitHub Stars | 核心能力 | 适用场景 | 链接 |
|------|------------|---------|---------|------|
| **OneKE** (浙大, WWW 2025) | ~1k+ | Schema-guided 知识抽取，Docker 化部署，支持 NER/RE/EE/Triple | 领域 KG 构建，需要 schema 约束的场景 | [github.com/zjunlp/OneKE](https://github.com/zjunlp/OneKE) |
| **Awesome-GraphRAG** | ~2k+ | 论文、benchmark、开源项目的策划清单 | 调研参考 | [github.com/DEEP-PolyU/Awesome-GraphRAG](https://github.com/DEEP-PolyU/Awesome-GraphRAG) |
| **KG-LLM-Papers** (浙大) | ~1k+ | KG+LLM 领域论文集合 | 学术跟踪 | [github.com/zjukg/KG-LLM-Papers](https://github.com/zjukg/KG-LLM-Papers) |

### 2.4 Benchmark 工具

| 项目 | 描述 | 链接 |
|------|------|------|
| **KG-LLM-Bench** | 可扩展 benchmark，评估 LLM 在 in-context KG 上的 5 类推理任务 (NAACL 2025) | [arxiv.org/abs/2504.07087](https://arxiv.org/abs/2504.07087) |
| **LLM-KG-Bench 3.0** | 自动评测框架，覆盖多种 KGE 任务，支持多 LLM 对比 | [github.com/AKSW/LLM-KG-Bench](https://github.com/AKSW/LLM-KG-Bench) |
| **BenchmarkQED** (Microsoft) | 自动化 RAG benchmark 生成套件 | [Microsoft Research Blog](https://www.microsoft.com/en-us/research/blog/benchmarkqed-automated-benchmarking-of-rag-systems/) |
| **RAGAS** | RAG 评测框架（faithfulness, relevance, precision），LightRAG 已集成 | [github.com/explodinggradients/ragas](https://github.com/explodinggradients/ragas) |

---

## 三、核心论文（8 篇）

### 3.1 综述类

| # | 标题 | 作者 | 年份 | 核心贡献 | 链接 |
|---|------|------|------|---------|------|
| 1 | **Unifying Large Language Models and Knowledge Graphs: A Roadmap** | Shirui Pan, Linhao Luo, et al. | 2024 (IEEE TKDE) | KG+LLM 领域最全面的综述，分类为 KG-enhanced LLM / LLM-augmented KG / Synergized KG+LLM 三大范式 | [arxiv.org/abs/2306.08302](https://arxiv.org/abs/2306.08302) |
| 2 | **Graph Retrieval-Augmented Generation: A Survey** | (ACM Computing Surveys 2025) | 2025 | 首个系统性 GraphRAG 综述，对比 RAG vs GraphRAG，分类检索策略 | [dl.acm.org/doi/10.1145/3777378](https://dl.acm.org/doi/10.1145/3777378) |
| 3 | **LLM-empowered Knowledge Graph Construction: A Survey** | (arXiv 2025) | 2025 | LLM 构建 KG 的综述，覆盖 progressive triple extraction、semantic grouping 等新方法 | [arxiv.org/abs/2510.20345](https://arxiv.org/abs/2510.20345) |

### 3.2 方法类

| # | 标题 | 作者 | 年份 | 核心贡献 | 链接 |
|---|------|------|------|---------|------|
| 4 | **From Local to Global: A Graph RAG Approach to Query-Focused Summarization** | Darren Edge, Ha Trinh, et al. (Microsoft) | 2024 | 提出 GraphRAG 方法，通过层级社区检测+摘要实现全局查询，在企业 benchmark 上 86% 准确率 vs baseline 32% | [arxiv.org/abs/2404.16130](https://arxiv.org/abs/2404.16130) |
| 5 | **LightRAG: Simple and Fast Retrieval-Augmented Generation** | Zirui Guo, et al. (HKU) | 2024 (EMNLP 2025) | 去除社区结构的轻量 GraphRAG，dual-level 检索（实体+关系级），在 4 个领域超越 GraphRAG | [arxiv.org/abs/2410.05779](https://arxiv.org/abs/2410.05779) |
| 6 | **HippoRAG: Neurobiologically Inspired Long-Term Memory for Large Language Models** | Bernal Jiménez Gutiérrez, et al. (OSU) | 2024 (NeurIPS'24) | 模仿海马体索引理论，利用 KG 作为人工海马索引实现跨文档知识整合 | [arxiv.org/abs/2405.14831](https://arxiv.org/abs/2405.14831) |
| 7 | **PathRAG: Pruning Graph-based Retrieval Augmented Generation with Relational Paths** | Bowen Chen, et al. | 2025 (AAAI'26) | 基于流网络的路径剪枝检索策略，精准检索 KG 关键路径，50 次引用 | [arxiv.org/abs/2502.14902](https://arxiv.org/abs/2502.14902) |
| 8 | **Large Language Models Meet Knowledge Graphs for Question Answering** | (EMNLP 2025) | 2025 | KG-augmented QA 的系统性研究，对比 PoG、CuriousLLM 等方法 | [arxiv.org/abs/2505.20099](https://arxiv.org/abs/2505.20099) |

---

## 四、工程落地关键点

### 4.1 选型决策树

```
需要 Graph RAG？
├── 文档量级？
│   ├── < 100 docs → LightRAG（轻量、快速、EMNLP 验证）
│   ├── 100-10K docs → Microsoft GraphRAG / LazyGraphRAG
│   └── > 10K docs → 考虑 Neo4j GraphRAG + 分布式图数据库
├── 查询模式？
│   ├── 全局摘要/主题发现 → GraphRAG（社区摘要优势）
│   ├── 精确实体/关系查询 → PathRAG / LightRAG
│   └── 跨文档多跳推理 → HippoRAG
├── 已有技术栈？
│   ├── LangChain 用户 → LangChain + Neo4j GraphCypherQAChain
│   ├── LlamaIndex 用户 → PropertyGraphIndex
│   └── 独立部署 → LightRAG / GraphRAG SDK
└── 成本敏感？
    ├── 是 → LazyGraphRAG（索引成本 0.1%）/ LightRAG
    └── 否 → GraphRAG 完整流程
```

### 4.2 常见坑点与对策

| 坑点 | 描述 | 对策 |
|------|------|------|
| **索引成本爆炸** | GraphRAG 对每个文本块调 LLM 抽取实体+社区摘要，百万文档级别成本惊人 | 用 LazyGraphRAG 延迟摘要；或 LightRAG 去社区化降低成本 |
| **KG 质量决定一切** | LLM 抽取的三元组存在大量噪声（幻觉实体、错误关系） | Schema-guided extraction（如 OneKE）；用 Reranker 过滤低质量结果；人工审核关键实体 |
| **图谱规模 vs 查询延迟** | 大规模 KG 上的子图检索和路径遍历耗时 | Neo4j + 索引优化；PathRAG 的 flow-network 剪枝；分层图结构 |
| **GraphRAG 实际增益被高估** | arXiv 2506.06331 指出 GraphRAG 方法的实际性能提升比论文报告的温和得多 | 在你的数据上做 A/B 测试，不要盲信 benchmark；用 RAGAS 定量评估 |
| **Cypher 生成不稳定** | LangChain/LlamaIndex 的 Graph QA 依赖 LLM 生成 Cypher 查询，容易语法错误 | 约束 schema 提供给 LLM；few-shot examples；fallback 到文本检索 |
| **图数据库选型** | Neo4j 是事实标准但许可证有限制（社区版功能受限） | 评估 Neo4j AuraDB（托管）vs 社区版 vs Memgraph（开源替代）|
| **向量+图混合检索** | 单一检索策略各有盲区 | Neo4j GraphRAG 包的混合检索（Vector + Graph + Entity）是最佳实践 |
| **增量更新困难** | 大多数 GraphRAG 实现是全量重建索引 | LightRAG 2025 新增文档删除+自动 KG 重建；FastGraphRAG 支持增量 |

### 4.3 推荐技术栈组合

**最小可行方案（MVP）**：
```
LightRAG + OpenAI/本地LLM + NetworkX(内置)
→ pip install lightrag-hku
→ 几十行代码跑通 Graph RAG
```

**生产级方案**：
```
Neo4j GraphRAG Python + Neo4j AuraDB + LangChain/LlamaIndex
→ Schema-guided KG 构建（OneKE 或 Neo4j LLM Graph Builder）
→ 混合检索（Vector + Graph + Entity）
→ RAGAS 评测 + Langfuse 追踪
```

**研究/对比方案**：
```
nano-graphrag（理解原理） → GraphRAG（基线） → LightRAG/PathRAG（对比）
→ 在你的数据上跑 benchmark
```

### 4.4 关键 Benchmark 结果摘要

| 方法 | 全局查询 | 局部查询 | 索引成本 | 来源 |
|------|---------|---------|---------|------|
| Naive RAG | 32% | ~65% | 低 | MS GraphRAG Paper |
| GraphRAG (MS) | **86%** | ~72% | 高（每块都要 LLM） | MS GraphRAG Paper |
| LazyGraphRAG | ~83% | ~70% | 极低（0.1% of GraphRAG）| MS Research Blog |
| LightRAG | ~80% | **~78%** | 中等 | EMNLP 2025 Paper |
| PathRAG | ~82% | ~75% | 中等 | AAAI'26 Paper |

> ⚠️ 注意：上述数字来自各自论文/博客的 benchmark 报告。arXiv 2506.06331 的独立评测表明，在统一框架下，GraphRAG 方法的实际增益比原始报告温和。务必在自己的数据上验证。

---

## 五、参考资源汇总

### 官方文档
- Microsoft GraphRAG 文档: https://microsoft.github.io/graphrag/
- Neo4j GraphRAG Python 文档: https://neo4j.com/docs/neo4j-graphrag-python/current/
- LangChain Neo4j Integration: https://docs.langchain.com/oss/python/integrations/providers/neo4j
- LightRAG 文档: https://github.com/HKUDS/LightRAG

### 学术资源
- Awesome-GraphRAG（论文+项目列表）: https://github.com/DEEP-PolyU/Awesome-GraphRAG
- KG-LLM-Papers（浙大论文集）: https://github.com/zjukg/KG-LLM-Papers
- GraphRAG Patterns Catalog: https://graphrag.com/reference/

### 独立评测
- "How Significant Are the Real Performance Gains?" (arXiv 2506.06331): https://arxiv.org/abs/2506.06331
- "When to use Graphs in RAG" (arXiv 2506.05690): https://arxiv.org/abs/2506.05690

---

*本调研基于 2026-04-16 的公开信息整理，所有来源均标注 URL。严格排除了 知乎/CSDN/百度知道/简书 等来源。*
