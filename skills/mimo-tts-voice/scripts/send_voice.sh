#!/usr/bin/env bash
# mimo-tts-voice: 调用 mimo-v2-tts 合成语音/唱歌并发送飞书语音消息
# 用法: send_voice.sh <文本内容> <接收人 ID> [voice] [style_tag] [id_type]
#
# 参数:
#   文本内容     要合成的文字（支持音频标签，如「（轻声）...」）
#   接收人 ID    飞书 open_id（ou_xxx）或 chat_id（oc_xxx）
#   voice        音色（默认 mimo_default，可选 default_zh / default_eh）
#   style_tag    风格标签（可选，如 "开心" "东北话" "唱歌"），不含 <style> 标签
#                ⚠️ 唱歌风格必须单独使用，不可与其他风格混用
#   id_type      open_id（默认）或 chat_id
#
# 示例:
#   send_voice.sh "你好！" ou_xxx
#   send_voice.sh "哎呀妈呀！" ou_xxx mimo_default 东北话
#   send_voice.sh "两只老虎跑得快" oc_xxx mimo_default 唱歌 chat_id

set -e

TEXT="$1"
RECEIVE_ID="$2"
VOICE="${3:-mimo_default}"
STYLE_TAG="$4"
ID_TYPE="${5:-open_id}"

if [ -z "$TEXT" ] || [ -z "$RECEIVE_ID" ]; then
    echo "用法: $0 <文本> <id> [voice] [style_tag] [id_type]" >&2
    exit 1
fi

# 用 Python 处理全部逻辑，避免 shell 对 <style> 标签的转义问题
python3 - "$TEXT" "$RECEIVE_ID" "$VOICE" "$STYLE_TAG" "$ID_TYPE" << 'PYEOF'
import sys, json, base64, urllib.request, wave, subprocess, os

text, receive_id, voice, style_tag, id_type = sys.argv[1:]

api_key = os.environ.get('MODEL_API_KEY', '')
if not api_key:
    print("❌ 未找到 MODEL_API_KEY 环境变量", file=sys.stderr)
    sys.exit(1)

# 拼入 style 标签（在 Python 里处理，不经过 shell 转义）
if style_tag:
    synth_text = f"<style>{style_tag}</style>{text}"
else:
    synth_text = text

# 唱歌场景 user message 不同
user_msg = "请唱这首歌" if style_tag == "唱歌" else "请朗读以下内容"

# 步骤1: 调用 mimo-v2-tts
payload = json.dumps({
    "model": "xiaomi/mimo-v2-tts",
    "messages": [
        {"role": "user", "content": user_msg},
        {"role": "assistant", "content": synth_text}
    ],
    "audio": {"format": "wav", "voice": voice}
}).encode()

req = urllib.request.Request(
    "http://model.mify.ai.srv/v1/chat/completions",
    data=payload,
    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    method="POST"
)
with urllib.request.urlopen(req) as r:
    data = json.load(r)

audio_b64 = data["choices"][0]["message"]["audio"]["data"]
audio_bytes = base64.b64decode(audio_b64)

wav_path = "/tmp/tts_voice_out.wav"
with open(wav_path, "wb") as f:
    f.write(audio_bytes)
print(f"✅ 语音合成完成 ({len(audio_bytes)} bytes)")

# 步骤2: 读取时长
with wave.open(wav_path, "rb") as wf:
    duration_ms = int(wf.getnframes() / wf.getframerate() * 1000)

# 步骤3: 换取飞书 token
with open(os.path.expanduser('~/.openclaw/openclaw.json')) as f:
    cfg = json.load(f)
app_id = cfg['channels']['feishu']['appId']
app_secret = cfg['channels']['feishu']['appSecret']

req2 = urllib.request.Request(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    data=json.dumps({"app_id": app_id, "app_secret": app_secret}).encode(),
    headers={'Content-Type': 'application/json'}, method='POST'
)
with urllib.request.urlopen(req2) as r:
    token = json.load(r)['tenant_access_token']

# 步骤4: 上传音频
result = subprocess.run([
    'curl', '-sf', '-X', 'POST',
    'https://open.feishu.cn/open-apis/im/v1/files',
    '-H', f'Authorization: Bearer {token}',
    '-F', 'file_type=opus',
    '-F', 'file_name=voice.wav',
    '-F', f'file=@{wav_path}'
], capture_output=True, text=True)
resp = json.loads(result.stdout)
file_key = resp['data']['file_key']
print(f"✅ 音频已上传: {file_key}")

# 步骤5: 发送飞书 audio 消息
content = json.dumps({"file_key": file_key, "duration": duration_ms})
result2 = subprocess.run([
    'curl', '-sf', '-X', 'POST',
    f'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type={id_type}',
    '-H', f'Authorization: Bearer {token}',
    '-H', 'Content-Type: application/json',
    '-d', json.dumps({"receive_id": receive_id, "msg_type": "audio", "content": content})
], capture_output=True, text=True)
resp2 = json.loads(result2.stdout)
if resp2.get('code') == 0:
    print(f"✅ 语音消息已发送: {resp2['data']['message_id']} ({duration_ms}ms)")
else:
    print(f"❌ 发送失败: {resp2}", file=sys.stderr)
    sys.exit(1)

os.remove(wav_path)
PYEOF
