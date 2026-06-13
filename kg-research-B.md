# 图数据库调研报告 (方向 B)

> 调研时间：2026-04-16 | 覆盖范围：2024-2026 主流图数据库技术选型

---

## 一、主流图数据库对比总表

| 数据库 | 类型 | 查询语言 | 分布式支持 | 向量搜索 | License | 适用场景 | GitHub Stars (约) |
|--------|------|----------|-----------|---------|---------|----------|-------------------|
| **Neo4j** | 原生图存储 | Cypher (openCypher) | ✅ (Aura Cloud / Causal Cluster) | ✅ 原生向量索引 (5.x+) | 社区版: GPLv3; 企业版: 商业 | 全场景首选，知识图谱、GraphRAG | ~13k (核心) |
| **NebulaGraph** | 原生图存储 | nGQL (类 SQL) | ✅ 原生分布式 (存储-计算分离) | ✅ v5.2+ 原生向量+全文检索 | Apache 2.0 | 大规模社交网络、推荐系统、国内生态 | ~10k |
| **TigerGraph** | 原生图存储 | GSQL | ✅ MPP 分布式 | ⚠️ 有限支持 (需外部向量库) | 商业 (免费单机版) | 超大规模深度分析、金融风控 | ~5k |
| **Amazon Neptune** | 云托管图数据库 | Gremlin / SPARQL / openCypher | ✅ (AWS 托管，自动扩缩) | ✅ Neptune Analytics 向量搜索 | 商业 (AWS 托管服务) | AWS 生态内的图应用 | N/A (闭源服务) |
| **JanusGraph** | 图计算层 (依赖后端存储) | Gremlin | ✅ (需配置 Cassandra/HBase 后端) | ⚠️ 需 Elasticsearch 插件 | Apache 2.0 | 已有大数据基础设施的场景 | ~5k |
| **ArangoDB** | 多模型 (文档+图+KV) | AQL | ✅ (ArangoDB Cluster) | ✅ ArangoSearch (基于 IResearch) | 企业版: 商业; 社区版: Apache 2.0 | 需要多模型融合的场景 | ~13k |
| **TuGraph** (蚂蚁) | 原生图存储 | Cypher / GQL (类 SQL) | ✅ 分布式 HA 模式 | ⚠️ 实验性 | Apache 2.0 | 金融风控、反欺诈（国内信创） | ~2k |
| **HugeGraph** (百度/Apache) | 图计算层 (依赖后端存储) | Gremlin / Cypher (兼容) | ✅ (需配置后端存储) | ⚠️ 通过外部组件 | Apache 2.0 | 安全分析、国内开源社区 | ~2k |
| **GraphScope** (阿里) | 图计算平台 (非传统图数据库) | Cypher / Gremlin + 自研 PIE | ✅ 原生分布式 | ❌ 计算引擎为主 | Apache 2.0 | 超大规模图分析计算 | ~3k |

---

## 二、性能对比

### 2.1 LDBC SNB Benchmark

LDBC SNB (Linked Data Benchmark Council Social Network Benchmark) 是图数据库领域最权威的标准化基准测试。

| 数据库/平台 | SF 级别 | SNB Interactive 吞吐 | SNB BI 表现 | 备注 |
|------------|---------|---------------------|------------|------|
| **GraphScope Flex** (阿里) | SF100 | 🥇 **世界纪录** (2024-05, 2025-04) | 优秀 | 声明式查询 + 自研 Flex 架构，单节点吞吐率最高 |
| **TigerGraph** | SF100 | 高 | ✅ 108TB 规模通过验证 | MPP 架构擅长深度分析 |
| **Neo4j** | SF30 | 中等 | ✅ | 单机性能优秀，分布式扩展受限 |
| **NebulaGraph** | SF100 | 良好 | 良好 | 存算分离架构，水平扩展能力好 |

> **注意**: LDBC SNB 测试高度依赖硬件配置和调优，上述排名仅供参考。GraphScope 是计算引擎而非图数据库，不宜直接与其他图数据库对比。

### 2.2 第三方 Benchmark 摘要

| 场景 | Neo4j | TigerGraph | NebulaGraph | ArangoDB |
|------|-------|------------|-------------|----------|
| 短路径查询 (1-3 hop) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| 深度遍历 (4+ hop) | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| 大批量数据导入 | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 实时写入吞吐 | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| OLAP 聚合分析 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

---

## 三、查询语言对比

