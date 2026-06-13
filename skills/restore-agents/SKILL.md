---
name: restore-agents
description: 恢复 AGENTS.md 到持久化版本。当用户说"恢复 AGENTS"、"还原 AGENTS"、"restore agents"时触发。将 .persist/AGENTS.md 覆盖回 workspace/AGENTS.md。
---

# Restore AGENTS

将持久化备份覆盖回 AGENTS.md：

```bash
cp -f /root/.openclaw/workspace/.persist/AGENTS.md /root/.openclaw/workspace/AGENTS.md
```

完成后告知用户已恢复。
