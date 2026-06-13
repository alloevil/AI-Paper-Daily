---
name: mimo-tts-voice
description: 调用小米 mimo-v2-tts 合成语音并直接发送飞书语音消息（🎙️ 气泡形式）。
  触发词：发语音、语音消息、TTS、用语音说、念出来、把这句话说出来、发一条语音给 xxx。
  适用场景：需要以语音形式发送消息给飞书用户（而不是文字消息），支持多种音色和风格控制（情绪、方言、角色扮演等）。
  注意：这是发送飞书语音气泡（audio 消息），不是 OpenClaw 的 [[tts]] 语音回复标签。
---

# mimo-tts-voice

将文本合成为语音（或唱歌）并通过飞书 IM 发送为原生语音消息（可点击播放的气泡）。

## 快速使用

```bash
bash scripts/send_voice.sh "<文本>" <id> [voice] [style_tag] [id_type]
```

**示例：**
```bash
# 发给个人（open_id）
bash scripts/send_voice.sh "你好！" ou_263211665045f37c3b85dc85be8df441

# 发到群聊（chat_id）
bash scripts/send_voice.sh "大家好！" oc_a1b0b89c46bf50f1bbe916fc9fc1cba0 mimo_default "" chat_id

# 东北话风格
bash scripts/send_voice.sh "哎呀妈呀，这天儿也忒冷了！" ou_xxx mimo_default 东北话

# 唱歌（⚠️ 唱歌必须单独用，不能混其他风格）
bash scripts/send_voice.sh "两只老虎，跑得快" oc_xxx mimo_default 唱歌 chat_id
```

## 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| 文本 | 要合成的文字 | 必填 |
| id | open_id（ou_xxx）或 chat_id（oc_xxx） | 必填 |
| voice | 音色 | `mimo_default` |
| style_tag | 风格标签（不含 `<style>` 标签） | 无 |
| id_type | `open_id` 或 `chat_id` | `open_id` |

## 可用音色

| 音色名 | voice 参数 |
|--------|-----------|
| MiMo-默认 | `mimo_default` |
| MiMo-中文女声 | `default_zh` |
| MiMo-英文女声 | `default_eh` |

## 风格标签

- **情绪：** `开心` / `悲伤` / `生气`
- **语速：** `变快` / `变慢`
- **方言：** `东北话` / `四川话` / `粤语`
- **角色：** `孙悟空` / `林黛玉`
- **风格：** `悄悄话` / `夹子音` / `台湾腔`
- **唱歌：** `唱歌`（⚠️ 必须单独使用，不可与其他风格混用）

文本中也可直接嵌入音频标签做细粒度控制：
`（轻声）今天辛苦了……（长叹一口气）好好休息吧。`

## 依赖

- `MODEL_API_KEY` 环境变量（mify API Key，容器内已有）
- `~/.openclaw/openclaw.json`（飞书 appId / appSecret）
- `curl` + `python3`（容器内已有）
- 无需 ffmpeg（飞书接受 wav 格式）

## 技术说明

- TTS 接口：`POST /v1/chat/completions`，文本放在 `role: assistant` 的消息里
- 飞书上传：`/im/v1/files`（file_type=opus，实际传 wav 也通过）
- 所有含 `<style>` 标签的文本在 Python 层处理，不经过 shell 转义
