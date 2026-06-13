# RSS 新闻筛选项目

## 目标
定时抓取 RSS → 去重 + 排噪音 → AI 语义精筛 → 飞书推送

## 架构
1. **数据源（三层）**：
   - RSS 自动抓取：`scripts/rss_fetch.py`（12 个 RSS 源 + 去重 + 反向噪音过滤 + 打标签，并发抓取 + 当日缓存）
   - 百度搜索补充：Playwright 抓取 8 个无 RSS 源的新闻
   - **飞书表格**：瑞林手动维护的高质量新闻数据库（`AT5OsAtLkhdNlytNmt7cHKEOnkc`），作为参考源读取，**禁止写入**
2. **精筛**：AI 语义判断，基于"信息增量"标准筛选 8-12 条最有价值新闻
3. **推送**：announce 到飞书 DM（不写入瑞林的飞书表格）

## 筛选逻辑（核心）

**脚本只做三件事：**
1. 采集（18 个 RSS + 8 个百度搜索，并发抓取）
2. 去重（标题+URL 路径 hash）
3. 反向过滤（排除体育、娱乐、房产、游戏等明显噪音）

**脚本不做筛选，不靠关键词挑好新闻。**

**AI 精筛标准：信息增量**

核心问题：这条新闻的信息，公司内部能不能直接感知到？

- ✅ 内部感知不到 → 筛选推送（有信息增量）
- ❌ 内部已能感知 → 跳过（推过去是噪音）

### 优先级分层（Tier 体系）

按优先级从高到低处理候选新闻，达到目标数量（8-12 条）即可停止。

**Tier 1 — 必选（最高业务影响）**

| 类型 | 示例 |
|------|------|
| 政策/关税变化 | 进出口关税调整、贸易战措施、影响元器件或成品的 VAT 变化 |
| 供应链成本信号 | 面板（OLED/LCD）价格走势、DRAM/NAND 合约价、PMIC/RF 器件短缺或过剩 |
| 地缘政治物流影响 | 港口中断、供应商制裁、航运通道关闭 |
| 宏观经济指标 | PMI 读数、CPI/PPI 数据、关键市场（中国/印度/欧盟/东南亚）滞胀预测 |

**Tier 2 — 配额允许时选入**

| 类型 | 示例 |
|------|------|
| 竞争格局变动 | 市场份额重排、品类级战略转向（非单个 SKU 发布） |
| 芯片/晶圆厂路线图 | 台积电/三星制程产能、高通/联发科路线图变化、海思回归信号 |
| 平台/OS 生态动作 | Android 政策变化、应用商店监管、Google/Microsoft 企业策略转型 |

**Tier 3 — 仅在配额未满时选入**

| 类型 | 示例 |
|------|------|
| 消费者情绪趋势 | 换机周期调查、品牌感知度研究 |
| 产品安全法规更新 | 目标市场新认证要求 |

### 排除规则

符合以下**任一条**即排除：

1. **小米内部数据** — 新闻稿、财报评论、产品发布、高管声明
2. **竞品单纯发布会/产品发布** — 除非暗示价格战或供应重新分配
3. **无直接业务影响的泛科技新闻** — AI 炒作文章、软件版本日志、App 评测
4. **重复信号** — 两条覆盖同一事件，留数据更具体的那条（数据 > 叙述）
5. **无原始数据的纯观点/分析** — 不引用一手数据源的社论

### 5 步决策清单

对每条候选新闻，依次问：

1. 是否包含**具体数字、政策原文或命名数据点**？→ 无具体数据 → Tier 3 或排除
2. 该事件是否**改变了小米或其供应链的成本、约束或市场准入条件**？→ 是 → Tier 1/2
3. 主体是否是**小米自身**或**竞品产品发布**？→ 是 → 排除
4. 是否已选入**实质相同**的新闻？→ 是 → 排除重复
5. 是否影响**小米 Top 5 收入市场之一**（中国/印度/西欧/东南亚/拉美）？→ 否 → 降级到 Tier 3

