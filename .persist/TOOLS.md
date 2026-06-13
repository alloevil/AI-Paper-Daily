# TOOLS.md - 工具配置备忘

技能定义工具_如何_工作。这个文件是_你的_具体情况——高瑞林的工作环境所特有的东西。

## Codex CLI

### 安装（容器重置后需重新执行）

```bash
# 1. 安装到 workspace（全局安装会因权限失败）
cd ~/.openclaw/workspace && npm install @openai/codex --cache /tmp/npm-cache

# 2. 找到二进制路径
CODEX_BIN=$(find ~/.openclaw/workspace/node_modules/@openai/ -name codex -type f | head -1)

# 3. 配置 mify 后端
export HOME=/home/node  # /root 无写权限
mkdir -p $HOME/.codex

cat > $HOME/.codex/config.toml << 'TOML'
model = "azure_openai/gpt-5.1-codex-5"
model_provider = "mify"
model_reasoning_effort = "high"

[model_providers.mify]
name = "mify"
base_url = "http://model.mify.ai.srv/v1"
wire_api = "responses"
request_max_retries = 4
stream_max_retries = 10
stream_idle_timeout_ms = 300000
TOML

cat > $HOME/.codex/auth.json << 'JSON'
{
  "OPENAI_API_KEY": "你的mify API Key"
}
JSON
```

### 调用方式

```bash
# 非交互模式（推荐）
export HOME=/home/node
$CODEX_BIN exec --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox --model azure_openai/gpt-5.1-codex-5 "你的任务"

# 交互模式
$CODEX_BIN --model azure_openai/gpt-5.1-codex-5
```

### 说明

- **bubblewrap 未安装**：容器无 apt 权限，需用 `--dangerously-bypass-approvals-and-sandbox` 跳过沙箱
- **HOME 必须设为 /home/node**：node 用户无 /root 写权限
- **模型可选**：`azure_openai/gpt-5.1-codex-5`、`azure_openai/gpt-5.4`、`azure_openai/gpt-5.1-codex-max-5` 等
- **⚠️ 安全警告**：`--dangerously-bypass-approvals-and-sandbox` 会跳过所有安全检查，仅在受信任环境使用

## Mify 模型调用

详细用法见 `skills/mify-models/SKILL.md`

```bash
# 获取最新模型列表
curl -s "http://model.mify.ai.srv/v1/models" -H "Authorization: Bearer $LLM_API_KEY" | python3 -c "import json,sys; [print(m['id']) for m in json.load(sys.stdin)['data']]"

# 调用（OpenAI 兼容）
curl -X POST "http://model.mify.ai.srv/v1/chat/completions" -H "Authorization: Bearer $LLM_API_KEY" -H "Content-Type: application/json" -d '{"model":"xiaomi/mimo-v2.5","messages":[{"role":"user","content":"你好"}]}'

# 调用（Anthropic 协议，Claude 专用）
curl -X POST "http://model.mify.ai.srv/anthropic/v1/messages" -H "x-api-key: $LLM_API_KEY" -H "anthropic-version: 2023-06-01" -H "Content-Type: application/json" -d '{"model":"ppio/pa/claude-sonnet-4-6","max_tokens":1024,"messages":[{"role":"user","content":"你好"}]}'
```

## 图片识别

**不用 `read` 工具**（走 pro 文本模型，视觉差）。用 mimo-v2.5 API：

```bash
python3 << 'EOF'
import base64, json, urllib.request
with open("image.jpg", "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode()
payload = {
    "model": "xiaomi/mimo-v2.5",
    "messages": [{"role": "user", "content": [
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}},
        {"type": "text", "text": "识别图片内容"}
    ]}],
    "max_completion_tokens": 2000
}
req = urllib.request.Request("http://model.mify.ai.srv/v1/chat/completions",
    data=json.dumps(payload).encode(),
    headers={"Authorization": "Bearer mit-VpJcWMSLf6VGBWlFSQgJfJ3YShbd6rq1XmiFCk660LSCVeVu", "Content-Type": "application/json"})
resp = urllib.request.urlopen(req, timeout=120)
print(json.loads(resp.read())["choices"][0]["message"]["content"])
EOF
```

## 飞书（小米办公Pro）

- **平台：** 飞书（Lark）
- **Token 类型：** Tenant Token（系统操作）/ User Token（个人操作）
- **搜索用户：** 使用 feishu-search-user 技能精准寻人，禁止全量拉通讯录

### 飞书发文件（2026-05-12 更新）

**message 工具发文件经常 ECONNRESET，改用飞书 API 直接调用：**

```python
import json, urllib.request, uuid

# 1. 获取 tenant_access_token
# 2. POST /im/v1/files 上传（multipart/form-data）拿 file_key
# 3. POST /im/v1/messages 发 file 消息（receive_id_type=open_id）
```

关键参数：file_type=stream, msg_type=file, content={'file_key': xxx}
脚本参考：见 2026-05-12 执行记录