| 特性 | Cypher (openCypher) | Gremlin | nGQL (NebulaGraph) | GSQL (TigerGraph) | AQL (ArangoDB) |
|------|---------------------|---------|--------------------|--------------------|----------------|
| **类型** | 声明式 | 命令式/遍历式 | 声明式 (类 SQL) | 声明式+过程式 | 声明式 |
| **标准化** | openCypher / GQL (ISO 标准中) | Apache TinkerPop | NebulaGraph 私有 | TigerGraph 私有 | ArangoDB 私有 |
| **学习曲线** | ⭐⭐ 低 | ⭐⭐⭐⭐ 高 | ⭐⭐ 低 | ⭐⭐⭐ 中 | ⭐⭐⭐ 中 |
| **表达力** | 模式匹配为主 | 灵活但冗长 | SQL 风格，易上手 | 内置并行化语义 | 统一查询语言 |
| **生态兼容** | Neo4j, Memgraph, FalkorDB, Neptune | JanusGraph, Neptune, CosmosDB, 多数 TinkerPop | NebulaGraph | TigerGraph | ArangoDB |
| **LLM 适配** | ✅ 最佳 (Text2Cypher 成熟) | ⚠️ 难以自动生成 | ⚠️ 有 Text2nGQL 尝试 | ⚠️ 较难 | ⚠️ 有 Text2AQL 尝试 |

**推荐**: 优先选择 Cypher 生态。openCypher 正在成为 ISO GQL 标准的基础，LLM 生成 Cypher 查询的准确率远高于其他语言。

---

## 四、部署与运维

### 4.1 集群部署复杂度

| 数据库 | 最小集群 | 部署复杂度 | 依赖组件 | 推荐运维方案 |
|--------|---------|-----------|---------|-------------|
| **Neo4j Aura** | 1 节点 (全托管) | ⭐ 极低 | 无 | 官方云服务 |
| **Neo4j (自建)** | 3 节点 (Causal Cluster) | ⭐⭐⭐ 中 | JVM | Helm Chart / Docker |
| **NebulaGraph** | 5 进程 (3 meta + 1 graphd + 1 storage) | ⭐⭐⭐ 中 | 无 | NebulaGraph Operator (K8s) / Docker Compose |
| **TigerGraph** | 1 节点 (单机) | ⭐⭐ 低 | 无 | TigerGraph Cloud / Docker |
| **Amazon Neptune** | 2 实例 (主+副本) | ⭐ 极低 | AWS | 全托管 |
| **JanusGraph** | 3+ 节点 | ⭐⭐⭐⭐⭐ 极高 | Cassandra/HBase + Elasticsearch + ZooKeeper | 大数据团队维护 |
| **ArangoDB** | 3 节点 (Cluster) | ⭐⭐⭐ 中 | 无 | ArangoDB Graph Analytics / K8s |
| **TuGraph** | 3 节点 (HA) | ⭐⭐⭐ 中 | 无 | Docker / K8s |
| **HugeGraph** | 3+ 节点 | ⭐⭐⭐⭐ 较高 | 后端存储 (RocksDB/Cassandra/HBase) | 自定义部署 |

### 4.2 高可用与备份

| 数据库 | HA 机制 | 备份恢复 | 监控支持 |
|--------|---------|---------|---------|
| **Neo4j** | Causal Cluster (Raft 共识) | 在线备份 + 增量备份 | Prometheus + Grafana, Neo4j Ops Manager |
| **NebulaGraph** | 多副本 + Leader/Follower | NebulaGraph Backup & Restore | Prometheus + Grafana |
| **TigerGraph** | MPP 复制 | GAdmin 备份工具 | TigerGraph Admin Portal |
| **Amazon Neptune** | Multi-AZ 自动故障转移 | 自动快照 + PITR | CloudWatch |
| **ArangoDB** | Raft 共识 (Leader/Follower) | arangodump/restore | Prometheus + Grafana |
| **JanusGraph** | 依赖后端存储 HA | 依赖后端存储 | 需自行配置 |
| **TuGraph** | Raft HA 模式 | 快照备份 | TuGraph Dashboard |
| **HugeGraph** | 依赖后端存储 HA | 依赖后端 | 需自行配置 |

---

## 五、AI/LLM 集成能力 (GraphRAG)