### 与飞书表格的关系
- 飞书表格是参考源（瑞林手动维护的高质量新闻），不是去重依据
- 精筛时**不跟表格去重**——表格没收录的不等于没有信息增量
- 可以参考表格的**风格和质量**来判断标准

### 典型产出
- 原始候选：150-250 条
- 排除规则后：~60 条
- Tier 排序 + 去重后：8-12 条
- 典型分布：Tier 1（5-7 条）+ Tier 2（3-4 条）+ Tier 3（0-2 条）

**输出规则：**
- 每条必须带来源链接
- 推送到 DM，不写入瑞林的飞书表格
- 筛选 8-12 条，不足 8 条时如实说明而非凑数

## 新闻源列表

### RSS 源（18 个，并发抓取）

**泛科技（7 个）：**
| 名称 | RSS URL | 特点 |
|------|---------|------|
| IT之家 | https://www.ithome.com/rss/ | 科技新闻，快讯快 |
| 36Kr | https://36kr.com/feed | 科技新闻，信息提炼好 |
| 华尔街见闻 | https://plink.anyfeeder.com/weixin/wallstreetcn | 全球金融，跨境资本 |
| Readhub | https://readhub.cn/rss | 互联网、AI，早报质量高 |
| 钛媒体 | https://www.tmtpost.com/rss.xml | 出海资讯、行研报告 |
| 联合早报 | https://plink.anyfeeder.com/zaobao/realtime/china | 时事新闻、国际动态 |
| 爱范儿 | https://www.ifanr.com/feed | 消费电子、产品评测 |

**半导体/供应链（2 个）：**
| 名称 | RSS URL | 特点 |
|------|---------|------|
| 爱集微 | https://www.laoyaoba.com/api/rss/hbb | 半导体领域，芯片行业 |
| TrendForce | https://www.trendforce.com/news/rss | 半导体产业研究，面板/存储/LED |

**手机行业（4 个）：**
| 名称 | RSS URL | 特点 |
|------|---------|------|
| CNBeta | https://rss.cnbeta.com/rss | 科技综合，速度快 |
| GSMArena | https://www.gsmarena.com/rss-news-reviews.php3 | 全球手机评测，硬件规格 |
| Android Authority | https://www.androidauthority.com/feed/ | Android 生态，深度分析 |
| 9to5Google | https://9to5google.com/feed/ | Google/Android 生态动态 |

**国际财经/政策（4 个）：**
| 名称 | RSS URL | 特点 |
|------|---------|------|
| Reuters World | https://feeds.reuters.com/Reuters/worldNews | 全球时事 |
| Reuters Tech | https://feeds.reuters.com/reuters/technologyNews | 科技政策 |
| Barron's | https://plink.anyfeeder.com/barrons/international-markets | 国际市场 |
| SCMP Tech | https://www.scmp.com/rss/5/feed | 亚太科技 |

**硅谷/海外科技（1 个）：**
| 名称 | RSS URL | 特点 |
|------|---------|------|
| TechCrunch | https://techcrunch.com/feed/ | 硅谷科技创投，一手消息 |

> **已移除失效源**：36Kr出海（RSS 不可用，返回 SPA）、财新（解析失败）、手机中国（WAF 拦截）
> **海外源在当前网络不可达但保留**：Reuters、SCMP、Barron's — 换网络环境可用

### 百度搜索补充源（无 RSS，Playwright 抓取）
| 名称 | 搜索词 | 补充方向 |
|------|--------|----------|
| 第一财经 | 第一财经 今日 财经新闻 | 财经 |
| 财联社 | 财联社 最新 快讯 | 宏观 |
| 新浪财经 | 新浪财经 今日 宏观 | 宏观 |
| ITBEAR | ITBEAR 人工智能 最新 | AI |
| 晚点LatePost | 晚点LatePost 最新 独家 | 深度 |
| TechWeb | TechWeb 最新 科技新闻 | 科技 |
| 手机行业趋势（新增） | 智能手机 行业 2025 2026 趋势 出货量 | 行业趋势 |
| 小米地缘政治影响（新增） | 小米 关税 制裁 海外 市场 印度 欧洲 | 政策风险 |

