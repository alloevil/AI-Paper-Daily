# 调研方向 F：Agent + KG（智能体与知识图谱结合）

> 调研时间：2026-04-16 | 覆盖范围：2024-2026
> 侧重：工程可落地方案、开源工具、架构设计

---

## 一、Agent + KG 技术全景

### 核心趋势

2024-2026 年，Agent 与知识图谱（KG）的结合呈现四大方向：

| 方向 | 核心思路 | 代表项目 |
|------|----------|----------|
| **Agent 记忆（KG-backed Memory）** | 用时序知识图谱替代传统向量数据库做长期记忆 | Graphiti/Zep、Mem0、Cognee、MemGPT |
| **GraphRAG（KG 增强检索）** | 从文档中构建 KG，用图结构检索替代纯向量检索 | Microsoft GraphRAG、LightRAG、nano-graphrag |
| **多 Agent + KG 协作** | 共享知识图谱作为多 Agent 的"工作空间" | SciAgents、GRAPHWORLD、AGENTiGraph |
| **KG 增强 Agent 规划** | 知识图谱指导 Agent 的动作规划和推理 | KnowAgent、GAP |

### 架构全景图

```
┌─────────────────────────────────────────────────────────┐
│                    AI Agent Layer                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Agent 1  │  │ Agent 2  │  │ Agent N  │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │                    │
│  ┌────▼──────────────▼──────────────▼────┐              │
│  │         Memory / Context Layer         │              │
│  │  ┌────────────┐  ┌──────────────────┐ │              │
│  │  │ Graph Memory│  │ Vector Store     │ │              │
│  │  │ (Neo4j/     │  │ (Embedding DB)   │ │              │
│  │  │  FalkorDB)  │  │                  │ │              │
│  │  └────────────┘  └──────────────────┘ │              │
│  └───────────────────────────────────────┘              │
│                          │                               │
│  ┌───────────────────────▼───────────────────────┐      │
│  │        Knowledge Graph (Factual Grounding)     │      │
│  │  实体 → 关系 → 属性（带时序标签）              │      │
│  └───────────────────────────────────────────────┘      │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │     GraphRAG Pipeline (离线构建 + 在线检索)      │    │
│  │  文档 → 实体抽取 → 图构建 → 社区摘要 → 检索     │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 二、重点项目/框架列表

### 2.1 Agent 记忆层（Graph-based Memory）

#### 1. Graphiti / Zep

| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/getzep/graphiti |
| **Stars** | ~6k+（2026 年 4 月） |
| **核心定位** | 为 AI Agent 构建**时序知识图谱**的开源框架 |
| **架构** | Neo4j 图数据库 + 语义+向量混合检索 + 时序边（temporal edges） |
| **核心能力** | ① 自动从对话/数据构建知识图谱 ② 时序关系追踪（事实随时间变化） ③ 实体消歧和合并 ④ 自定义实体类型（Custom Entity Types） |
| **论文** | *Zep: A Temporal Knowledge Graph Architecture for Agent Memory*（arXiv:2501.13956），在 DMR benchmark 上超越 MemGPT |
| **集成** | LangChain、LlamaIndex、AutoGen 原生集成 |
| **工程要点** | 需要 Neo4j 实例；Python SDK；支持自定义图 schema |

来源：https://github.com/getzep/graphiti | https://arxiv.org/abs/2501.13956

#### 2. Mem0

| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/mem0ai/mem0 |
| **Stars** | ~22k+（2026 年 4 月） |
| **核心定位** | AI Agent 的**通用记忆层**，支持向量+图双存储 |
| **架构** | Vector store（Qdrant/Chroma）+ Graph store（Neo4j/FalkorDB/Amazon Neptune）+ LLM 推理层 |
| **核心能力** | ① 短期/长期记忆管理 ② 语义/情景/程序记忆分类 ③ 记忆衰减和合并 ④ 多用户记忆隔离 |
| **论文** | *Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory*（arXiv:2504.19413） |
| **集成** | LangChain、LangGraph、LlamaIndex、AutoGen、CrewAI、OpenAI Assistants |
| **工程要点** | 一行代码集成；支持托管服务和自部署；AWS 集成（Neptune + ElastiCache） |

来源：https://github.com/mem0ai/mem0 | https://arxiv.org/abs/2504.19413

#### 3. Cognee

| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/topoteretes/cognee |
| **Stars** | ~3k+（2026 年 4 月） |
| **核心定位** | 开源 AI **知识引擎**，将原始数据转为结构化知识图谱 |
| **架构** | 多图存储后端（Neo4j / Memgraph / FalkorDB）+ 向量存储 + 30+ 数据连接器 |
| **核心能力** | ① 多格式数据接入 ② 自动知识图谱构建 ③ 语义关联发现 ④ 持续学习 |
| **集成** | Microsoft AutoGen（微软官方教程使用）、LangChain |
| **工程要点** | 5 行代码集成；Python SDK；已被微软 AI Agents for Beginners 教程收录 |

来源：https://github.com/topoteretes/cognee | https://www.cognee.ai/

#### 4. MemGPT / Letta

| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/cpacker/MemGPT |
| **Stars** | ~12k+（2026 年 4 月） |
| **核心定位** | 受 OS 虚拟内存启发的 Agent 记忆管理框架 |
| **架构** | 主存（context window）+ 外存（数据库）+ 函数调用管理记忆迁移 |
| **核心能力** | ① 自主管理上下文窗口 ② 短期/长期记忆分层 ③ 记忆检索和更新 |
| **与 KG 关系** | 本身非图结构，但可与 Neo4j 等图数据库集成；后续版本 Letta 支持持久化 Agent 状态 |
| **工程要点** | 概念创新但工程复杂度高；已被 Zep 在 DMR benchmark 上超越 |

来源：https://github.com/cpacker/MemGPT | https://arxiv.org/abs/2310.08560

### 2.2 GraphRAG 框架

#### 5. Microsoft GraphRAG

| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/microsoft/graphrag |
| **Stars** | ~23k+（2026 年 4 月） |
| **核心定位** | 微软开源的**基于图的检索增强生成**框架 |
| **架构** | 文档 → LLM 实体抽取 → 知识图谱构建 → Leiden 社区检测 → 社区摘要 → Map-Reduce 检索 |
| **核心能力** | ① 全局/局部双检索模式 ② 自动社区摘要生成 ③ 增量索引更新 ④ 支持多种 LLM 后端 |
| **论文** | *From Local to Global: A Graph RAG Approach to Query-Focused Summarization*（2024） |
| **工程要点** | LLM 资源消耗大（构建阶段）；适合文档密集型场景；支持 Azure OpenAI |

来源：https://github.com/microsoft/graphrag | https://www.microsoft.com/en-us/research/project/graphrag/

#### 6. LightRAG

| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/hkuds/lightrag |
| **Stars** | ~10k+（2026 年 4 月） |
| **核心定位** | GraphRAG 的**轻量替代**，成本降低 ~6000x |
| **架构** | 双层检索（低层实体+高层主题）+ 向量+图混合索引 |
| **核心能力** | ① 增量更新无需重建 ② 双层检索覆盖细粒度和全局语义 ③ 内置 Web UI 和 API |
| **论文** | *LightRAG: Simple and Fast Retrieval-Augmented Generation*（arXiv:2410.05779） |
| **工程要点** | 基于 nano-graphrag；支持 Neo4j 后端；部署简单 |

来源：https://github.com/hkuds/lightrag | https://arxiv.org/abs/2410.05779

#### 7. nano-graphrag

| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/gusye1234/nano-graphrag |
| **Stars** | ~2k+ |
| **核心定位** | GraphRAG 的**最小可复现实现**，适合学习和定制 |
| **架构** | 精简版 GraphRAG 核心流程 |
| **核心能力** | ① 代码简洁可读 ② 保留核心图构建和检索逻辑 ③ 易于二次开发 |
| **工程要点** | LightRAG 的底层基础；适合从零理解和定制 GraphRAG |

来源：https://github.com/gusye1234/nano-graphrag

### 2.3 多 Agent + KG 系统

#### 8. SciAgents

| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/lamm-mit/SciAgentsDiscovery |
| **核心定位** | MIT 出品，**多 Agent + 本体知识图谱**驱动的科学发现框架 |
| **架构** | 本体知识图谱 + 多 Agent 协作（材料科学家 Agent、化学家 Agent 等）+ LLM 推理 |
| **核心能力** | ① 大规模本体 KG 组织科学知识 ② 多 Agent 角色分工协作 ③ 自主生成和验证假设 ④ 图推理驱动发现 |
| **论文** | *SciAgents: Automating scientific discovery through multi-agent intelligent graph reasoning*（Advanced Materials, 2025, 引用 256+） |
| **工程要点** | Jupyter Notebook 驱动；Neo4j 图存储；适用于知识密集型领域 |

来源：https://github.com/lamm-mit/SciAgentsDiscovery | arXiv:2409.05556

#### 9. GRAPHWORLD

| 属性 | 详情 |
|------|------|
| **论文** | *Enabling multi-agent collaboration in knowledge graph environments*（NeurIPS 2025 Workshop） |
| **核心定位** | 为多 Agent 提供**共享 KG 环境**的协作框架 |
| **核心能力** | ① Agent 可创建/更新/删除节点和边 ② 支持 Python/TypeScript ③ 共享 KG 作为通信媒介 |
| **来源** | https://neurips.cc/virtual/2025/124503 |

#### 10. AGENTiGraph

| 属性 | 详情 |
|------|------|
| **论文** | *AGENTiGraph: A Multi-Agent Knowledge Graph Framework for Enterprise Knowledge Management*（arXiv:2508.02999） |
| **核心定位** | **多 Agent 企业知识管理**框架 |
| **核心能力** | ① 多轮对话知识管理 ② Agent 驱动的 KG 构建和查询 ③ LLM + 结构化图桥接 |
| **来源** | https://arxiv.org/abs/2508.02999 |

### 2.4 KG 增强 Agent 规划

#### 11. KnowAgent

| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/zjunlp/KnowAgent |
| **核心定位** | 知识增强的动作规划（NAACL 2025） |
| **核心能力** | 构建动作知识库，指导 Agent 规划更合理的行动序列 |
| **来源** | https://github.com/zjunlp/KnowAgent |

### 2.5 辅助项目

| 项目 | GitHub | 说明 |
|------|--------|------|
| **GraphZep** | https://github.com/aexy-io/graphzep | Zep 论文的开源实现，支持情景/语义/程序记忆 |
| **TrustGraph** | https://github.com/trustgraph-ai | 上下文操作系统，构建和部署智能上下文图 |
| **SciToolAgent** | https://github.com/HICAI-ZJU/SciToolAgent | KG 驱动的科学工具 Agent |
| **Awesome-GraphMemory** | https://github.com/DEEP-PolyU/Awesome-GraphMemory | 图结构 Agent 论文/项目合集 |
| **Awesome-Graph-augmented-LLM-Agent** | https://github.com/Shiy-Li/Awesome-Graph-augmented-LLM-Agent | 图增强 LLM Agent 论文合集 |

---

## 三、核心论文（8 篇）

### 1. Zep: A Temporal Knowledge Graph Architecture for Agent Memory
- **作者**: Preston Rasmussen et al. (Zep AI)
- **年份**: 2025
- **核心贡献**: 提出时序知识图谱架构，包含情景/语义/程序记忆，在 DMR benchmark 上超越 MemGPT
- **链接**: https://arxiv.org/abs/2501.13956

### 2. GraphRAG: From Local to Global — A Graph RAG Approach to Query-Focused Summarization
- **作者**: Darren Edge et al. (Microsoft Research)
- **年份**: 2024
- **核心贡献**: 用 LLM 从文档自动构建 KG，通过社区检测和摘要实现全局检索，显著优于传统 RAG
- **链接**: https://arxiv.org/abs/2404.16130

### 3. LightRAG: Simple and Fast Retrieval-Augmented Generation
- **作者**: Zirui Guo et al. (HKU)
- **年份**: 2024
- **核心贡献**: 双层检索+图索引，成本比 GraphRAG 低 ~6000 倍，支持增量更新
- **链接**: https://arxiv.org/abs/2410.05779

### 4. Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory
- **作者**: Prateek Chhikara et al. (Mem0 AI)
- **年份**: 2025
- **核心贡献**: 通用记忆层架构，向量+图双存储，多用户记忆隔离，生产级可扩展
- **链接**: https://arxiv.org/abs/2504.19413

### 5. AriGraph: Learning Knowledge Graph World Models with Episodic Memory for LLM Agents
- **作者**: Petr Anokhin et al. (AIRI)
- **年份**: 2024 (IJCAI 2025 接收)
- **核心贡献**: Agent 在探索中自主构建整合语义和情景记忆的 KG 世界模型，显著提升导航和 QA 任务
- **链接**: https://arxiv.org/abs/2407.04363

### 6. SciAgents: Automating scientific discovery through multi-agent intelligent graph reasoning
- **作者**: Alireza Ghafarollahi, Markus J. Buehler (MIT)
- **年份**: 2024 (Advanced Materials, 2025 正式发表)
- **核心贡献**: 多 Agent + 本体 KG 自主发现科学假设，已发表 256+ 引用
- **链接**: https://arxiv.org/abs/2409.05556

### 7. Enabling multi-agent collaboration in knowledge graph environments (GRAPHWORLD)
- **作者**: 多位作者
- **年份**: 2025 (NeurIPS 2025 Workshop)
- **核心贡献**: 为多 Agent 提供共享 KG 协作环境，Agent 通过操作 KG 进行通信
- **链接**: https://openreview.net/pdf?id=xUDGChZsfG

### 8. MemGPT: Towards LLMs as Operating Systems
- **作者**: Charles Packer et al. (UC Berkeley)
- **年份**: 2023 (系统论文)
- **核心贡献**: 提出 OS 风格的 Agent 记忆管理，分主存/外存层，开创 Agent 记忆研究方向
- **链接**: https://arxiv.org/abs/2310.08560

---

## 四、与现有 Agent 框架的集成方式

### 4.1 LangChain / LangGraph

| 集成方式 | 说明 |
|----------|------|
| **Neo4j GraphQA Chain** | LangChain 原生支持 Neo4j 知识图谱查询，LLM 生成 Cypher 查询 |
| **GraphRAG + LangGraph** | 可将 GraphRAG/LightRAG 作为 LangGraph 的一个节点 |
| **Mem0 集成** | Mem0 提供 LangChain/LangGraph 原生集成包 |
| **Graphiti 集成** | Graphiti 提供 LangChain adapter |

```python
# 典型集成模式（LangGraph + Neo4j）
from langchain_community.graphs import Neo4jGraph
from langchain.chains import GraphCypherQAChain

