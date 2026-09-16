# Contributing to AI Paper Daily

感谢你的关注！以下是参与贡献的指南。

## 🐛 报告 Bug

使用 [Bug Report 模板](https://github.com/alloevil/AI-Paper-Daily/issues/new?template=bug_report.md) 提交，请包含：

- 问题描述
- 复现步骤
- 期望 vs 实际行为
- 日志输出（如有）

## 💡 功能建议

使用 [Feature Request 模板](https://github.com/alloevil/AI-Paper-Daily/issues/new?template=feature_request.md) 提交。

## 🔧 提交 PR

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/my-feature`
3. 提交更改：`git commit -m "feat: add my feature"`
4. 推送分支：`git push origin feature/my-feature`
5. 创建 Pull Request

### Commit 规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建/工具相关

### 添加新数据源

1. 在 `scripts/sources/` 下创建新文件，如 `my_source.py`
2. 实现 `fetch_my_source(keywords, days)` 函数，返回标准格式的论文列表
3. 在 `scripts/main.py` 中注册数据源
4. 更新 `config.yaml` 添加开关配置
5. 更新 README 文档

### 论文数据格式

```python
{
    "id": "唯一标识（arXiv ID 或自定义）",
    "title": "论文标题",
    "abstract": "摘要",
    "authors": ["作者1", "作者2"],
    "url": "论文页面链接",
    "pdf_url": "PDF 下载链接",
    "published": "2026-06-26T00:00:00Z",
    "source": "数据源名称",
    "categories": ["cs.AI", "cs.CL"],
    "has_code": True,
    "code_url": "GitHub 链接",
    "votes": 0,
    "stars": 0,
}
```

## 📝 本地开发

```bash
# 克隆仓库
git clone https://github.com/alloevil/AI-Paper-Daily.git
cd AI-Paper-Daily

# 安装依赖
pip install pyyaml

# 配置环境变量（可选，用于测试 AI 筛选）
export LLM_API_KEY="your-key"
export LLM_BASE_URL="https://api.openai.com/v1"

# 运行
python scripts/main.py
```

### 本地预览站点

```bash
# 离线渲染全部页面（读 docs/*.md，不需要网络与 key）
python3 scripts/generate_site.py

# 起个静态服务看效果（只绑本机）
python3 -m http.server 8765 --directory docs
# 打开 http://127.0.0.1:8765/
```

改 `docs/template.html` 或 `scripts/generate_site.py` 之后**必须重跑生成器**，页面才会变。

### 推送前的同步（每天都有的 cron 提交）

日报流水线**每天**会提交一次：新的 `docs/YYYY-MM-DD.md`，以及它顺手重新生成的
`docs/index.html`、`docs/YYYY-MM-DD.html`、`docs/feed.xml`、`docs/sitemap.xml`。而设计改动
（改模板/生成器后重新生成**全部**页面）改的正是同一批文件，所以推送前几乎总会撞上冲突。
解法是固定的，但**只对生成物成立**：

```bash
python3 scripts/sync.py            # 同步 → 校验 → 推送
python3 scripts/sync.py --no-push  # 只同步 + 校验，不推
```

脚本做三件事：

1. `git fetch` 后 rebase；
2. 冲突里的**生成物**（`docs/*.html` 除 `template.html` 外、`feed.xml`、`sitemap.xml`、
   `robots.txt`）自动取我方版本并重跑 `scripts/generate_site.py` —— 重新生成的结果才同时
   包含远端的新一天和新的模板；**数据与源码**（`docs/*.md`、`docs/template.html`、
   `scripts/**`、`tests/**`、`claims.json`）会停下来交给你人工合并；
3. 推送前跑生成器幂等检查与 `python -m unittest discover tests`，不过就不推。

> 生成物永远不要手工合并：它是生成器的输出，重跑一次才是对的。

## 📄 License

提交代码即表示你同意将代码以 [MIT License](LICENSE) 发布。
