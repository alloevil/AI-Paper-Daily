# 社交媒体数据构建知识图谱 — 调研报告 v3

> 调研时间：2026-04-17
> 方法论：两阶段调研（探索-利用解耦）
> 对比基线：kg-research-A-v2.md / kg-social-media-best-practices.md（2026-04-16）

---

## 一、核心结论

**没有一个现成的"微博/Twitter → KG"端到端开源项目。** 社交媒体 KG 方向仍处于早期探索阶段，大多数项目是学术 demo 或通用 GraphRAG 框架套社交媒体数据。

**推荐路径**：
```
① 数据采集清洗 → ② LLM 实体关系抽取 → ③ Neo4j/图存储 → ④ GraphRAG 检索 → ⑤ 应用层
```

---

## 二、开源项目（2026 更新版）

### 2.1 社交媒体专用

| 项目 | Stars | 核心功能 | 适用性 | 链接 |
|------|-------|---------|--------|------|
| **GRASP-ChoQ** | — | Twitter → KG → 立场检测，完整 pipeline（清洗→翻译→NER→Neo4j→分类） | ⭐⭐⭐⭐⭐ 最相关 | [GitHub](https://github.com/Programming-Dude/GRASP-ChoQ) |
| **twitter-graph** | — | 抓取 Twitter 好友/粉丝关系，构建社交图谱，Gephi 可视化 | ⭐⭐⭐ 轻量级 | [GitHub](https://github.com/eleurent/twitter-graph) |
| **KG + DL for Tweet Categorization** | — | Twitter → Wikidata 实体链接 → RDF2Vec → KG 增强文本分类 | ⭐⭐⭐ 学术 demo | [GitHub](https://github.com/knowledgeb/Combining-Knowledge-Graphs-and-Deep-Learning-techniques-for-Categorizing-Tweets) |
| **Neo4j Social Media ETL** | — | Python + Neo4j ETL pipeline，嵌套 JSON → 图节点（User/Tweet/Place/Hashtag） | ⭐⭐⭐⭐ 实操教程 | [lbsocial.net](https://www.lbsocial.net/post/social-media-knowledge-graph-python-neo4j) |
| **twitter-research/tgn** | — | 时序图网络，处理动态图（节点/边随时间变化） | ⭐⭐ 底层框架 | [GitHub](https://github.com/twitter-research/tgn) |

### 2.2 通用 GraphRAG 框架（可直接用于社交媒体）

| 项目 | Stars | 核心功能 | 社交媒体适用性 | 链接 |
|------|-------|---------|--------------|------|
| **Microsoft GraphRAG** | 22k+ | 文本→实体关系抽取→社区层次→local/global 检索 | ⭐⭐⭐⭐ 直接 feed 社交媒体文本 | [GitHub](https://github.com/microsoft/graphrag) |
| **LightRAG** | 20k+ | 轻量级替代 GraphRAG，双层检索，增量更新 | ⭐⭐⭐⭐ 适合快速迭代 | [GitHub](https://github.com/HKUDS/LightRAG) |
| **OneKE** | 1k+ | Schema-guided 知识抽取，阿里达摩院 OpenSPG 生态，中文首选 | ⭐⭐⭐⭐⭐ 中文场景 | [GitHub](https://github.com/OpenSPG/OneKE) |
| **HippoRAG 2** | — | 模仿海马体的知识整合，事实记忆+关联推理，token 消耗显著低于 GraphRAG | ⭐⭐⭐ 新方向 | [论文](https://medium.com/graph-praxis/graphrag-vs-hipporag-vs-pathrag-vs-og-rag) |
| **PathRAG** | — | 路径增强的 RAG，聚焦关系路径检索 | ⭐⭐⭐ | 同上对比文章 |
| **HyperGraphRAG** | — | 超图结构知识表示，NeurIPS 2025 Poster | ⭐⭐⭐ 学术前沿 | [NeurIPS](https://neurips.cc/virtual/2025/poster/115764) |

### 2.3 中文场景推荐组合

```
OneKE（中文实体关系抽取）
  + Neo4j（图存储）
  + LightRAG（GraphRAG 检索，支持中文）
  + OwnThink（通用背景知识图谱，补充实体链接）
```

---

## 三、论文重点

| 论文 | 做了什么 | 状态 |
|------|---------|------|
| GRASP-ChoQ (ACL 2025 BanglaLP) | KG + Chain-of-Questions 推理增强推文立场检测 | ✅ 已发布 |
| KG-enhanced Tweet Classification | 用 KG 提升推文分类准确率，证明 KG 能捕捉推文间隐含关系 | ✅ 已发布 |
| LightRAG (EMNLP 2025 Findings) | 双层检索+图结构+增量更新，GraphRAG 的轻量替代 | ✅ 已发布 |
| HyperGraphRAG (NeurIPS 2025) | 超图结构知识表示，扩展传统 KG 的关系表达能力 | ✅ Poster |
| Social Media KG Construction | 社交媒体文本→KG 通用框架，含实体链接、关系抽取、时序管理 | 综述 |

---

## 四、与 v2 调研的差异

### 新增内容

1. **Neo4j Social Media ETL 教程**（2026-01 新）：完整的 Python + Neo4j ETL pipeline，从嵌套 JSON 到图节点，实操性最强
2. **LightRAG 重大更新**：EMNLP 2025 发表、OpenSearch 存储后端、Docker 部署向导、reranker 支持、多模态集成（RAG-Anything）、Neo4j 存储
3. **HippoRAG 2 / PathRAG / HyperGraphRAG**：2025 年新涌现的 RAG 变体，各有特色
4. **GraphRAG vs HippoRAG vs PathRAG vs OG-RAG 对比文章**：选型参考
5. **GraphRAG 2026 买家指南**：企业级部署经验

### 已验证（与 v2 一致）

- GRASP-ChoQ 仍然是最完整的社交媒体 KG pipeline
- OneKE 仍然是中文实体抽取首选
- 仍然没有端到端的"微博→KG"开源项目
- 推荐自行组装路径不变

### 修正

- LightRAG Stars: v2 未记录 → v3 确认 20k+（增长迅速）
- GraphRAG Stars: v2 记录 22k+ → v3 仍然 22k+（稳定）
- OneKE Stars: v2 记录 1k+ → v3 确认仍在增长

---

## 五、落地建议

### 如果做微博 → KG

1. **数据采集**：微博 API / 爬虫 → JSON
2. **清洗**：去重、去广告、分词
3. **实体抽取**：OneKE（中文 NER）或 GPT-4o / Qwen
4. **图存储**：Neo4j AuraDB Free（20 万节点够用）
5. **检索**：LightRAG（轻量、支持增量更新）
6. **应用**：舆情分析 / 问答 / 可视化

### 如果做 Twitter → KG

1. 可直接参考 GRASP-ChoQ 的 pipeline
2. 把立场检测换成自己的下游任务即可
3. 图存储同样用 Neo4j
4. 检索层可选 GraphRAG（更成熟）或 LightRAG（更快）

---

## 六、参考来源

| # | 来源 | URL |
|---|------|-----|
| 1 | GRASP-ChoQ GitHub | https://github.com/Programming-Dude/GRASP-ChoQ |
| 2 | GRASP-ChoQ 论文 | https://aclanthology.org/2025.banglalp-1.2/ |
| 3 | Microsoft GraphRAG | https://github.com/microsoft/graphrag |
| 4 | LightRAG | https://github.com/HKUDS/LightRAG |
| 5 | OneKE / OpenSPG | https://github.com/OpenSPG/OneKE |
| 6 | Neo4j Social Media ETL | https://www.lbsocial.net/post/social-media-knowledge-graph-python-neo4j |
| 7 | GraphRAG vs HippoRAG vs PathRAG | https://medium.com/graph-praxis/graphrag-vs-hipporag-vs-pathrag-vs-og-rag |
| 8 | HyperGraphRAG (NeurIPS 2025) | https://neurips.cc/virtual/2025/poster/115764 |
| 9 | GraphRAG 2026 买家指南 | https://medium.com/@tongbing00/graphrag-in-2026 |
| 10 | Neo4j Twitter 数据分析 | https://towardsdatascience.com/using-neo4j-graph-database-to-analyze-twitter-data |
