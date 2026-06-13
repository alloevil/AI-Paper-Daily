# 社交媒体数据构建知识图谱：最佳实践与开源项目

> 搜索时间：2026-04-16 | 聚焦：Twitter/X、微博、Reddit 等社交媒体数据构建知识图谱

---

## 一、开源项目

### 1. GRASP-ChoQ — Twitter 政治立场检测 + 知识图谱
- **GitHub**: https://github.com/Programming-Dude/GRASP-ChoQ
- **核心功能**: 完整的 Twitter 数据分析管线：数据清洗 → 推文翻译 → 实体抽取(NER) → Neo4j 知识图谱构建 → 立场分类(Zero-Shot/Few-Shot/GRASP-ChoQ)
- **亮点**: 使用 LLM 做 Chain-of-Question 推理增强立场检测，结合知识图谱做图谱增强检索
- **适用场景**: 社交媒体舆情分析、政治立场检测、实体关系图谱
- **是否可直接用**: ✅ 是完整 pipeline，可参考改用于中文场景
- **相关论文**: GRASP-ChoQ: Knowledge Graph-Based Retrieval Augmentation for Stance Detection (ACL 2025 BanglaLP)
  - 论文链接: https://aclanthology.org/2025.banglalp-1.2/

### 2. Microsoft GraphRAG — 通用知识图谱构建框架（可用于社交媒体）
- **GitHub**: https://github.com/microsoft/graphrag （22k+ Stars）
- **核心功能**: 从非结构化文本中自动抽取实体关系，构建知识图谱 + 社区层次结构 + 社区摘要，支持 local/global 两种检索模式
- **适用场景**: 社交媒体文本（推文、论坛帖子）→ KG → 问答/摘要
- **是否可直接用**: ✅ 成熟框架，直接 feed 社交媒体文本即可
- **文档**: https://microsoft.github.io/graphrag/
- **官方博客**: https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/

### 3. OneKE — 基于 LLM 的知识抽取框架
- **GitHub**: https://github.com/OpenSPG/OneKE
- **核心功能**: Schema-guided 知识抽取，支持从社交媒体、网页、PDF 等多源数据中抽取实体和关系
- **亮点**: 阿里达摩院 OpenSPG 生态，Docker 化部署，支持中文
- **适用场景**: 中文社交媒体实体关系抽取、通用 KG 构建
- **是否可直接用**: ✅ 开箱即用

### 4. Combining KGs and Deep Learning for Categorizing Tweets
- **GitHub**: https://github.com/knowledgeb/Combining-Knowledge-Graphs-and-Deep-Learning-techniques-for-Categorizing-Tweets
- **作者**: José Alberto Benítez-Andrades 等（León 大学）
- **核心功能**: 从 Twitter 文本中抽取实体 → 映射到 Wikidata → RDF2Vec embedding → KG 增强文本分类
- **数据**: 2000 条 Twitter 饮食障碍相关推文，4 类标签
- **核心结论**: 知识图谱语义增强显著提升 ML/DL 模型在文本分类上的表现
- **适用场景**: 医疗健康社交媒体分析、KG 增强的推文分类
- **是否可直接用**: ⚠️ 学术 demo，需自行适配

### 5. twitter-graph — Twitter 社交关系图谱可视化
- **GitHub**: https://github.com/eleurent/twitter-graph
- **核心功能**: 抓取 Twitter 好友/粉丝关系，构建社交图谱，用 Gephi 可视化
- **适用场景**: 社交网络分析、影响力分析
- **是否可直接用**: ✅ 轻量级，适合快速分析社交关系

### 6. twitter-research/tgn — 时序图网络
- **GitHub**: https://github.com/twitter-research/tgn
- **核心功能**: 处理动态图（节点/边随时间变化）的深度学习框架，支持 Wikipedia/Reddit 数据集
- **适用场景**: 社交网络动态关系建模、用户交互预测
- **是否可直接用**: ⚠️ 研究级代码，需适配具体任务

### 7. neo4j-graph-examples/twitter-v2 — Neo4j Twitter 图谱示例
- **GitHub**: https://github.com/neo4j-graph-examples/twitter-v2
- **核心功能**: Neo4j 官方 Twitter 数据模型示例，包含 User/Tweet/Hashtag/Link 等节点类型及关系
- **适用场景**: 学习社交媒体数据在 Neo4j 中的建模方式
- **是否可直接用**: ✅ 可直接在 Neo4j 中运行

