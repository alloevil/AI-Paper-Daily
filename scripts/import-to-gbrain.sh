#!/bin/bash
# gBrain 知识导入脚本
# 在 gBrain 安装完成后运行
# 用法: bash scripts/import-to-gbrain.sh
set -e

echo "📥 开始导入已有知识到 gBrain..."

BRAIN_DIR="$HOME/brain"
KB_DIR="$HOME/.openclaw/workspace/knowledge"
MEM_DIR="$HOME/.openclaw/workspace/memory"

# Step 1: 复制 knowledge/ 到 brain 仓库
echo "📁 复制 knowledge/..."
if [ -d "$KB_DIR" ]; then
  mkdir -p "$BRAIN_DIR/knowledge"
  cp -r "$KB_DIR"/* "$BRAIN_DIR/knowledge/" 2>/dev/null || true
  echo "  ✅ knowledge/ 已复制"
fi

# Step 2: 复制 MEMORY.md 和关键 memory 文件
echo "📁 复制记忆文件..."
mkdir -p "$BRAIN_DIR/memory"
cp "$HOME/.openclaw/workspace/MEMORY.md" "$BRAIN_DIR/memory/" 2>/dev/null || true

# 只复制有意义的 memory 文件（排除 dreams 和临时文件）
for f in "$MEM_DIR"/*.md; do
  fname=$(basename "$f")
  # 跳过太小的文件和临时文件
  if [ $(wc -c < "$f" 2>/dev/null || echo 0) -gt 200 ]; then
    cp "$f" "$BRAIN_DIR/memory/" 2>/dev/null || true
  fi
done
echo "  ✅ 记忆文件已复制"

# Step 3: 创建 GitHub 项目知识页面
echo "📁 创建 GitHub 项目知识页面..."
mkdir -p "$BRAIN_DIR/projects"

cat > "$BRAIN_DIR/projects/pretext.md" << 'EOF'
# pretext — 纯 JS/TS 多行文本测量库
- GitHub: chenglou/pretext
- Stars: 24k+ | 语言: TypeScript | 许可证: MIT
- 一句话: 绕过 DOM reflow 用纯算术算文本高度，24k Star 的终端/Canvas 文本布局引擎

## 核心机制
prepare() + layout() 两步走。不用 Canvas measureText，用纯 JS 算术计算每行文本高度，适用于虚拟列表、masonry、编辑器。

## 实践记录
- 移植为 pretext-term（终端版），用 wcwidth 替代 Canvas measureText
- 完成 6 个 demo：basic / multicol / prophet / dragon / screen-dragon / manuscript
- 核心算法：carveSlots() + circleBlockedInterval() 从 editorial-engine.ts 移植

## 关联项目
- pretext-term（本地移植版）
- chenglou 是 React 核心社区人物（react-motion、reason-react、前 Meta）
EOF

cat > "$BRAIN_DIR/projects/gbrain.md" << 'EOF'
# gBrain — Garry Tan 的 Agent 知识大脑
- GitHub: garrytan/gbrain
- 作者: Garry Tan（Y Combinator CEO）
- 一句话: 给 AI Agent 一个大脑，生产级知识系统

## 核心架构
- PGLite 数据库（零配置，2秒启动）
- 混合搜索（向量 + 知识图谱），0.12s 响应
- 自动知识图谱：写入时提取 typed links，零 LLM 调用
- 26 个 Skill 覆盖完整知识生命周期

## 规模验证
17,888 页 / 4,383 人 / 723 公司 / 21 cron 任务，12 天构建

## 关联项目
- OpenClaw / Hermes Agent（原生支持）
- Obsidian（可从 Obsidian 导入）
EOF

cat > "$BRAIN_DIR/projects/openspace.md" << 'EOF'
# OpenSpace — AI Agent 自进化引擎
- GitHub: HKUDS/OpenSpace
- 一句话: LLM 分析执行日志 → 自动改 SKILL.md → 三种进化模式

## 核心机制
FIX（修复错误）/ DERIVED（派生新能力）/ CAPTURED（捕获经验）

## 实践记录
- 已安装到 workspace，实跑 daily-news 任务
- 积累 4 个 Skill：direct-write-python-scripts, python-disk-monitor-script, daily-news-pipeline, xiaomi-news-curation-filter
- 注意 token 双重消耗

## 关联项目
- EvoMap/Evolver（竞争/互补关系）
EOF

cat > "$BRAIN_DIR/projects/bb-browser.md" << 'EOF'
# bb-browser — 浏览器即 API
- GitHub: epiral/bb-browser
- Stars: 3,982 | 语言: TypeScript | 许可证: MIT
- 一句话: 复用真实 Chrome 登录态，让 Agent 操作 36 个平台（126 个 adapter）

## 核心机制
CLI → Daemon → CDP WebSocket → 用户真实浏览器。原生支持 OpenClaw。

## 实践记录
- 已安装到 workspace，adapter 库已更新
- 服务器环境无法使用（需要带登录态的真实浏览器 UI）
- 结论：只适合 Mac 本地使用

## 关联项目
- Browser-Use（85k⭐，需要 headless 浏览器）
- Stagehand（21k⭐）
EOF

cat > "$BRAIN_DIR/projects/agentxray.md" << 'EOF'
# AgentXRay — AI Agent 会话日志仪表盘
- GitHub: alloevil/AgentXRay
- 一句话: Agent 会话日志的 Web 可视化工具

## 实践记录
- 写了 i18n 国际化方案（约 40 个翻译条目）
- Issue 模板已写好
- 注意：项目把 node_modules 提交进了仓库

## 关联项目
- OpenSpace（日志分析方向有交集）
EOF

cat > "$BRAIN_DIR/projects/mempalace.md" << 'EOF'
# mempalace — AI 记忆系统
- GitHub: milla-jovovich/mempalace
- 一句话: LongMemEval 基准测试最高分的记忆系统

## 核心机制
宫殿记忆法（Method of Loci）应用于 AI Agent 记忆管理

## 关联项目
- LangChain 五种记忆类型（Scratchpad/Working/Procedural/Semantic/Episodic）
- Agent Cognitive Compressor (ACC) 论文
EOF

cat > "$BRAIN_DIR/projects/evolver.md" << 'EOF'
# EvoMap/Evolver — AI Agent 自进化引擎
- GitHub: EvoMap/evolver
- 一句话: 不修改代码，扫描 memory/ 下运行日志和错误模式，输出结构化进化提示词

## 核心机制
GEP 协议资产库（Gene/Capsule）→ 选择最匹配的进化模式 → 输出进化提示词

## 实践记录
- 调研完成，写了 issue 草稿
- 与 OpenSpace 有竞争关系（EvoMap 指控 Hermes 抄了自进化设计）

## 关联项目
- OpenSpace（直接竞争）
- Hermes Agent（KEPA 机制：Knowledge/Experience/Prompt/Action 闭环）
EOF

cat > "$BRAIN_DIR/projects/superprompt.md" << 'EOF'
# SuperPrompt — Agent 提示工程项目
- GitHub: chaoren888888/SuperPrompt
- 一句话: 花数月打磨的 Agent 提示词工程，forever beta

## 核心特点
- 主要面向 Claude 设计
- 包含理论性和数学性的 meta-prompt 设计
- 社区对 Agent 提示工程的深度探索
EOF

# Step 4: 提交到 git
echo "📝 提交到 git..."
cd "$BRAIN_DIR"
git add . && git commit -m "import: 已有知识 + GitHub 项目文档" || true

# Step 5: 导入到 gBrain
echo "🧠 导入到 gBrain..."
cd ~/gbrain
gbrain import ~/brain/ --no-embed
gbrain embed --stale

# Step 6: 提取知识图谱
echo "🔗 构建知识图谱..."
gbrain extract links --source db --dry-run | head -20
echo "确认无误后运行: gbrain extract links --source db"
gbrain extract timeline --source db || true

# Step 7: 验证
echo "🔍 验证..."
gbrain doctor --json
gbrain stats

echo ""
echo "✅ 导入完成！"
echo "试试: gbrain query '瑞林关注的 GitHub 项目有哪些？'"
