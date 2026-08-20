"""日报/周报渲染性格测试:锁定生成的 Markdown 字节级内容

docs/*.md 是系统的事实数据源(周报与站点都从中重建数据),渲染格式
是读写两侧的契约。#4 重构时按重构前输出写下;#5 有意在 tag 行追加
真实投票数(👍n),golden 同步更新。

运行:python -m unittest discover tests
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

import main as main_mod
import weekly as weekly_mod

DOCS_DIR = Path(__file__).parent.parent / "docs"

FIXTURE_PAPERS = [
    {
        "title": "Paper With Everything",
        "reason": "高票/有代码",
        "abstract": "A" * 250,
        "url": "https://arxiv.org/abs/2608.00001",
        "pdf_url": "https://arxiv.org/pdf/2608.00001",
        "code_url": "https://github.com/x/y",
        "has_code": True,
        "source": "huggingface",
        "votes": 128,
    },
    {
        "title": "Paper Minimal",
        "reason": "最新论文",
        "abstract": "",
        "url": "https://arxiv.org/abs/2608.00002",
        "pdf_url": "",
        "code_url": "",
        "has_code": False,
        "source": "arxiv",
        "votes": 0,
    },
]

EXPECTED_DAILY = f"""# 📄 论文日报 | 1999-01-01（周五）

## 1. Paper With Everything 📦代码

_高票/有代码 👍128_

> {"A" * 200}...

[📄 论文](https://arxiv.org/abs/2608.00001) | [📥 PDF](https://arxiv.org/pdf/2608.00001) | [💻 代码](https://github.com/x/y)

## 2. Paper Minimal

_最新论文_

[📄 论文](https://arxiv.org/abs/2608.00002)


---
_本期筛选方式：AI 语义筛选_

_由 [AI Paper Daily](https://github.com/alloevil/AI-Paper-Daily) 自动生成_"""

EXPECTED_WEEKLY = f"""# 📄 论文周报 | 1999-W01（1999-01-01 ~ 1999-01-07）

过去 7 天共推送 42 篇论文，以下为按热度（投票 / 星标 / 开源代码）重排的 Top 2：

## 1. Paper With Everything 📦代码

_高票/有代码 👍128_

> {"A" * 200}...

[📄 论文](https://arxiv.org/abs/2608.00001) | [📥 PDF](https://arxiv.org/pdf/2608.00001) | [💻 代码](https://github.com/x/y)

## 2. Paper Minimal

_最新论文_

[📄 论文](https://arxiv.org/abs/2608.00002)


---
_由 [AI Paper Daily](https://github.com/alloevil/AI-Paper-Daily) 自动生成_"""


class _GoldenBase(unittest.TestCase):
    """在真实 docs/ 目录用 1999 年哨兵日期生成,tearDown 恢复现场"""

    report_name = None  # 子类指定生成的报告文件名

    def setUp(self):
        self._index_path = DOCS_DIR / "index.md"
        self._index_backup = self._index_path.read_bytes()

    def tearDown(self):
        (DOCS_DIR / self.report_name).unlink(missing_ok=True)
        self._index_path.write_bytes(self._index_backup)


class DailyReportGoldenTest(_GoldenBase):
    report_name = "1999-01-01.md"

    def setUp(self):
        super().setUp()
        main_mod.generate_report(
            [dict(p) for p in FIXTURE_PAPERS], "1999-01-01", "ai")

    def test_daily_markdown_golden(self):
        content = (DOCS_DIR / self.report_name).read_text(encoding="utf-8")
        self.assertEqual(content, EXPECTED_DAILY)

    def test_daily_index_entry_prepended(self):
        index = self._index_path.read_text(encoding="utf-8")
        self.assertIn(
            "## 历史记录\n\n- [1999-01-01（周五）](1999-01-01.md) - 2 篇论文\n",
            index)


class WeeklyReportGoldenTest(_GoldenBase):
    report_name = "weekly-1999-W01.md"

    def setUp(self):
        super().setUp()
        self._report_path = weekly_mod.generate_weekly_report(
            [dict(p) for p in FIXTURE_PAPERS],
            "1999-01-01", "1999-01-07", total=42)

    def test_weekly_markdown_golden(self):
        content = self._report_path.read_text(encoding="utf-8")
        self.assertEqual(content, EXPECTED_WEEKLY)

    def test_weekly_report_path(self):
        self.assertEqual(self._report_path, DOCS_DIR / self.report_name)

    def test_weekly_index_entry_prepended(self):
        index = self._index_path.read_text(encoding="utf-8")
        self.assertIn(
            "## 历史记录\n\n- [📊 周报 1999-W01](weekly-1999-W01.md) - Top 2\n",
            index)

    def test_weekly_does_not_double_code_tag(self):
        """回归:标题已含 📦代码 时不得再拼一次(weekly-2026-W34 双标签 bug)"""
        papers = [dict(FIXTURE_PAPERS[0])]
        papers[0]["title"] = "Already Tagged 📦代码"
        path = weekly_mod.generate_weekly_report(
            papers, "1999-01-01", "1999-01-07", total=1)
        try:
            content = path.read_text(encoding="utf-8")
            self.assertNotIn("📦代码 📦代码", content)
        finally:
            path.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