### 8. GraphAware neo4j-nlp — Neo4j NLP 插件
- **GitHub**: https://github.com/graphaware/neo4j-nlp
- **核心功能**: Neo4j 的 NLP 插件，支持实体抽取、关键词提取、情感分析，可对接 Stanford NLP / OpenNLP
- **适用场景**: 在 Neo4j 中直接对文本做 NLP 处理并构建图谱
- **是否可直接用**: ⚠️ 插件较老，建议配合 LLM 方案使用

### 9. OpenAI Temporal Agents with Knowledge Graphs
- **GitHub**: https://github.com/openai/openai-cookbook/blob/main/examples/partners/temporal_agents_with_knowledge_graphs/temporal_agents.ipynb
- **核心功能**: OpenAI 官方 Cookbook，展示如何用知识图谱构建时序感知 Agent，处理社交媒体等时效性数据
- **适用场景**: 社交媒体信息的时效性管理、过期知识检测
- **是否可直接用**: ✅ Jupyter notebook 可直接参考

### 10. KGCP — Knowledge Graph Construction Pipeline
- **GitHub**: https://github.com/KGCP
- **核心功能**: KG 构建生态工具集，自动化 KG 构建中的多种任务
- **适用场景**: 通用 KG 构建流水线
- **是否可直接用**: ⚠️ 生态项目，需自行组装

### 11. Social-Knowledge-Graph-Papers — 社交知识图谱论文合集
- **GitHub**: https://github.com/jxh4945777/Social-Knowledge-Graph-Papers
- **核心功能**: 社交网络+知识图谱+社会计算的论文列表、笔记和数据集汇总（中英文）
- **适用场景**: 研究调研、论文检索
- **价值**: 包含大量社交 KG 相关研究的系统性整理

### 12. NANTA — 多源知识图谱构建工具
- **GitHub**: https://github.com/Okohedeki/NANTA
- **核心功能**: 从 Twitter/X、YouTube 等多源数据中抽取实体和关系，构建可视化知识图谱
- **适用场景**: 跨平台社交媒体 KG 构建

### 13. EdgeQuake — 高性能知识图谱实体抽取
- **GitHub**: https://github.com/raphaelmansuy/edgequake
- **核心功能**: 自动检测 7 种实体类型（人物、组织、地点、概念、事件、技术、产品），构建知识图谱
- **适用场景**: 社交媒体实体抽取

---

## 二、论文案例

### 1. GRASP-ChoQ: KG-Based Retrieval Augmentation for Stance Detection
- **作者**: Programming-Dude 团队
- **年份**: 2025
- **数据**: Twitter 政治推文（孟加拉国 Awami League 相关）
- **方法**: 结合知识图谱 + Chain-of-Question 推理增强立场检测
- **核心结论**: KG 增强的 RAG 方法在政治立场检测上优于传统 Zero/Few-Shot 方法
- **链接**: https://aclanthology.org/2025.banglalp-1.2/

### 2. Using social media data to construct and analyze knowledge graph (rainstorm/flood)
- **年份**: 2024
- **数据**: 社交媒体数据（灾害相关）
- **方法**: 从社交媒体数据中构建暴雨洪涝事件知识图谱，实现时空分析
- **核心结论**: 提出了社交媒体数据驱动 KG 构建的框架，可用于灾害响应
- **链接**: https://www.sciencedirect.com/science/article/pii/S2212420924008914

### 3. Retrieval-Augmented Generation with Graphs (GraphRAG) — 综述
- **年份**: 2025
- **内容**: GraphRAG 领域首篇全面综述，涵盖 KG 构建、图结构检索、社交媒体应用
- **链接**: https://arxiv.org/abs/2501.00309

### 4. SKG-Learning: Deep Learning Model for Sentiment KG Construction in Social Networks
- **年份**: 2022
- **内容**: 在社交网络中构建情感知识图谱的深度学习模型
- **链接**: 见 https://dl.acm.org/doi/abs/10.1145/3650400.3650472 引用

