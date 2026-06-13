---
name: mify-models
description: |
  小米 Mify 大模型推理网关使用指南。支持 469+ 模型，包括 MiMo、Claude、GPT、Gemini、Qwen、DeepSeek 等。涵盖文本生成、多模态理解（图片/视频/音频）、语音合成等能力。
---

# Mify 大模型使用 Skill

## 概述

Mify 是小米内部的大模型推理网关，提供统一 API 调用国内外主流大模型。

- **平台地址**：https://mify.mioffice.cn
- **API 端点**：`http://model.mify.ai.srv/v1/chat/completions`
- **Anthropic 端点**：`http://model.mify.ai.srv/anthropic`
- **模型清单**：https://cnbj1-fds.api.xiaomi.net/mify-models/index.html
- **API Key 申请**：https://mify.mioffice.cn/gateway?tab=api-key

<callout emoji="⚠️" background-color="light-yellow">
模型列表持续更新，使用前建议先调用 `/v1/models` 接口获取最新可用模型。本文档基于 2026-04-26 数据。
</callout>

---

## 一、API 协议

Mify 支持两套 API 协议，根据模型选择对应端点：

### 1. OpenAI 兼容接口（大多数模型）

**端点**：`http://model.mify.ai.srv/v1/chat/completions`
**认证头**：`Authorization: Bearer <API Key>`

```bash
curl -X POST "http://model.mify.ai.srv/v1/chat/completions" \
  -H "Authorization: Bearer $LLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "xiaomi/mimo-v2.5",
    "messages": [{"role": "user", "content": "你好"}],
    "max_completion_tokens": 1024
  }'
```

**适用模型**：MiMo 全系列、GPT 系列、Gemini 系列、Qwen 系列、DeepSeek 系列、GLM 系列、Doubao 系列、Kimi 系列、MiniMax 系列、Grok 系列等。

### 2. Anthropic 接口（Claude 模型专用）

**端点**：`http://model.mify.ai.srv/anthropic/v1/messages`
**认证头**：`x-api-key: <API Key>`
**版本头**：`anthropic-version: 2023-06-01`

```bash
curl -X POST "http://model.mify.ai.srv/anthropic/v1/messages" \
  -H "x-api-key: $LLM_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ppio/pa/claude-sonnet-4-6",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

**适用模型**：`ppio/pa/claude-opus-4-7`、`ppio/pa/claude-opus-4-6`、`ppio/pa/claude-sonnet-4-6`、`ppio/pa/claude-haiku-4-5` 等。

---

## 二、主要模型列表

### 小米自研 MiMo（免费）

| 模型 ID | 能力 | 上下文 | 说明 |
|---------|------|--------|------|
| `xiaomi/mimo-v2.5` | 文本+图片+视频+音频 | 1M | 全模态，日常 Agent 首选 |
| `xiaomi/mimo-v2.5-pro` / `xiaomi/mimo-v2.5-pro-mit` | 纯文本 | 1M | 万亿参数，Agent 性能媲美 Claude Opus |
| `xiaomi/mimo-v2-pro` / `xiaomi/mimo-v2-pro-mit` | 纯文本 | 1M | 高性能文生文 |
| `xiaomi/mimo-v2-omni` | 文本+图片+视频+音频 | 256K | 全模态智能体基座 |
| `xiaomi/mimo-v2-tts` | 语音合成 | - | TTS |
| `xiaomi/mimo-v2.5-tts` | 语音合成 | - | 新版 TTS |
| `xiaomi/mimo-v2.5-tts-voiceclone` | 语音克隆 | - | 声音克隆 |
| `xiaomi/mimo-v2-flash` | 纯文本 | - | 轻量快速 |

### Anthropic Claude（via ppio）

| 模型 ID | 说明 |
|---------|------|
| `ppio/pa/claude-opus-4-7` | 最新旗舰 |
| `ppio/pa/claude-opus-4-6` | 上代旗舰 |
| `ppio/pa/claude-sonnet-4-6` | 平衡性能 |
| `ppio/pa/claude-haiku-4-5` | 轻量快速 |

### OpenAI GPT（via azure_openai / ppio）

| 模型 ID | 说明 |
|---------|------|
| `azure_openai/gpt-5.4` / `azure_openai/gpt-5.4-pro` | 最新 |
| `azure_openai/gpt-5.2` / `azure_openai/gpt-5.1` / `azure_openai/gpt-5` | 前代 |
| `azure_openai/gpt-5-codex` 系列 | 编程专用 |
| `azure_openai/gpt-4.1` / `azure_openai/gpt-4o` | 上代 |
| `azure_openai/o3` / `azure_openai/o4-mini` | 推理模型 |

### Google Gemini（via vertex_ai / ppio）

| 模型 ID | 说明 |
|---------|------|
| `vertex_ai/gemini-3.1-pro-preview` | 最新预览 |
| `vertex_ai/gemini-2.5-pro` / `vertex_ai/gemini-2.5-flash` | 主力 |
| `vertex_ai/gemini-2.5-flash-lite` | 轻量 |

### 阿里 Qwen / 通义（via tongyi）

| 模型 ID | 说明 |
|---------|------|
| `tongyi/qwen3.6-plus` | 最新 |
| `tongyi/qwen3-coder-480b` | 编程专用 |
| `tongyi/qwen-vl-max` | 视觉理解 |
| `tongyi/qwen-image-max` | 图像生成 |

### DeepSeek

| 模型 ID | 说明 |
|---------|------|
| `deepseek-ai/DeepSeek-V3.2` | 最新文本 |
| `deepseek-ai/DeepSeek-R1` | 推理模型 |

### 其他

| 厂商 | 示例模型 |
|------|---------|
| 智谱 GLM | `zhipuai/glm-5` / `zhipuai/glm-4.7` |
| 字节 Doubao | `volcengine_maas/doubao-seed-2-0-pro` |
| 月之暗面 Kimi | `moonshot/kimi-k2.6` |
| MiniMax | `minimax/MiniMax-M2.7` |
| 腾讯混元 | `hunyuan/hunyuan-turbo` |
| xAI Grok | `azure_openai/grok-4` |

---

## 三、多模态调用

### 图片理解

支持 URL 和 Base64 两种传入方式，支持模型：`xiaomi/mimo-v2.5`、`xiaomi/mimo-v2-omni`、`qwen-vl-max`、`gemini-2.5-pro` 等。

```python
import base64, json, urllib.request