### 飞书发图片

用正确 appId（`cli_a938659fb4b89bce`）获取 token → 上传图片 → 发送：

```python
# 1. 获取 tenant_token
# 2. POST /im/v1/images 上传图片拿 image_key
# 3. POST /im/v1/messages 发送（receive_id_type=open_id）
# 注意：appId 必须是 cli_a938659fb4b89bce，不是 cli_a9f3765ef77a5cc0
```

## Shell 环境配置

- **默认 shell**：zsh 5.9（`/etc/passwd` root 已改为 `/usr/bin/zsh`）
- **Oh My Zsh**：已安装，主题 `robbyrussell`
- **插件**：
  - `git` — git 快捷命令和状态显示
  - `zsh-autosuggestions` — 历史命令灰色提示，→ 键补全
  - `zsh-syntax-highlighting` — 命令语法高亮
  - `zsh-completions` — 增强 Tab 补全
- **别名**：`ll='ls -alF'`、`la='ls -A'`、`l='ls -CF'`（写入 `.bashrc`、`.zshrc`、`/etc/profile.d/aliases.sh`）
- **自动切 zsh**：`.bashrc` 末尾加了 `exec zsh`，交互式 bash 自动跳转
- **插件安装方式**：GitHub git clone 有 TLS 问题，用 curl 下载 zip 解压到 `~/.oh-my-zsh/custom/plugins/`

### 容器重建时需恢复

插件目录：`~/.oh-my-zsh/custom/plugins/` 下三个插件包（zsh-autosuggestions、zsh-syntax-highlighting、zsh-completions）
配置：`~/.zshrc`、`~/.bashrc`、`/etc/passwd`、`/etc/bash.bashrc`、`/etc/profile.d/aliases.sh`
Playwright：`npx playwright install chromium` + `npx playwright install-deps chromium`

## 软件工程工具

### 技术偏好
- Python: 优先 async/await、dataclass、typing、pathlib
- TypeScript: 严格模式、interface > type（除非需要 union）、const > let
- 测试: pytest / vitest，测行为不测实现
- Git: 不主动 commit，除非明确要求

## RSS 新闻源

- 飞书电子表格（手动写入）：`https://mi.feishu.cn/wiki/NWbMwM1Upi9ESEk958RcrRz5nRe?sheet=272c92`
  - 列：标题、正文、链接、记录时间
  - 每天有人手动写入新闻
  - 通过 `feishu_sheet` 工具读取（已授权）
- RSS 脚本源：`scripts/rss_fetch.py`（14 个 RSS + 8 个百度搜索，反向噪音过滤）
  - 泛科技：ithome/36kr/wallstreetcn/readhub/tmtpost/zaobao/laoyaoba/letschuhai/caixin
  - 手机行业：cnmo/cnbeta
  - 国际财经：reuters_world/reuters_tech/barrons/scmp
  - 筛选逻辑：脚本只采集+去重+排噪，核心筛选由 AI 语义判断（标准：信息增量，内部感知不到的才筛）
- Cron 定时任务：每天 9:00 跑 `每日科技情报`

## GitHub 检索

软件实现相关的任务优先查 GitHub：
- **搜项目**：`web_fetch` 抓取 `https://github.com/search?q=关键词` 获取结果
- **看 README**：`web_fetch` 抓取具体仓库页，了解用法和实现
- **查 issue/讨论**：遇到报错时搜 GitHub Issues 往往比 Stack Overflow 更精准
- **找 API 示例**：直接看官方 SDK 仓库的 examples/

适用场景：找轮子、查 API 用法、解决报错、参考实现方案

## 联网搜索（完整链路）

### 搜索优先级

1. **Tavily** — 快速搜索 + AI 答案摘要（`tavily_search` / `tavily_extract`）
2. **Exa** — 语义搜索，质量高（`exa_search`，支持 `contents.text` 提取）
3. **Firecrawl** — 搜索 + 整页抓取（`firecrawl_search` / `firecrawl_scrape`）
4. **百度 Playwright** — 中文搜索兜底
5. **web_fetch** — 已知 URL 直接抓取
6. **Jina** — 文章类预处理省 token（`r.jina.ai/URL`，20 RPM）

### 搜索脚本

`scripts/search.py` — Playwright + 百度（中文兜底）。

```bash
python3 scripts/search.py "搜索关键词"
```

- Chrome 路径：自动查找 `/root/.cache/ms-playwright/` 下的 chrome 二进制
- 容器重建后需恢复：`npx playwright install chromium` + `npx playwright install-deps chromium`

### Jina 预处理

`web_fetch("https://r.jina.ai/目标URL")` 省 token，20 RPM，适合文章/文档页

## 本地知识库搜索

`scripts/knowledge_search.py` — 在 knowledge/ 目录下搜索 markdown 文件。

```bash
python3 scripts/knowledge_search.py "关键词"
```

支持多关键词、标题加权、关键词高亮、按相关度排序。
