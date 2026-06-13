#!/bin/bash
# MemPalace 分批增量同步脚本
# 每批处理 20 个文件，批间隔 5 秒

export PYTHONPATH=~/.openclaw/workspace/.mempalace-install
export HOME=~/.openclaw/workspace/.mempalace-home
WORKSPACE=/root/.openclaw/workspace
BATCH_SIZE=20
BATCH_INTERVAL=5
TOTAL=0
BATCH=0

echo "=== MemPalace 分批同步开始 $(date) ==="

while true; do
    BATCH=$((BATCH + 1))
    echo ""
    echo "--- 第 ${BATCH} 批 ($(date)) ---"
    
    OUTPUT=$(python3 -m mempalace mine "$WORKSPACE" --limit $BATCH_SIZE --agent mempalace 2>&1)
    EXIT_CODE=$?
    echo "$OUTPUT"
    
    # 检查是否有新 drawer 被处理
    NEW_DRAWERS=$(echo "$OUTPUT" | grep -oP '\d+(?= new drawer)' || echo "0")
    TOTAL=$((TOTAL + NEW_DRAWERS))
    
    # 如果输出中包含 "Nothing to mine" 或处理了 0 个文件，说明全部完成
    if echo "$OUTPUT" | grep -qi "nothing to mine\|no new files\|0 new\|already processed"; then
        echo ""
        echo "✅ 全部完成！总计新增约 ${TOTAL} 个 drawer"
        break
    fi
    
    if [ $EXIT_CODE -ne 0 ]; then
        echo "⚠️ 退出码 $EXIT_CODE，继续..."
    fi
    
    echo "等待 ${BATCH_INTERVAL} 秒..."
    sleep $BATCH_INTERVAL
done

echo "=== 同步结束 $(date) ==="
