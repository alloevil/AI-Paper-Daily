# 调研方向 B：图数据库技术对比与工程选型（2024-2026）

> 调研时间：2026-04-16 | 数据截止：2026 年 Q1  
> 来源标准：仅使用 GitHub、官方文档、LDBC 官方、高质量英文技术博客

---

## 一、主流图数据库对比总表

| 数据库 | 类型 | 查询语言 | 分布式支持 | 向量搜索 | License | 适用场景 | GitHub Stars |
|--------|------|----------|-----------|---------|---------|---------|-------------|
| **Neo4j** | 原生图数据库 | Cypher (+ GQL) | ✅ Infinigraph 水平扩展至 100TB+ | ✅ 原生向量索引 (2023+) | Community: GPLv3; Enterprise: 商业许可 | 知识图谱、GraphRAG、通用图查询、OLAP | ~16.3k ★ |
| **NebulaGraph** | 原生分布式图数据库 | nGQL (类 SQL) | ✅ 原生分布式，Shared-nothing | ✅ Enterprise v5.1+ 原生向量搜索 | Apache 2.0 (开源) | 大规模社交图谱、风控、推荐系统 | ~12.1k ★ |
| **TigerGraph** | 原生并行图数据库 | GSQL | ✅ 原生分布式并行 | ❌ 需外部集成 | 商业许可 (有免费 Developer) | 深度图分析、大规模实时分析、反欺诈 | ~0.3k ★ (ecosys) |
| **Amazon Neptune** | 托管图数据库 | Gremlin / SPARQL / openCypher | ✅ 多 AZ，自动故障转移 | ✅ Neptune ML (SageMaker) | 商业 (AWS 托管服务) | AWS 生态、OLTP 图查询、身份图谱 | N/A (闭源) |
| **JanusGraph** | 分布式图数据库 | Gremlin | ✅ 依赖后端 (Cassandra/HBase/ScyllaDB) | ❌ 需外部 Elasticsearch | Apache 2.0 | 大规模分布式图存储、灵活后端选择 | ~5.8k ★ |
| **ArangoDB** | 多模型数据库 | AQL | ✅ 集群模式 | ✅ 原生向量搜索 (ArangoSearch) | Apache 2.0 (开源) / Enterprise: 商业 | 多模型需求、文档+图混合场景 | ~14.1k ★ |
| **TuGraph** | 高性能图数据库 | Cypher / C++ Procedure | ✅ 分布式（蚂蚁 50 万核验证） | ❌ 暂无原生向量搜索 | Apache 2.0 | 金融风控、支付图谱、超大规模 OLTP | ~1.7k ★ |
| **HugeGraph** | 全栈图系统 | Gremlin | ✅ 水平扩展，分布式部署 | ❌ 计划中 | Apache 2.0 (TLP) | 数十亿顶点规模、OLTP+OLAP 混合 | ~3.5k ★ |

