#!/bin/bash
# gBrain 一键安装脚本
# 用法: bash scripts/install-gbrain.sh
# 需要: git, node (已有)
set -e

echo "🧠 gBrain 安装开始..."

# Step 1: 安装 bun（如果没有）
if ! command -v bun &>/dev/null; then
  echo "📦 安装 bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
  echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
  echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.zshrc 2>/dev/null || true
fi

echo "✅ bun $(bun --version)"

# Step 2: 克隆 gBrain
if [ ! -d ~/gbrain ]; then
  echo "📥 克隆 gBrain..."
  git clone https://github.com/garrytan/gbrain.git ~/gbrain
fi

# Step 3: 安装依赖
echo "📦 安装 gBrain 依赖..."
cd ~/gbrain
bun install
bun link

# Step 4: 验证
echo "🔍 验证安装..."
gbrain --version

# Step 5: 初始化 brain（PGLite，零配置）
echo "🧠 初始化 brain..."
gbrain init

# Step 6: 创建 brain 仓库目录
mkdir -p ~/brain && cd ~/brain
if [ ! -d .git ]; then
  git init
  echo "# My Brain" > README.md
  git add . && git commit -m "init brain"
fi

echo ""
echo "✅ gBrain 安装完成！"
echo ""
echo "📋 下一步："
echo "1. 设置 API Key（可选但推荐）："
echo "   export OPENAI_API_KEY=sk-..."
echo ""
echo "2. 导入已有知识："
echo "   gbrain import ~/brain/ --no-embed"
echo "   gbrain embed --stale"
echo ""
echo "3. 验证："
echo "   gbrain doctor --json"
echo "   gbrain query '测试查询'"