| 数据库 | 向量搜索 | GraphRAG 支持 | LangChain/LlamaIndex | Text2Query | 评分 |
|--------|---------|--------------|----------------------|------------|------|
| **Neo4j** | ✅ 原生向量索引 | ⭐⭐⭐⭐⭐ 最成熟 | ✅ 官方集成 | ✅ Text2Cypher | **A+** |
| **NebulaGraph** | ✅ v5.2+ 原生向量+全文 | ⭐⭐⭐⭐ Fusion GraphRAG | ✅ 官方集成 | ✅ Text2nGQL | **A** |
| **ArangoDB** | ✅ ArangoSearch | ⭐⭐⭐⭐ GraphRAG 方案 | ✅ 官方集成 | ⚠️ 社区方案 | **A-** |
| **Amazon Neptune** | ✅ Neptune Analytics | ⭐⭐⭐ Neptune ML | ⚠️ 需搭配 OpenSearch | ⚠️ 有限 | **B+** |
| **TigerGraph** | ⚠️ 需外部向量库 | ⭐⭐⭐ GraphStudio AI | ⚠️ 社区驱动 | ⚠️ GSQL 较难自动生成 | **B** |
| **JanusGraph** | ⚠️ 需 Elasticsearch | ⭐⭐ | ⚠️ 有限 | ❌ | **C** |
| **TuGraph** | ⚠️ 实验性 | ⭐⭐ | ⚠️ 有限 | ❌ | **C** |
| **HugeGraph** | ❌ | ⭐⭐ | ⚠️ 有限 | ❌ | **C** |

**关键洞察**: 
- Neo4j 是 GraphRAG 领域事实上的标准，LangChain/LlamaIndex 均有官方集成
- NebulaGraph 在 v5.2 引入原生全文+向量检索，Fusion GraphRAG 实现了图遍历+向量搜索的统一查询
- 2025 年趋势：GraphRAG 从实验走向生产，「图+向量」双引擎成为标配

---

## 六、中国本土生态

### 6.1 NebulaGraph (Vesoft 星云图)

- **背景**: 杭州映云科技开发，国内最活跃的开源图数据库社区
- **特点**: 原生分布式、存算分离、nGQL (类 SQL)、大规模社交/推荐场景验证
- **生态**: 阿里云/腾讯云/华为云托管版本、飞书/钉钉生态集成、大量国内客户案例
- **社区**: GitHub ~10k stars，国内社区活跃度最高
- **商业**: 开源社区版 + 企业版 (向量搜索、全文检索、安全审计等)

### 6.2 TuGraph (蚂蚁集团)

- **背景**: 蚂蚁集团 + 清华大学联合研发，支付宝万亿业务背后的图数据库
- **特点**: C++ 高性能引擎、支持 Cypher/GQL、金融级 HA、50 万核图计算集群验证
- **生态**: 已整合入 OceanBase 生态、国内金融/支付行业应用广泛
- **社区**: GitHub ~2k stars，35 个仓库 (含 Browser、Client SDK、Benchmark)
- **商业**: Apache 2.0 开源 + 蚂蚁集团内部商业版

### 6.3 HugeGraph (百度 → Apache)

- **背景**: 百度安全 2017 年开源，2025 年晋升 Apache 顶级项目 (国内首个图数据库)
- **特点**: 兼容 Gremlin + Cypher、支持百亿级顶点/边、安全反欺诈场景起源
- **生态**: Apache 顶级项目地位、全栈图系统 (图数据库+图计算+图 AI)
- **社区**: GitHub ~2k stars，Apache 社区运营
- **商业**: 纯开源，百度安全内部使用

### 6.4 GraphScope (阿里巴巴达摩院)

- **背景**: 阿里达摩院自研，LDBC SNB Interactive 世界纪录保持者
- **特点**: 图计算平台 (非传统图数据库)，PIE 编程模型，超大规模图分析
- **生态**: 阿里云 GraphScope 云服务
- **社区**: GitHub ~3k stars
- **定位**: 图分析计算引擎，不适合做通用图数据库存储层

### 6.5 国内选型建议

| 场景 | 推荐 | 备注 |
|------|------|------|
| **信创合规** | TuGraph / NebulaGraph | 国产化首选，TuGraph 有金融级验证 |
| **大规模社交/推荐** | NebulaGraph | 国内社区最活跃，原生分布式成熟 |
| **安全/反欺诈** | HugeGraph / TuGraph | HugeGraph 安全场景起家，TuGraph 金融场景强 |
| **GraphRAG/知识图谱** | NebulaGraph (v5.2+) | 原生向量+全文检索，Fusion GraphRAG |
| **通用图存储** | Neo4j (社区版) | 如果不强制信创，Neo4j 仍是首选 |

---

## 七、选型决策树

```
需要图数据库？
├── 已深度使用 AWS？
│   └── → Amazon Neptune (全托管，零运维)
├── 需要多模型 (文档+图+KV)？
│   └── → ArangoDB (统一查询语言 AQL)
├── 已有大数据基础设施 (Cassandra/HBase/ES)？
│   └── → JanusGraph (复用现有栈) [⚠️ 运维复杂]
├── 超大规模深度分析 (百亿+ 边)？
│   └── → TigerGraph (MPP 架构，GSQL)
├── 需要 GraphRAG/知识图谱 + AI？
│   └── → Neo4j (最成熟生态)
├── 需要大规模分布式 + 国内生态？
│   └── → NebulaGraph (原生分布式，国内社区)
├── 需要信创/国产化？
│   └── → TuGraph (金融级) / HugeGraph (Apache)
└── 通用入门 / 中小规模？
    └── → Neo4j Community Edition (学习成本最低)
```

