---
name: feishu-send-file
description: 将本地文件作为 IM 附件发送给飞书用户（curl 三步法）。触发词：发文件、发附件、发备份、把文件发给、send file、上传并发送。适用于需要把本地文件（日志、备份包、报告等）通过飞书 IM 直接发给指定用户的场景。
---

# feishu-send-file

通过 curl 三步法将本地文件发送为飞书 IM 附件。

## 用法

```bash
bash scripts/send_file.sh <本地文件路径> <接收人 open_id>
```

**示例：**
```bash
bash scripts/send_file.sh /tmp/backup.tar.gz ou_263211665045f37c3b85dc85be8df441
```

## 流程

1. 从 `~/.openclaw/openclaw.json` 读取 appId + appSecret
2. 换取 `tenant_access_token`
3. POST `/im/v1/files` 上传文件 → 拿到 `file_key`
4. POST `/im/v1/messages` 发送 file 类型消息

## 注意

- 脚本依赖 `curl` + `python3`（容器内已有）
- 接收人必须是 `open_id`（`ou_xxx` 格式）
- 文件大小上限：飞书 IM 文件限制 50MB
- **绝不在日志或消息中打印 token 明文**
