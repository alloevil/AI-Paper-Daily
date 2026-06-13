#!/bin/bash
# setup-sudo.sh — 为 node 用户配置 NOPASSWD sudo 权限（支持自愈）
# 容器重启后首次执行，会从 workspace 恢复 sudoers 配置
# 后续执行为幂等操作，无副作用

set -e

WORKSPACE="/root/.openclaw/workspace"
PERSIST_SUDOERS="$WORKSPACE/.persist/node-sudoers"
SUDOERS_FILE="/etc/sudoers.d/node"

# 检查当前 sudo 是否可用
if sudo -u node sudo -n true 2>/dev/null; then
    echo "✅ sudo 已配置，无需操作"
    exit 0
fi

echo "⚠️  sudo 未配置，开始恢复..."

# 场景 1：有持久化备份，直接恢复
if [ -f "$PERSIST_SUDOERS" ]; then
    echo "[1/2] 从 workspace 恢复 sudoers..."
    cp -f "$PERSIST_SUDOERS" "$SUDOERS_FILE"
    chmod 440 "$SUDOERS_FILE"
    echo "[2/2] 验证配置..."
    cat "$SUDOERS_FILE"
    echo "✅ 从备份恢复成功"
    exit 0
fi

# 场景 2：首次配置（无备份）
echo "[1/3] 安装 sudo..."
apt-get update && apt-get install -y sudo

echo "[2/3] 创建 sudoers 配置..."
echo "node ALL=(ALL) NOPASSWD:ALL" > "$SUDOERS_FILE"
chmod 440 "$SUDOERS_FILE"

echo "[3/3] 备份到 workspace（持久化）..."
mkdir -p "$(dirname "$PERSIST_SUDOERS")"
cp "$SUDOERS_FILE" "$PERSIST_SUDOERS"

echo "✅ 首次配置完成，已备份到 workspace"
