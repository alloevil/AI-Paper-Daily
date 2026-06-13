#!/bin/bash
# restore-deps.sh — 容器重置后恢复 Python 依赖
# 执行方式：bash scripts/restore-deps.sh
set -e

echo "🔧 恢复 Python 依赖..."

# 修复 setuptools（容器重置后可能损坏）
sudo pip3 install --break-system-packages --force-reinstall setuptools 2>/dev/null || true

# 安装 feedparser（daily_news.py 依赖）
sudo pip3 install --break-system-packages feedparser 2>/dev/null || \
    pip3 install --break-system-packages feedparser

# 验证
python3 -c "import feedparser; print(f'✅ feedparser {feedparser.__version__}')"

echo "✅ Python 依赖恢复完成"