### 飞书表格源（参考源，禁止写入）
- **表格**：新闻资讯写入（`AT5OsAtLkhdNlytNmt7cHKEOnkc`）
- **URL**：`https://mi.feishu.cn/wiki/NWbMwM1Upi9ESEk958RcrRz5nRe`
- **用途**：瑞林手动维护的高质量新闻数据库，cron 任务触发时读取最近几天的数据用于去重和风格参考
- **格式**：标题 / 正文（深度分析段落 + 多信源引用） / 链接 / 记录时间
- **⚠️ 严禁写入**：不要向此表格写入任何数据，它是纯参考源

## Cron 配置
- **ID**：`286de795-5a23-4c9f-9d67-74b0c071bdd9`
- **名称**：每日科技情报
- **调度**：每天 9:00（`cron 0 9 * * *`，Asia/Shanghai）
- **投递**：announce → 飞书 → `ou_263211665045f37c3b85dc85be8df441`（best-effort）

## 输出格式（必须严格遵守）

```
20260325

供应链成本

1. 英特尔和 AMD 通知 3-4 月 CPU 涨价
  - 来源：[36Kr](https://36kr.com/newsflashes/3737881960546562?f=rss)

芯片/技术趋势

2. Arm AGI CPU：136 核 3nm，进入服务器市场
  - 来源：[IT之家](https://www.ithome.com/0/932/432.htm)

出海/全球化

3. 比亚迪加拿大扩张：首年开 20 家门店
  - 来源：[IT之家](https://www.ithome.com/0/932/356.htm)

宏观/地缘

4. 摩根大通：全球石油供应缺口千万桶/日
  - 来源：[华尔街见闻](https://wallstreetcn.com/...)

====== English Daily Briefing ======

20260325

Supply Chain

1. Intel and AMD raise CPU prices for March-April
  - Source: [36Kr](https://36kr.com/newsflashes/3737881960546562?f=rss)
```

### 输出格式规则
- 中文部分在前，英文部分在后，用 `====== English Daily Briefing ======` 分隔
- 分类：供应链成本、芯片/技术趋势、出海/全球化、宏观/地缘、手机行业、其他
- 没有新闻的分类不输出
- **每条必须带来源链接**，格式 `- 来源：[来源名](URL)` / `- Source: [Source Name](URL)`
- 筛选 8-12 条最有价值新闻

## 执行链路（2026-03-26 改造）

### 问题根因
cron prompt 里写"先读知识库"是**软约束**，AI 可能跳过。旧逻辑每次都在猜 AI 会不会遵守。

### 新方案：脚本封装执行链路
核心脚本：`scripts/daily_news.py`

**执行流程（代码保证，不依赖 AI 自觉）：**
1. 从 `knowledge/技术方案/RSS新闻筛选项目.md` 动态提取"筛选逻辑（核心）"和"输出格式"两段
2. 调用 `rss_fetch.py` 抓候选新闻（当前环境约 130+ 条）
3. 将精筛标准 + 候选新闻拼成完整 prompt → 输出到 `/tmp/daily_news_prompt.txt`
4. cron 读取 prompt，AI 精筛，推送飞书 DM

**cron prompt 模板：**
```
python3 scripts/daily_news.py
cat /tmp/daily_news_prompt.txt
```
然后 AI 执行精筛和推送。

### 关键教训
- **软约束 → 硬编码**：执行顺序必须在代码里固化，不能靠"先读知识库"的自然语言指令
- **正则 vs split**：中文全角括号（如"筛选逻辑（核心）"）用正则匹配时容易出问题，改用 `split("## ")` 方式提取段落更稳健
- **feedparser 依赖**：`pip install --break-system-packages feedparser`（容器重建后需恢复）

## 已知问题
- Google News RSS 在当前环境不可达（Network unreachable）
- latepost 超时
- 部分 feed 源需要代理或特殊网络