### 5. Enhancing Social Network Analysis Through NLP, Knowledge Graphs
- **来源**: AUT 大学博士论文
- **内容**: NLP + KG 分析社交媒体内容，检测回音室、缓解虚假信息、最大化影响力
- **链接**: https://openrepository.aut.ac.nz/bitstreams/78f4d7d7-7844-417d-854f-9871ed0f8ef3/download

### 6. Graph-based Multi-modal Fake News Detection (GraMuFeN)
- **年份**: 2024
- **数据**: Twitter + 微博
- **方法**: 图神经网络做多模态假新闻检测
- **链接**: https://link.springer.com/article/10.1007/s13278-024-01267-0

### 7. Social Media Sentiment Analysis and Opinion Mining in Public Security — 综述
- **链接**: https://www.sciencedirect.com/science/article/pii/S1319157823003300

---

## 三、最佳实践/教程

### 1. Building a Social Media Knowledge Graph with Python & Neo4j
- **来源**: https://www.lbsocial.net/post/social-media-knowledge-graph-python-neo4j
- **核心思路**: Python ETL pipeline → 将嵌套 JSON 社交媒体帖子 → Neo4j 图谱建模 → Cypher 查询分析
- **技术栈**: Python + Neo4j + Faker(模拟数据) + ETL

### 2. Social Media Knowledge Graph: Building with Python & Neo4j (YouTube)
- **来源**: https://www.youtube.com/watch?v=dHSnucKW2eI
- **核心思路**: 从零构建社交媒体知识图谱，揭示用户/推文/话题之间的隐藏关系

### 3. Graphing with Neo4j: Using Graphs to Analyse Twitter Data
- **来源**: https://medium.com/@johannajones00/graphing-with-neo4j-using-graphs-to-analyse-twitter-data-918d35e6de0c
- **核心思路**: Neo4j 图数据库存储和分析 Twitter 数据的完整教程

### 4. Applying NLP and Entity Extraction to the Russian Twitter Troll Dataset
- **来源**: https://lyonwj.com/blog/entity-extraction-russian-troll-tweets-neo4j
- **核心思路**: 对俄罗斯 Troll 推文做实体抽取 → Neo4j 图谱建模 → 发现信息操纵模式
- **技术栈**: Neo4j + Stanford NLP + Python
- **亮点**: 真实数据集、完整 pipeline

### 5. Graph-RAG Twitter Intelligence System
- **来源**: https://medium.com/@choudhary.man/graph-rag-twitter-intelligence-system-a-laymans-guide-to-social-media-ai-with-technical-muscle-efd7412c4abd
- **核心思路**: 完整的 GraphRAG pipeline：推文摄入 → NLP 增强 → 知识图谱 → 智能问答
- **技术栈**: GraphRAG + LLM + NLP Pipeline

### 6. Neo4j: Converting Unstructured Text to Knowledge Graphs
- **来源**: https://neo4j.com/blog/developer/unstructured-text-to-knowledge-graph/
- **核心思路**: 使用 LLM 从非结构化文本中抽取实体关系构建 KG（适用于社交媒体文本）

### 7. OSCON Twitter Graph — Neo4j 官方示例
- **来源**: https://neo4j.com/blog/developer/oscon-twitter-graph/
- **核心思路**: 用 Twitter Search API 搜索话题 → 构建 User/Tweet/Hashtag/Link 图谱

### 8. HuggingFace Cookbook: RAG with Knowledge Graphs
- **来源**: https://huggingface.co/learn/cookbook/rag_with_knowledge_graphs_neo4j
- **核心思路**: Neo4j + KG 增强 RAG 的实战教程

### 9. Building Dynamic KGs Using Open Source LLMs
- **来源**: https://medium.com/thoughts-on-machine-learning/building-dynamic-knowledge-graphs-using-open-source-llms-06a870e1bc4f
- **核心思路**: 使用开源 LLM 构建动态知识图谱，适用于社交媒体等实时数据源

---

## 四、技术栈组合

### 主流技术栈组合

