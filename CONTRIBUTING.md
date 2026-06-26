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

## 📄 License

提交代码即表示你同意将代码以 [MIT License](LICENSE) 发布。