graph = Neo4jGraph(url="bolt://localhost:7687", ...)
chain = GraphCypherQAChain.from_llm(llm, graph=graph, verbose=True)

# 在 LangGraph 中作为工具节点
from langgraph.graph import StateGraph
graph_builder = StateGraph(AgentState)
graph_builder.add_node("kg_query", kg_tool_node)
```

来源：https://docs.langchain.com/oss/python/integrations/providers/neo4j

### 4.2 AutoGen (Microsoft)

| 集成方式 | 说明 |
|----------|------|
| **Mem0 作为记忆后端** | AutoGen 官方文档已收录 Mem0 集成指南 |
| **Cognee + AutoGen** | 微软 AI Agents for Beginners 教程使用 Cognee + AutoGen |

来源：https://microsoft.github.io/autogen/0.2/docs/ecosystem/mem0/ | https://github.com/microsoft/ai-agents-for-beginners

### 4.3 CrewAI

Mem0 提供 CrewAI 原生集成，为每个 Agent 提供独立的图记忆。

### 4.4 OpenClaw / 其他 Agent 平台

- OpenClaw 社区已讨论 KG 记忆集成（OpenClaw#2910 提案），候选方案包括 Cognee、Zep、Mem0
- 核心模式：将 KG 作为 MCP Server 或独立 Memory Layer 挂载

---

## 五、工程落地关键点

### 5.1 图数据库选型

| 数据库 | 特点 | 推荐场景 |
|--------|------|----------|
| **Neo4j** | 成熟、生态丰富、Cypher 查询语言 | 企业级、GraphRAG、Agent 记忆 |
| **FalkorDB** | Redis 兼容协议、低延迟、开源 | Mem0 图存储后端、性能敏感场景 |
| **Memgraph** | 流式图处理、CogniSkill 集成 | 实时图更新、流式 Agent 记忆 |
| **Amazon Neptune** | 托管服务、高可用 | AWS 生态、大规模部署 |
| **NetworkX（内存）** | Python 原生、轻量 | 原型验证、小规模实验 |

### 5.2 Agent 记忆架构设计要点

1. **分层记忆模型**
   - 工作记忆（context window）→ 短期记忆（最近对话摘要）→ 长期记忆（KG 持久化）
   - 参考 Zep 的三层：Episodic（事件）、Semantic（事实）、Procedural（流程）

2. **时序管理**
   - 所有事实必须带时间戳（valid_from / valid_to）
   - 支持事实过期和更新（如：用户换了工作 → 旧工作标记 invalid）
   - 参考 Zep 的 temporal edges 设计

3. **实体消歧**
   - 同一实体不同表述的合并（如"小高"="高瑞林"）
   - LLM 辅助实体链接

4. **检索策略**
   - 向量检索（语义相似）+ 图遍历（关系扩展）+ 社区摘要（全局主题）
   - 混合检索优于纯向量或纯图

5. **成本控制**
   - GraphRAG 构建阶段 LLM 调用量大，LightRAG 可降低 ~6000x 成本
   - 增量更新避免全量重建

### 5.3 多 Agent 共享 KG 的工程实践

1. **读写权限隔离**：每个 Agent 有自己的"写区域"，避免冲突
2. **版本控制**：KG 变更日志，支持回滚
3. **冲突解决**：多 Agent 同时修改同一实体时需要合并策略
4. **命名空间**：按 Agent/用户/项目隔离子图

### 5.4 推荐技术栈（快速起步）

```
# 轻量起步（Python）
pip install graphiti-core  # 或 mem0 / cognee
pip install neo4j          # 图数据库