# Base64 方式
with open("image.jpg", "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode()

payload = {
    "model": "xiaomi/mimo-v2.5",  # 或 xiaomi/mimo-v2-omni
    "messages": [{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}},
            {"type": "text", "text": "描述这张图片"}
        ]
    }],
    "max_completion_tokens": 1024
}

req = urllib.request.Request(
    "http://model.mify.ai.srv/v1/chat/completions",
    data=json.dumps(payload).encode(),
    headers={
        "Authorization": "Bearer $LLM_API_KEY",
        "Content-Type": "application/json"
    }
)
resp = urllib.request.urlopen(req)
result = json.loads(resp.read())
print(result["choices"][0]["message"]["content"])
```

### 视频理解

```json
{
  "model": "xiaomi/mimo-v2-omni",
  "messages": [{
    "role": "user",
    "content": [
      {
        "type": "video_url",
        "video_url": {"url": "https://example.com/video.mp4"},
        "fps": 2,
        "media_resolution": "default"
      },
      {"type": "text", "text": "描述视频内容"}
    ]
  }]
}
```

Base64：`"url": "data:video/mp4;base64,$BASE64_VIDEO"`（限 50MB）

### 音频理解

```json
{
  "model": "xiaomi/mimo-v2-omni",
  "messages": [{
    "role": "user",
    "content": [
      {"type": "input_audio", "input_audio": {"data": "https://example.com/audio.wav"}},
      {"type": "text", "text": "描述音频内容"}
    ]
  }]
}
```

Base64：`"data": "data:audio/mpeg;base64,$BASE64_AUDIO"`（限 50MB）

GPT-4o 音频需额外加 `"format": "mp3"`。

---

## 四、获取最新模型列表

```bash
curl -s "http://model.mify.ai.srv/v1/models" \
  -H "Authorization: Bearer $LLM_API_KEY" | python3 -c "
import json, sys
for m in sorted(json.load(sys.stdin)['data'], key=lambda x: x['id']):
    print(f\"{m['id']}  ({m['owned_by']})\")"
```

---

## 五、常见场景选择

| 场景 | 推荐模型 | 原因 |
|------|---------|------|
| 日常对话/Agent | `xiaomi/mimo-v2.5` | 全模态、免费、1M 上下文 |
| 高强度 Agent | `xiaomi/mimo-v2.5-pro-mit` | 媲美 Claude Opus |
| 图片识别 | `xiaomi/mimo-v2.5` | 免费、效果好 |
| 编程辅助 | `azure_openai/gpt-5-codex` 或 `tongyi/qwen3-coder-480b` | 编程专用优化 |
| 长文档分析 | `xiaomi/mimo-v2.5`（1M）或 `tongyi/qwen-long` | 超长上下文 |
| 图像生成 | `tongyi/qwen-image-max` 或 `volcengine_maas/Doubao-Seedream-5.0-lite` | 生图专用 |
| 语音合成 | `xiaomi/mimo-v2.5-tts` | 小米自研 TTS |
| Claude 体验 | `ppio/pa/claude-opus-4-7` | 最新 Claude |

---

## 六、Python 快速调用模板

```python
import json, urllib.request

API_KEY = "你的mify API Key"
BASE_URL = "http://model.mify.ai.srv/v1/chat/completions"

def chat(model, messages, max_tokens=1024):
    payload = {
        "model": model,
        "messages": messages,
        "max_completion_tokens": max_tokens
    }
    req = urllib.request.Request(
        BASE_URL,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }
    )
    resp = urllib.request.urlopen(req, timeout=120)
    return json.loads(resp.read())["choices"][0]["message"]["content"]

# 使用示例
result = chat("xiaomi/mimo-v2.5", [
    {"role": "user", "content": "你好"}
])
print(result)
```

---

## 七、注意事项

1. **内网环境**：需连接公司 VPN 才能访问 `model.mify.ai.srv`
2. **免费额度**：MiMo 自研模型免费，500 元/月免审批池
3. **IAM 挂载**：月消费 >500 元或生产环境需走 IAM 审批
4. **速率限制**：注意并发控制，避免触发限流
5. **模型更新**：Mify 持续引入新模型，定期检查 `/v1/models` 接口