**来源**：
- Neo4j: [neo4j.com](https://neo4j.com), [GitHub](https://github.com/neo4j/neo4j)
- NebulaGraph: [nebula-graph.io](https://nebula-graph.io), [GitHub](https://github.com/vesoft-inc/nebula)
- TigerGraph: [tigergraph.com](https://www.tigergraph.com), [GitHub](https://github.com/tigergraph/ecosys)
- Amazon Neptune: [aws.amazon.com/neptune](https://aws.amazon.com/neptune/)
- JanusGraph: [janusgraph.org](https://janusgraph.org), [GitHub](https://github.com/JanusGraph/janusgraph)
- ArangoDB: [arangodb.com](https://www.arangodb.com), [GitHub](https://github.com/arangodb/arangodb)
- TuGraph: [tugraph.org](https://www.tugraph.org), [GitHub](https://github.com/tugraph-family/tugraph-db)
- HugeGraph: [hugegraph.apache.org](https://hugegraph.apache.org), [GitHub](https://github.com/apache/hugegraph)

---

## 二、查询语言对比

| 特性 | Cypher | Gremlin | nGQL | GSQL | AQL |
|------|--------|---------|------|------|-----|
| **代表数据库** | Neo4j, Memgraph, FalkorDB | JanusGraph, Neptune, Cosmos DB | NebulaGraph | TigerGraph | ArangoDB |
| **范式** | 声明式 | 命令式（遍历） | 声明式 (SQL-like) | 声明式 + 过程式 | 声明式 |
| **学习曲线** | ⭐⭐ 低（模式匹配直观） | ⭐⭐⭐ 中（API 风格） | ⭐⭐ 低（类 SQL） | ⭐⭐⭐ 中 | ⭐⭐ 低（类 SQL） |
| **标准化** | openCypher (ISO GQL 前身) | Apache TinkerPop 标准 | NebulaGraph 私有 | TigerGraph 私有 | ArangoDB 私有 |
| **多跳查询** | `MATCH (a)-[:KNOWS*1..3]->(b)` | `.outE('KNOWS').inV().repeat(...)` | `GO 1..3 STEPS OVER KNOWS` | 支持 ACCUM 遍历 | `FOR v IN 1..3 OUTBOUND...` |
| **社区生态** | 最广泛，LangChain/LlamaIndex 深度集成 | 广泛，多数据库兼容 | 主要在 NebulaGraph 生态 | TigerGraph 专属 | ArangoDB 专属 |

**关键判断**：
- **Cypher** 是当前 AI/LLM 集成的事实标准，LangChain、LlamaIndex、Microsoft GraphRAG 均原生支持。ISO GQL 标准（2024 年发布）以 Cypher 为基础，未来趋势明确。
- **Gremlin** 跨数据库兼容性最好，适合多数据库场景，但学习曲线略高。
- **nGQL** 在 NebulaGraph 生态内成熟，但锁定效应强。

**来源**：
- [DZone: Graph Query Language Comparison](https://dzone.com/articles/graph-query-language-comparison-gremlin-vs-cypher)
- [Neo4j: Why Database Query Language Matters](https://neo4j.com/blog/cypher-and-gql/why-database-query-language-matters/)
- [Cambridge Intelligence: Choosing a Graph Database](https://cambridge-intelligence.com/choosing-graph-database/)

---

## 三、性能 Benchmark（LDBC SNB）

### 3.1 LDBC SNB Interactive 审计结果

LDBC SNB (Social Network Benchmark) 是图数据库领域**最权威的标准化性能测试**，由 LDBC Council（Linked Data Benchmark Council）维护，结果经过独立审计。

| 排名 | 系统 | QPS (SF300) | 数据规模 | 审计日期 | 来源 |
|------|------|-------------|---------|---------|------|
| 🥇 | **GraphScope Flex** | ~127,000 QPS | SF1000 (29亿顶点, 2080亿边) | 2024-06 | [GraphScope Blog](https://graphscope.io/blog/tech/2024/06/27/GraphScope-refreshes-the-world-record-for-the-LDBC-benchmark) |
| 🥈 | AtlasGraph | ~49,000 QPS | SF300 | 2023-12 | [LDBC SNB Results](https://ldbcouncil.org/benchmarks/snb/) |
| 🥉 | TuGraph | ~20,000 QPS | SF100 | 2023-07 | [LDBC SNB Results](https://ldbcouncil.org/benchmarks/snb/) |

> **注意**：GraphScope Flex 是阿里巴巴达摩院研发的图计算系统（非独立图数据库），在 SF1000 数据集上刷新世界纪录，性能是第二名的 2.6 倍。TuGraph（蚂蚁集团）曾是 2023 年的记录保持者。

### 3.2 TigerGraph LDBC SNB BI Benchmark

TigerGraph 在 **LDBC SNB BI (Business Intelligence)** 工作负载上发布了 108TB 规模的 benchmark 报告，展示了其在大规模分析查询上的能力。

- 来源：[TigerGraph Benchmark](https://www.tigergraph.com/benchmark/)

### 3.3 Benchmark 注意事项

> ⚠️ **厂商 benchmark 需谨慎看待**。Cambridge Intelligence 总结得好：唯一有意义的 benchmark 是你自己用真实数据和真实查询跑出来的。LDBC SNB 是目前唯一经过独立审计的标准化基准。([来源](https://cambridge-intelligence.com/choosing-graph-database/))

---

## 四、部署与运维对比

| 维度 | Neo4j | NebulaGraph | TigerGraph | Amazon Neptune | JanusGraph | ArangoDB | TuGraph | HugeGraph |
|------|-------|-------------|------------|----------------|------------|----------|---------|-----------|
| **部署模式** | 单机 / 集群 / AuraDB 云 | 集群 (Docker/K8s) | 集群 / TigerGraph Cloud | 纯 AWS 托管 | 集群 (需自建后端) | 单机 / 集群 / ArangoDB Cloud | 单机 / 集群 | 单机 / 集群 |
| **高可用** | Causal Cluster 复制 | Raft 共识，多副本 | 多副本复制 | 多 AZ 自动故障转移 | 依赖后端 (Cassandra/HBase HA) | 集群同步复制 | Raft 共识 | 依赖后端存储 |
| **备份恢复** | 在线备份 / AuraDB 自动 | 企业版支持 | 内置备份工具 | 连续备份至 S3，PITR | 依赖后端 | 内置备份/恢复 | 内置工具 | 内置工具 |
| **监控** | Neo4j Ops Manager / Prometheus | Grafana + Prometheus | TigerGraph Admin Portal | CloudWatch | 依赖后端监控 | ArangoDB Metrics | Prometheus | Prometheus |
| **运维复杂度** | ⭐⭐ 中等 | ⭐⭐⭐ 较高 (多组件) | ⭐⭐ 中等 | ⭐ 极低 (全托管) | ⭐⭐⭐⭐ 高 (多层架构) | ⭐⭐ 中等 | ⭐⭐ 中等 | ⭐⭐⭐ 较高 |

### 关键运维要点

**Neo4j**：
- Infinigraph（2025 GA）支持水平扩展至 100TB+，原生分片
- AuraDB 云服务全球 30,000+ 数据库实例
- 来源：[Neo4j 2025 年度回顾](https://neo4j.com/blog/news/2025-ai-scalability/)

**NebulaGraph**：
- 原生分布式架构（Shared-nothing），GraphD / StorageD / MetaD 三组件分离
- 适合大规模场景，但运维需要管理 3+ 组件
- 来源：[NebulaGraph Docs](https://docs.nebula-graph.io/)

**Amazon Neptune**：
- 全托管，3 AZ 存储冗余，自动故障转移，连续备份至 S3
- 运维负担最低，但锁定 AWS 生态
- 来源：[AWS Neptune Features](https://aws.amazon.com/neptune/features/), [AWS Neptune Docs](https://docs.aws.amazon.com/neptune/latest/userguide/feature-overview-storage.html)

**JanusGraph**：
- 架构为 JanusGraph Core + 存储后端 (Cassandra/HBase/ScyllaDB) + 索引后端 (ES/Solr)
- 运维复杂度最高，需要同时管理多层组件
- 来源：[JanusGraph Deployment Docs](https://docs.janusgraph.org/operations/deployment/)

---

## 五、AI/LLM 集成能力（2024-2026）

| 数据库 | 向量搜索 | GraphRAG 支持 | LangChain 集成 | MCP Server | LLM 生态集成 |
|--------|---------|--------------|---------------|-----------|-------------|
| **Neo4j** | ✅ 原生向量索引 + Vector 数据类型 | ✅ LLM Knowledge Graph Builder, GraphRAG Agent, Aura Agent | ✅ 深度集成 | ✅ 官方 MCP | LangChain, LlamaIndex, Microsoft GraphRAG, Haystack |
| **NebulaGraph** | ✅ Enterprise v5.1+ 原生向量搜索 | ✅ Fusion GraphRAG, BioGraphRAG | ✅ 支持 | ✅ 开源 MCP Server | LangChain, LlamaIndex |
| **TigerGraph** | ❌ 需外部集成 | ⚠️ 有限支持 | ⚠️ 社区驱动 | ❌ | 主要走 GSQL 生态 |
| **Amazon Neptune** | ✅ Neptune ML + SageMaker 集成 | ⚠️ 通过 Bedrock 间接支持 | ✅ 支持 | ❌ | AWS Bedrock, SageMaker |
| **JanusGraph** | ❌ 需 Elasticsearch | ❌ | ⚠️ 有限 | ❌ | 弱 |
| **ArangoDB** | ✅ ArangoSearch (原生) | ⚠️ 社区探索 | ✅ 支持 | ❌ | LangChain 支持 |
| **TuGraph** | ❌ | ❌ | ❌ | ❌ | 弱 |
| **HugeGraph** | ❌ | ❌ | ❌ | ❌ | 弱 |

### AI 集成深度分析

**Neo4j — AI 生态最完善**：
- 2025 年推出 **Infinigraph**，支持原生分片向量索引，可在图内嵌入数十亿向量
- **Aura Agent** 支持构建上下文感知的多跳 Agent
- **MCP Server** 官方支持，可直接接入 AI Agent 框架
- 与 LangChain 深度集成：向量搜索、Cypher 生成、知识图谱构建
- 来源：[Neo4j GenAI Ecosystem](https://neo4j.com/generativeai/), [Neo4j 2025](https://neo4j.com/blog/news/2025-ai-scalability/)

**NebulaGraph — GraphRAG 领域领先**：
- **Fusion GraphRAG**：图遍历 + 语义向量搜索 + 全文检索三合一查询
- Enterprise v5.2 实现路径查询 100x 性能提升
- **MCP Server** 已开源
- 来源：[NebulaGraph 2025 Review](https://nebula-graph.io/posts/nebulagraph-2025-year-in-review-charting-a-new-era-of-graph-intelligence-and-ai-convergence)

---

## 六、中国本土图数据库生态

### 6.1 TuGraph（蚂蚁集团 / 清华大学）

| 维度 | 详情 |
|------|------|
| **定位** | 支付宝背后的核心图数据库 |
| **规模验证** | 蚂蚁集团 50 万核集群验证 |
| **查询语言** | Cypher / C++ 存储过程 |
| **特色** | LDBC SNB 曾保持世界纪录（2023）、金融级事务支持 |
| **开源状态** | Apache 2.0，GitHub 1.7k stars |
| **生态** | TuGraph 体系包括 TuGraph-DB（图数据库）、GeaFlow（流批一体图计算）、AntGraphLearning（图学习） |
| **来源** | [tugraph.org](https://www.tugraph.org), [GitHub](https://github.com/tugraph-family/tugraph-db) |

### 6.2 HugeGraph（百度 → Apache TLP）

| 维度 | 详情 |
|------|------|
| **定位** | 全栈图系统：图数据库 + 图计算 + 图 AI |
| **规模** | 支持千亿级顶点和边的存储与查询 |
| **查询语言** | Gremlin |
| **后端存储** | RocksDB / Cassandra / HBase / ScyllaDB / MySQL |
| **特色** | Apache Top-Level Project，支持 OLTP + OLAP |
| **开源状态** | Apache 2.0，GitHub 3.5k stars |
| **来源** | [hugegraph.apache.org](https://hugegraph.apache.org), [GitHub](https://github.com/apache/hugegraph) |

### 6.3 NebulaGraph（杭州悦数）

| 维度 | 详情 |
|------|------|
| **定位** | 全球排名 #2 的图数据库（DB-Engines 2025） |
| **用户** | Snapchat（推荐系统）、Airwallex（跨境支付）、BOSS 直聘（智能运维） |
| **AI 集成** | Fusion GraphRAG 领先，MCP Server 开源 |
| **开源状态** | Apache 2.0，GitHub 12.1k stars |
| **来源** | [nebula-graph.io](https://nebula-graph.io) |

### 6.4 GraphScope（阿里巴巴达摩院）

| 维度 | 详情 |
|------|------|
| **定位** | 图计算引擎（非独立图数据库） |
| **LDBC 记录** | SNB Interactive 世界纪录（2024-06，127,000+ QPS） |
| **规模** | SF1000 数据集（29 亿顶点，2080 亿边） |
| **来源** | [graphscope.io](https://graphscope.io) |

---

## 七、DB-Engines 排名（2026 年 3 月）

DB-Engines 是业界最权威的数据库流行度排名，综合搜索引擎、社交媒体、招聘需求等多维度数据。

图数据库类 Top 排名（按流行度）：
1. **Neo4j** — 遥遥领先
2. **Amazon Neptune**
3. **ArangoDB**
4. **TigerGraph**
5. **NebulaGraph** — 2025 年被官方宣布排名全球 #2（特定维度）

来源：[DB-Engines Graph DBMS Ranking](https://db-engines.com/en/ranking/graph+dbms)

---

## 八、GitHub 社区活跃度（2026-04）

| 数据库 | Stars | Forks | Open Issues | 活跃度评估 |
|--------|-------|-------|-------------|-----------|
| **Neo4j** | 16,318 | 2,589 | 188 | 🟢 非常活跃 |
| **ArangoDB** | 14,146 | 877 | 800 | 🟢 活跃 |
| **NebulaGraph** | 12,124 | 1,303 | 671 | 🟢 活跃 |
| **JanusGraph** | 5,767 | 1,208 | 582 | 🟡 中等 |
| **Memgraph** | 3,910 | 217 | — | 🟡 中等 |
| **FalkorDB** | 3,954 | 316 | — | 🟡 中等 (快速增长) |
| **HugeGraph** | 3,549 | 468 | — | 🟡 中等 |
| **TuGraph** | 1,726 | 212 | 166 | 🟡 中等 (中国社区活跃) |
| **TigerGraph** | ~299 | 155 | 37 | 🔴 较低 (核心代码闭源) |

> TigerGraph 的低 star 数是因为其核心引擎是闭源的，GitHub 上仅有生态工具。实际用户量可能高于 star 数反映的水平。

---

## 九、选型建议（按场景）

### 场景 1：知识图谱 + GraphRAG / AI 集成
**🏆 推荐：Neo4j**
- 理由：AI 生态最完善，原生向量搜索，LangChain/LlamaIndex/Microsoft GraphRAG 一等公民集成，Cypher 学习成本低，社区最大
- 备选：NebulaGraph（Fusion GraphRAG 领先，适合大规模场景）

### 场景 2：大规模 OLTP 实时图查询（数十亿顶点）
**🏆 推荐：NebulaGraph 或 Neo4j Infinigraph**
- 理由：NebulaGraph 原生分布式架构，Shared-nothing 设计，大规模场景验证充分（Snapchat、BOSS 直聘）；Neo4j Infinigraph 支持 100TB+ 水平扩展
- 备选：TuGraph（蚂蚁 50 万核验证，金融级场景）

### 场景 3：深度图分析 / 复杂 OLAP
**🏆 推荐：TigerGraph 或 Neo4j Graph Analytics**
- 理由：TigerGraph 原生并行计算，GSQL 支持复杂分析逻辑；Neo4j 65+ 内置算法
- 备选：GraphScope（LDBC SNB 世界纪录，但需评估生产成熟度）

### 场景 4：AWS 全托管 / 零运维
**🏆 推荐：Amazon Neptune**
- 理由：全托管，多 AZ 高可用，自动备份，零运维负担
- 注意：锁定 AWS 生态，性能上限受限，向量搜索能力弱于 Neo4j/NebulaGraph

### 场景 5：多模型需求（文档 + 图 + KV）
**🏆 推荐：ArangoDB**
- 理由：唯一真正的原生多模型数据库，AQL 统一查询，减少技术栈复杂度
- 注意：图分析深度不如专用图数据库

### 场景 6：国内合规 + 本土支持
**🏆 推荐：NebulaGraph（通用）或 TuGraph（金融）**
- 理由：NebulaGraph 国内社区最大，文档完善，商业支持好；TuGraph 蚂蚁验证，金融场景首选
- 备选：HugeGraph（Apache TLP，百度背景，适合搜索/安全领域）

### 场景 7：灵活后端 / 已有 Cassandra/HBase 集群
**🏆 推荐：JanusGraph**
- 理由：支持多种存储后端（Cassandra、HBase、ScyllaDB、BerkeleyDB），可复用现有基础设施
- 注意：运维复杂度高，性能依赖后端选择

---

## 十、综合评分矩阵（工程选型参考）

| 维度 (权重) | Neo4j | NebulaGraph | TigerGraph | Neptune | JanusGraph | ArangoDB | TuGraph | HugeGraph |
|-------------|-------|-------------|------------|---------|------------|----------|---------|-----------|
| **查询性能** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **分布式能力** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **AI/向量集成** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐ | ⭐ |
| **运维简易度** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **社区生态** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **查询语言生态** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **中国本土支持** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## 十一、总结与明确推荐

### 🥇 通用首选：Neo4j
- **最适合**：大多数团队的图数据库首选，特别是 AI/GraphRAG 场景
- **优势**：生态最完善，Cypher 标准化趋势，向量搜索原生支持，Infinigraph 突破扩展瓶颈
- **劣势**：Community 版功能受限，Enterprise 许可费用高

### 🥈 大规模分布式 + AI：NebulaGraph
- **最适合**：大规模数据场景 + AI 集成需求 + 国内团队
- **优势**：原生分布式架构领先，Fusion GraphRAG 创新，开源 Apache 2.0，国内社区强
- **劣势**：三组件架构运维复杂度高，nGQL 锁定效应

### 🥉 云原生托管首选：Amazon Neptune
- **最适合**：AWS 生态深度用户，追求零运维
- **优势**：全托管，多 AZ HA，与 AWS 服务无缝集成
- **劣势**：锁定 AWS，向量搜索弱，深度图分析能力有限

### 特殊场景推荐
- **金融/支付宝生态** → TuGraph
- **多模型需求** → ArangoDB
- **Apache 生态/百度背景** → HugeGraph
- **极致图分析** → TigerGraph（需接受闭源核心）

---

## 参考来源汇总

1. [LDBC SNB 官方 Benchmark](https://ldbcouncil.org/benchmarks/snb/) — 权威图数据库性能标准
2. [GraphScope LDBC SNB 世界纪录 (2024-06)](https://graphscope.io/blog/tech/2024/06/27/GraphScope-refreshes-the-world-record-for-the-LDBC-benchmark)
3. [Neo4j 2025 年度回顾](https://neo4j.com/blog/news/2025-ai-scalability/)
4. [NebulaGraph 2025 年度回顾](https://nebula-graph.io/posts/nebulagraph-2025-year-in-review-charting-a-new-era-of-graph-intelligence-and-ai-convergence)
5. [AWS Neptune Features](https://aws.amazon.com/neptune/features/)
6. [JanusGraph Deployment Docs](https://docs.janusgraph.org/operations/deployment/)
7. [HugeGraph Apache 官方](https://hugegraph.apache.org/)
8. [TuGraph 官方](https://www.tugraph.org/)
9. [DB-Engines Graph DBMS Ranking](https://db-engines.com/en/ranking/graph+dbms)
10. [Cambridge Intelligence: Choosing a Graph Database](https://cambridge-intelligence.com/choosing-graph-database/)
11. [DZone: Graph Query Language Comparison](https://dzone.com/articles/graph-query-language-comparison-gremlin-vs-cypher)
12. [Neo4j GenAI Ecosystem](https://neo4j.com/generativeai/)
13. [NebulaGraph Fusion GraphRAG](https://nebula-graph.io/solutions-fusion-graphrag)
