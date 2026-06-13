#!/bin/bash
# Start iii-engine for agentmemory
# Usage: bash scripts/start-agentmemory.sh

set -e

ENGINE_DIR="/root/.openclaw/workspace/node_modules/@agentmemory/agentmemory"
HEALTH_URL="http://localhost:3111/agentmemory/livez"
LOG_FILE="/tmp/iii-engine.log"

# Ensure src/init.ts exists for the exec worker watcher
mkdir -p "$ENGINE_DIR/src"
echo "// placeholder for iii-exec watcher" > "$ENGINE_DIR/src/init.ts"

# Check if already running
if curl -s "$HEALTH_URL" 2>/dev/null | grep -q '"status":"ok"'; then
    echo "iii-engine already healthy on port 3111"
    exit 0
fi

# Kill any stale iii-engine process
pgrep -f "node dist/cli.mjs" >/dev/null 2>&1 && {
    echo "Killing stale iii-engine..."
    pkill -f "node dist/cli.mjs" 2>/dev/null || true
    sleep 2
}

# Start iii-engine
cd "$ENGINE_DIR"
HOME=/home/node nohup node dist/cli.mjs > "$LOG_FILE" 2>&1 &
ENGINE_PID=$!
echo "iii-engine starting (PID: $ENGINE_PID)"

# Wait for health check
for i in $(seq 1 20); do
    if curl -s "$HEALTH_URL" 2>/dev/null | grep -q '"status"'; then
        echo "iii-engine healthy on port 3111 (took ${i}s)"
        exit 0
    fi
    sleep 1
done

echo "WARNING: iii-engine may not be ready yet (check $LOG_FILE)"
exit 1
