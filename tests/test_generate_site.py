"""站点生成与 md 读取层测试:日报 md 是事实数据源,标题不得携带展示性标签

运行:python -m unittest discover tests
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from reports import parse_papers, parse_weekly_title
from generate_site import render_weekly_page, generate_rss
from common import render_report

SAMPLE_MD = """# 📄 论文日报 | 2026-08-20（周四）

## 1. One Gate Is Not Enough: Verified Routing 📦代码

_高票/有代码 👍128_

> Some abstract text here.

[📄 论文](https://arxiv.org/abs/2608.11111) | [📥 PDF](https://arxiv.org/pdf/2608.11111) | [💻 代码](https://github.com/x/y)

## 2. Plain Title Without Tag

_最新论文_

> Another abstract.

[📄 论文](https://arxiv.org/abs/2608.22222)

## 3. Double Tagged Title 📦代码 📦代码

_高票/有代码_

> Weekly regenerated entry.

[📄 论文](https://arxiv.org/abs/2608.33333)
"""


class ParsePapersTitleTest(unittest.TestCase):
    """parse_papers 剥离标题尾部『 📦代码』标签,防止回流污染站点/RSS/周报"""

    def setUp(self):
        self._tmp = tempfile.NamedTemporaryFile(
            "w", suffix=".md", encoding="utf-8", delete=False)
        self._tmp.write(SAMPLE_MD)
        self._tmp.close()
        self.papers = parse_papers(self._tmp.name)

    def tearDown(self):
        Path(self._tmp.name).unlink(missing_ok=True)

    def test_strips_code_tag_suffix(self):
        self.assertEqual(self.papers[0]["title"],
                         "One Gate Is Not Enough: Verified Routing")

    def test_plain_title_untouched(self):
        self.assertEqual(self.papers[1]["title"], "Plain Title Without Tag")

    def test_strips_repeated_tags(self):
        self.assertEqual(self.papers[2]["title"], "Double Tagged Title")

    def test_links_survive_parsing(self):
        links = self.papers[0]["links"]
        self.assertEqual(links["paper"], "https://arxiv.org/abs/2608.11111")
        self.assertEqual(links["code"], "https://github.com/x/y")

    def test_votes_parsed_from_tag(self):
        """tag 行的 👍n 解析为数值 votes,且从 tag 文本中剥离"""
        self.assertEqual(self.papers[0]["votes"], 128)
        self.assertEqual(self.papers[0]["tag"], "高票/有代码")
        self.assertNotIn("👍", " ".join(self.papers[0]["tags"]))

    def test_votes_default_zero_for_legacy_reports(self):
        """历史日报的 tag 行没有 👍n,votes 缺省 0 而非崩溃"""
        self.assertEqual(self.papers[1]["votes"], 0)
        self.assertEqual(self.papers[1]["tag"], "最新论文")


SAMPLE_WEEKLY_MD = """# 📄 论文周报 | 2026-W34（2026-08-14 ~ 2026-08-20）

过去 7 天共推送 64 篇论文，以下为按热度（投票 / 星标 / 开源代码）重排的 Top 2：

## 1. Top Weekly Paper 📦代码

_高票/有代码 👍99_

> Weekly abstract.

[📄 论文](https://arxiv.org/abs/2608.44444) | [💻 代码](https://github.com/a/b)

## 2. Second Weekly Paper

_最新论文_

[📄 论文](https://arxiv.org/abs/2608.55555)
"""


class WeeklySitePageTest(unittest.TestCase):
    """weekly-*.md 渲染为站点 HTML 页并进 feed(#5:周报 Pages 可达)"""

    def setUp(self):
        self._tmp = tempfile.NamedTemporaryFile(
            "w", suffix=".md", encoding="utf-8", delete=False)
        self._tmp.write(SAMPLE_WEEKLY_MD)
        self._tmp.close()
        self.papers = parse_papers(self._tmp.name)
        self.date_range = parse_weekly_title(self._tmp.name)

    def tearDown(self):
        Path(self._tmp.name).unlink(missing_ok=True)

    def test_weekly_title_range_parsed(self):
        self.assertEqual(self.date_range, "2026-08-14 ~ 2026-08-20")

    def test_weekly_md_parses_with_same_reader(self):
        self.assertEqual(len(self.papers), 2)
        self.assertEqual(self.papers[0]["title"], "Top Weekly Paper")
        self.assertEqual(self.papers[0]["votes"], 99)

    def test_weekly_page_renders_papers_as_html(self):
        html = render_weekly_page("2026-W34", self.date_range, self.papers)
        self.assertIn("论文周报 2026-W34", html)
        self.assertIn("Top Weekly Paper", html)
        self.assertIn("https://arxiv.org/abs/2608.44444", html)
        self.assertIn('href="./"', html)  # 返回首页链接

    def test_weekly_report_in_feed(self):
        xml = generate_rss([], [("2026-W34", self.date_range, self.papers)])
        self.assertIn("论文周报 2026-W34", xml)
        self.assertIn("weekly-2026-W34.html", xml)


class WriteReadRoundTripTest(unittest.TestCase):
    """md-as-database 契约:common.render_report 写出的报告,
    reports.parse_papers 必须无损回读关键字段(#6:parse_papers 是正式读取层)"""

    PAPERS = [
        {
            "title": "Round Trip Paper",
            "reason": "高票/有代码",
            "abstract": "An abstract for round-trip.",
            "url": "https://arxiv.org/abs/2608.77777",
            "pdf_url": "https://arxiv.org/pdf/2608.77777",
            "code_url": "https://github.com/r/t",
            "has_code": True,
            "votes": 42,
        },
        {
            "title": "Zero Votes Paper",
            "reason": "最新论文",
            "abstract": "",
            "url": "https://arxiv.org/abs/2608.88888",
            "pdf_url": "",
            "code_url": "",
            "has_code": False,
            "votes": 0,
        },
    ]

    def setUp(self):
        md = render_report(self.PAPERS, title="📄 论文日报 | 2026-01-01（周四）",
                           footer_extra="_本期筛选方式：AI 语义筛选_")
        self._tmp = tempfile.NamedTemporaryFile(
            "w", suffix=".md", encoding="utf-8", delete=False)
        self._tmp.write(md)
        self._tmp.close()
        self.parsed = parse_papers(self._tmp.name)

    def tearDown(self):
        Path(self._tmp.name).unlink(missing_ok=True)

    def test_titles_round_trip(self):
        self.assertEqual([p["title"] for p in self.parsed],
                         ["Round Trip Paper", "Zero Votes Paper"])

    def test_links_round_trip(self):
        links = self.parsed[0]["links"]
        self.assertEqual(links["paper"], "https://arxiv.org/abs/2608.77777")
        self.assertEqual(links["pdf"], "https://arxiv.org/pdf/2608.77777")
        self.assertEqual(links["code"], "https://github.com/r/t")
        self.assertEqual(self.parsed[1]["links"], {"paper": "https://arxiv.org/abs/2608.88888"})

    def test_tag_and_votes_round_trip(self):
        self.assertEqual(self.parsed[0]["tag"], "高票/有代码")
        self.assertEqual(self.parsed[0]["votes"], 42)
        self.assertEqual(self.parsed[1]["tag"], "最新论文")
        self.assertEqual(self.parsed[1]["votes"], 0)

    def test_abstract_round_trip(self):
        self.assertEqual(self.parsed[0]["abstract"][:12], "An abstract ")
        self.assertEqual(self.parsed[1]["abstract"], "")


if __name__ == "__main__":
    unittest.main()