---

## 八、场景选型推荐

### 8.1 按规模

| 规模 | 数据量 | 推荐 | 理由 |
|------|--------|------|------|
| **小规模** | < 1 亿边 | Neo4j Community | 单机性能优异，Cypher 学习曲线低 |
| **中等规模** | 1-100 亿边 | NebulaGraph / Neo4j Enterprise | NebulaGraph 原生分布式；Neo4j 企业版有 Fabric 分片 |
| **大规模** | > 100 亿边 | TigerGraph / NebulaGraph | TigerGraph MPP 擅长深度分析；NebulaGraph 水平扩展好 |

### 8.2 按场景

| 场景 | 推荐 | 备选 |
|------|------|------|
| **GraphRAG / 知识图谱** | Neo4j | NebulaGraph v5.2+ |
| **社交网络 / 推荐** | NebulaGraph | Neo4j |
| **金融风控 / 反欺诈** | TigerGraph / TuGraph | NebulaGraph |
| **网络安全 / 威胁情报** | HugeGraph | Neo4j |
| **AWS 云原生** | Amazon Neptune | - |
| **多模型融合** | ArangoDB | - |
| **实时交易图** | Neo4j | ArangoDB |
| **超大规模 OLAP** | GraphScope (阿里) | TigerGraph |

### 8.3 按部署方式

| 部署方式 | 推荐 |
|----------|------|
| **全托管云服务** | Neo4j Aura / Amazon Neptune / ArangoDB Oasis |
| **K8s Operator** | NebulaGraph / Neo4j / ArangoDB |
| **Docker 轻量部署** | Neo4j Community / ArangoDB |
| **已有大数据平台** | JanusGraph (Cassandra/HBase 后端) |

---

## 九、社区活跃度 (2025-2026 年初)

| 数据库 | GitHub Stars | Contributors | 最近活跃 | Stack Overflow Tag |
|--------|-------------|-------------|---------|--------------------|--------------------|
| **Neo4j** | ~13k (核心) / 300+ repos | 200+ | 活跃 | 最活跃 (图数据库标签) | 活跃 |
| **NebulaGraph** | ~10k | 100+ | 活跃 | 中等 | **最活跃** |
| **ArangoDB** | ~13k | 150+ | 活跃 | 中等 | 一般 |
| **TigerGraph** | ~5k | 50+ | 中等 | 较少 | 较少 |
| **JanusGraph** | ~5k | 200+ | 活跃 | 中等 | 少 |
| **TuGraph** | ~2k | 50+ | 活跃 | 极少 |
| **HugeGraph** | ~2k | 80+ | 活跃 | 极少 |
| **Amazon Neptune** | N/A | N/A | 活跃 | 较多 (AWS 标签) | 一般 |

---

## 十、关键趋势与结论

### 10.1 2024-2026 行业趋势

1. **GraphRAG 成为标配**: 图数据库 + 向量搜索 + LLM 的三位一体成为 2025 年最热门的图应用方向
2. **openCypher → GQL 标准化**: ISO GQL 标准发布在即，Cypher 生态将在 2025-2026 年获得更大市场占有率
3. **国产化加速**: TuGraph 和 HugeGraph 在信创场景快速渗透，NebulaGraph 国内生态持续壮大
4. **云原生趋势**: Neo4j Aura、NebulaGraph Cloud、Amazon Neptune 等全托管服务成为首选
5. **向量搜索内嵌**: 图数据库开始原生支持向量索引，不再依赖外部向量数据库

### 10.2 最终推荐

| 优先级 | 推荐 | 适用人群 |
|--------|------|---------|
| 🥇 **首选** | **Neo4j** | 通用场景、知识图谱、GraphRAG、入门学习 |
| 🥈 **备选** | **NebulaGraph** | 大规模分布式、国内生态、信创需求 |
| 🥉 **第三选** | **ArangoDB** | 需要多模型融合 (文档+图+KV) |
| 🏅 **特殊场景** | **TigerGraph** | 超大规模深度图分析 |
| 🏅 **特殊场景** | **Amazon Neptune** | AWS 全托管，零运维 |
| 🏅 **特殊场景** | **TuGraph** | 国内金融信创场景 |

**一句话**: 如果没有特殊限制，选 Neo4j 准没错；如果需要大规模分布式或信创合规，选 NebulaGraph 或 TuGraph。

---

*调研完成 2026-04-16*
