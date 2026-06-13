#!/usr/bin/env bash
# feishu-send-file: 将本地文件作为 IM 附件发送给飞书用户
# 用法: ./send_file.sh <本地文件路径> <接收人 open_id>
# 示例: ./send_file.sh /tmp/backup.tar.gz ou_263211665045f37c3b85dc85be8df441

set -e

FILE_PATH="$1"
RECEIVE_ID="$2"

if [ -z "$FILE_PATH" ] || [ -z "$RECEIVE_ID" ]; then
  echo "用法: $0 <文件路径> <open_id>" >&2
  exit 1
fi

if [ ! -f "$FILE_PATH" ]; then
  echo "文件不存在: $FILE_PATH" >&2
  exit 1
fi

FILE_NAME=$(basename "$FILE_PATH")

# 步骤1: 从 openclaw.json 读取 appId / appSecret
APP_ID=$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d["channels"]["feishu"]["appId"])' ~/.openclaw/openclaw.json)
APP_SECRET=$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d["channels"]["feishu"]["appSecret"])' ~/.openclaw/openclaw.json)

# 步骤2: 换取 tenant_access_token
TENANT_TOKEN=$(curl -sf -X POST "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal" \
  -H "Content-Type: application/json" \
  -d "{\"app_id\":\"$APP_ID\",\"app_secret\":\"$APP_SECRET\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["tenant_access_token"])')

echo "✅ Token 已获取"

# 步骤3: 上传文件，拿 file_key
FILE_KEY=$(curl -sf -X POST "https://open.feishu.cn/open-apis/im/v1/files" \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -F "file_type=stream" \
  -F "file_name=$FILE_NAME" \
  -F "file=@$FILE_PATH" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["file_key"])')

echo "✅ 文件已上传: $FILE_KEY"

# 步骤4: 发送 IM 文件消息
RESULT=$(curl -sf -X POST "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id" \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"receive_id\":\"$RECEIVE_ID\",\"msg_type\":\"file\",\"content\":\"{\\\"file_key\\\":\\\"$FILE_KEY\\\"}\"}")

MSG_ID=$(echo "$RESULT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["message_id"])')
echo "✅ 发送成功: $MSG_ID"
