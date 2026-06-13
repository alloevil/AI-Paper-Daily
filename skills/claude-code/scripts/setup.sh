#!/bin/bash
# Claude Code 一键安装配置脚本
# 用法: bash scripts/setup.sh [API_KEY]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
WORKSPACE="$(dirname "$SKILL_DIR")"

# 获取 API Key
API_KEY="${1:-}"
if [ -z "$API_KEY" ]; then
  # 尝试从 openclaw.json 自动获取
  API_KEY=$(python3 -c "
import json
with open('$HOME/.openclaw/openclaw.json') as f:
    print(json.load(f)['models']['providers']['openai']['apiKey'])
" 2>/dev/null || echo "")
fi

if [ -z "$API_KEY" ]; then
  echo "❌ 无法获取 API Key，请手动指定:"
  echo "   bash $0 <API_KEY>"
  exit 1
fi

echo "📦 安装 Claude Code..."
cd "$WORKSPACE"
npm install @anthropic-ai/claude-code --save --cache /tmp/npm-cache 2>&1 | tail -1

echo "📝 写入配置..."
mkdir -p /home/node/.claude

cat > /home/node/.claude/settings.json << EOF
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://model.mify.ai.srv/anthropic",
    "ANTHROPIC_API_KEY": "$API_KEY",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "xiaomi/mimo-v2-pro-mit",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "xiaomi/mimo-v2-pro-mit",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "xiaomi/mimo-v2-omni"
  }
}
EOF

cat > /home/node/.claude.json << 'EOF'
{"hasCompletedOnboarding": true}
EOF

echo "✅ 验证..."
HOME=/home/node "$WORKSPACE/node_modules/.bin/claude" -p "say hello" --output-format json 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'   模型: {list(d.get(\"modelUsage\",{}).keys())[0]}')
print(f'   响应: {d[\"result\"][:50]}')
print(f'   耗时: {d[\"duration_ms\"]}ms')
" 2>/dev/null

echo ""
echo "🎉 Claude Code 安装配置完成！"
echo "   使用: HOME=/home/node $WORKSPACE/node_modules/.bin/claude -p \"你的问题\""