| 层次 | 工具选择 | 说明 |
|------|---------|------|
| **数据采集** | Twitter API v2 / snscrape / 微博 API / Reddit API (PRAW) | 获取原始社交媒体数据 |
| **文本预处理** | spaCy / jieba(中文) / NLTK | 分词、清洗、去噪 |
| **实体抽取 (NER)** | spaCy NER / BERT-NER / OneKE / LLM(GPT-4/Qwen) | 从短文本中识别实体 |
| **关系抽取** | REBEL / OpenIE / LLM prompt-based extraction | 抽取实体间关系 |
| **情感分析** | TextBlob / VADER / BERT-sentiment / SenticNet | 情感极性判断 |
| **知识图谱存储** | Neo4j / NetworkX / RDF/OWL (Protégé) / NebulaGraph | 图数据存储与查询 |
| **图谱嵌入** | RDF2Vec / TransE / ComplEx / PyKEEN | 图谱向量化 |
| **GraphRAG** | Microsoft GraphRAG / LlamaIndex / LangChain Neo4j | 图谱增强检索生成 |
| **可视化** | Gephi / Neo4j Bloom / D3.js / PyVis | 图谱可视化 |
| **LLM** | GPT-4o / DeepSeek-R1 / Qwen3 / LLaMA | 实体/关系抽取、摘要 |

### 推荐组合（中文社交媒体场景）

```
数据源: 微博 API / Twitter API v2
  ↓
预处理: Python + jieba + re
  ↓
实体关系抽取: OneKE (阿里 OpenSPG) 或 LLM (Qwen/GPT-4o)
  ↓
情感分析: BERT-chinese-sentiment 或 LLM prompt
  ↓
图谱存储: Neo4j (推荐) 或 NebulaGraph
  ↓
检索增强: Microsoft GraphRAG 或 LangChain + Neo4j
  ↓
应用层: 舆情分析 Dashboard / 智能问答 / 趋势发现
```

### 推荐组合（英文社交媒体场景）

```
数据源: Twitter API v2 / Reddit API (PRAW)
  ↓
预处理: Python + spaCy + tweet-preprocessor
  ↓
实体关系抽取: REBEL / spaCy + LLM
  ↓
情感分析: VADER / RoBERTa-sentiment
  ↓
图谱存储: Neo4j
  ↓
检索增强: Microsoft GraphRAG
  ↓
应用层: 舆情监控 / 事件追踪 / 用户画像
```

---

## 五、重点关注：中文社交媒体（微博）相关

### 现有资源
1. **Social-Knowledge-Graph-Papers** (中文整理): https://github.com/jxh4945777/Social-Knowledge-Graph-Papers
2. **OneKE** (阿里达摩院，支持中文): https://github.com/OpenSPG/OneKE
3. **OwnThink 中文知识图谱** (1.4亿三元组): https://github.com/ownthink/knowledgegraphdata — 通用中文 KG，可作为背景知识库补充
4. **KgCLUE** (中文 KG 问答 benchmark): https://github.com/CLUEbenchmark/KgCLUE
5. **EKBSA** (中文情感分析 + KG): 使用情感知识图谱增强 K-BERT 的中文情感分析模型
   - 链接: https://www.sciopen.com/article/10.1007/s11390-024-2870-9

### 微博 KG 构建建议
- 微博数据短文本特征明显，建议用 LLM 做实体/关系抽取（效果优于传统 pipeline）
- 可结合 OwnThink 等通用 KG 做实体链接和消歧
- 中文分词推荐 jieba 或 pkuseg，NER 推荐 OneKE 或 BERT-chinese-NER
- 微博转发/评论关系天然构成社交图谱，可直接映射为 KG 关系

---

## 六、总结

### 关键发现
1. **没有专门的"微博/Twitter → 知识图谱"一站式开源项目**，需要自行组装 pipeline
2. **最成熟的通用方案**: Microsoft GraphRAG + Neo4j，feed 社交媒体文本即可
3. **Twitter 专项最佳参考**: GRASP-ChoQ（完整 pipeline + 论文）和 Neo4j Twitter 示例
4. **中文场景首选**: OneKE（阿里）做实体抽取 + Neo4j 做存储
5. **情感 + KG 结合**: SenticNet 做情感知识库，或 LLM prompt 同时抽取情感和实体关系

### 快速启动路径
1. 采集数据 → 2. LLM 抽取实体关系 → 3. 导入 Neo4j → 4. 用 GraphRAG 做检索问答 → 5. 可视化分析