# GraphRAG 起步
pip install lightrag-hku   # 轻量替代 Microsoft GraphRAG

# 集成 Agent 框架
pip install langchain langgraph langchain-neo4j
pip install mem0           # 记忆层
```

### 5.5 落地挑战与建议

| 挑战 | 建议 |
|------|------|
| KG 构建质量依赖 LLM | 使用强模型（GPT-4o/Claude）做抽取；设计 prompt 模板；人工抽检 |
| 图规模膨胀 | 设置实体上限；定期合并低频实体；子图隔离 |
| 实时性要求 | 选择 Memgraph（流式）或 FalkorDB（低延迟）；避免重型离线 pipeline |
| 成本 | 先用 LightRAG/nano-graphrag 验证；GraphRAG 仅在需要全局摘要时使用 |
| 评估 | 使用 DMR benchmark（Zep 论文）评估记忆质量；使用自定义 QA 测试集评估 GraphRAG |

---

## 六、总结与趋势判断

### 2024-2026 关键趋势

1. **KG Agent Memory 正在从学术走向工程可落地**：Graphiti、Mem0、Cognee 等项目已提供生产级 SDK
2. **GraphRAG 成为标准模式**：从 Microsoft GraphRAG 到 LightRAG，图增强检索已被广泛接受
3. **多 Agent + KG 协作是下一个热点**：GRAPHWORLD、SciAgents 等展示了共享 KG 作为 Agent 通信和协作媒介的潜力
4. **向量 + 图混合存储成为共识**：纯向量或纯图都不够，混合架构是最佳实践
5. **时序知识图谱是 Agent 记忆的关键差异化**：Zep/Graphiti 的时序边设计解决"事实会过时"的核心问题

### 对 OpenClaw 等 Agent 平台的启示

- **短期可落地**：集成 Mem0 或 Cognee 作为记忆层（5 行代码起步）
- **中期方向**：用 Graphiti 构建时序图记忆，替代简单的向量存储
- **长期愿景**：多 Agent 共享 KG（参考 GRAPHWORLD），Agent 通过操作 KG 进行协作

---

*调研完毕。所有信息标注来源 URL，供进一步验证。*
